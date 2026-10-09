"""OSRM client with TTL cache. Road geometry comes from OSRM only.

If OSRM is unreachable a `RoutingUnavailable` error is raised. A haversine
straight-line estimate exists solely as an explicit, opt-in, clearly labelled
fallback (`fallback_estimate=True`, empty geometry) and never as a route.
"""
from __future__ import annotations

import logging
import math
import time
from collections import OrderedDict
from typing import Any, Callable

import httpx

from app.schemas.common import Coordinate
from app.schemas.routing import Leg, MatrixResponse, RouteResponse, RoutingStatus

log = logging.getLogger(__name__)

FALLBACK_SPEED_KMPH = 25.0
FALLBACK_NOTE = (
    "FALLBACK ESTIMATE: straight-line (haversine) distance, not a road route. "
    f"Duration assumes {FALLBACK_SPEED_KMPH:.0f} km/h. OSRM was unavailable."
)


class RoutingError(Exception):
    pass


class InvalidCoordinates(RoutingError, ValueError):
    pass


class RoutingUnavailable(RoutingError):
    """OSRM could not be reached / returned an unusable answer."""


def validate_coordinates(coords: list[Coordinate], max_n: int = 100) -> None:
    if len(coords) < 2:
        raise InvalidCoordinates("at least 2 coordinates are required")
    if len(coords) > max_n:
        raise InvalidCoordinates(f"at most {max_n} coordinates are supported")
    for i, c in enumerate(coords):
        if not (math.isfinite(c.lat) and math.isfinite(c.lng)):
            raise InvalidCoordinates(f"coordinate {i} is not finite")
        if not -90 <= c.lat <= 90 or not -180 <= c.lng <= 180:
            raise InvalidCoordinates(f"coordinate {i} out of range")


def haversine_km(a: Coordinate, b: Coordinate) -> float:
    r = 6371.0088
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dphi = p2 - p1
    dl = math.radians(b.lng - a.lng)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


class TTLCache:
    def __init__(self, ttl_s: float, max_entries: int, clock: Callable[[], float] = time.monotonic):
        self.ttl, self.max, self._clock = ttl_s, max_entries, clock
        self._d: OrderedDict[Any, tuple[float, Any]] = OrderedDict()

    def get(self, key: Any) -> Any | None:
        item = self._d.get(key)
        if item is None:
            return None
        ts, val = item
        if self._clock() - ts > self.ttl:
            self._d.pop(key, None)
            return None
        self._d.move_to_end(key)
        return val

    def set(self, key: Any, val: Any) -> None:
        if self.ttl <= 0:
            return
        self._d[key] = (self._clock(), val)
        self._d.move_to_end(key)
        while len(self._d) > self.max:
            self._d.popitem(last=False)

    def __len__(self) -> int:
        return len(self._d)


def _path(coords: list[Coordinate]) -> str:
    return ";".join(f"{c.lng:.6f},{c.lat:.6f}" for c in coords)


class OSRMClient:
    def __init__(
        self,
        base_url: str,
        timeout_s: float = 8.0,
        cache_ttl_s: float = 300.0,
        cache_max_entries: int = 512,
        max_coordinates: int = 100,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self.max_coordinates = max_coordinates
        self._cache = TTLCache(cache_ttl_s, cache_max_entries)
        self._transport = transport
        self.last_error: str | None = None

    async def _get_json(self, url: str, params: dict[str, str]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout_s, transport=self._transport) as client:
                resp = await client.get(url, params=params, headers={"User-Agent": "RouteZen/0.1"})
        except httpx.HTTPError as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"
            log.warning("osrm request failed", extra={"error": self.last_error})
            raise RoutingUnavailable(f"OSRM request failed: {type(exc).__name__}") from exc
        if resp.status_code != 200:
            self.last_error = f"HTTP {resp.status_code}"
            raise RoutingUnavailable(f"OSRM returned HTTP {resp.status_code}")
        try:
            data = resp.json()
        except ValueError as exc:
            self.last_error = "invalid JSON"
            raise RoutingUnavailable("OSRM returned invalid JSON") from exc
        if data.get("code") != "Ok":
            self.last_error = str(data.get("code"))
            raise RoutingUnavailable(f"OSRM error code: {data.get('code')}")
        self.last_error = None
        return data

    async def route(self, coords: list[Coordinate]) -> RouteResponse:
        validate_coordinates(coords, self.max_coordinates)
        key = ("route", tuple((round(c.lat, 6), round(c.lng, 6)) for c in coords))
        if (hit := self._cache.get(key)) is not None:
            return hit
        data = await self._get_json(
            f"{self.base_url}/route/v1/driving/{_path(coords)}",
            {"overview": "full", "geometries": "geojson", "steps": "false"},
        )
        try:
            r = data["routes"][0]
            geometry = [[lat, lng] for lng, lat in r["geometry"]["coordinates"]]
            legs = [Leg(distance_km=l["distance"] / 1000, duration_min=l["duration"] / 60) for l in r["legs"]]
            out = RouteResponse(
                distance_km=r["distance"] / 1000,
                duration_min=r["duration"] / 60,
                geometry=geometry,
                legs=legs,
                provider="osrm",
            )
        except (KeyError, IndexError, TypeError) as exc:
            raise RoutingUnavailable("OSRM response missing expected fields") from exc
        self._cache.set(key, out)
        return out

    async def matrix(self, coords: list[Coordinate]) -> MatrixResponse:
        validate_coordinates(coords, self.max_coordinates)
        key = ("matrix", tuple((round(c.lat, 6), round(c.lng, 6)) for c in coords))
        if (hit := self._cache.get(key)) is not None:
            return hit
        data = await self._get_json(
            f"{self.base_url}/table/v1/driving/{_path(coords)}", {"annotations": "distance,duration"}
        )
        try:
            n = len(coords)
            dist, dur = data["distances"], data["durations"]
            if len(dist) != n or len(dur) != n or any(v is None for row in dist + dur for v in row):
                raise RoutingUnavailable("OSRM matrix incomplete (unroutable coordinate pair)")
            out = MatrixResponse(
                distance_km=[[v / 1000 for v in row] for row in dist],
                duration_min=[[v / 60 for v in row] for row in dur],
                provider="osrm",
            )
        except (KeyError, TypeError) as exc:
            raise RoutingUnavailable("OSRM response missing expected fields") from exc
        self._cache.set(key, out)
        return out

    async def status(self) -> RoutingStatus:
        t0 = time.perf_counter()
        probe = [Coordinate(lat=13.0418, lng=80.2341), Coordinate(lat=13.0827, lng=80.2707)]
        try:
            await self._get_json(f"{self.base_url}/route/v1/driving/{_path(probe)}", {"overview": "false"})
            return RoutingStatus(
                provider="osrm", base_url=self.base_url, reachable=True,
                latency_ms=round((time.perf_counter() - t0) * 1000, 1),
            )
        except RoutingUnavailable as exc:
            return RoutingStatus(provider="osrm", base_url=self.base_url, reachable=False, error=str(exc))

    # ---- explicit fallback ---------------------------------------------
    @staticmethod
    def fallback_route(coords: list[Coordinate]) -> RouteResponse:
        validate_coordinates(coords)
        legs = [
            Leg(distance_km=(d := haversine_km(a, b)), duration_min=d / FALLBACK_SPEED_KMPH * 60)
            for a, b in zip(coords, coords[1:])
        ]
        return RouteResponse(
            distance_km=sum(l.distance_km for l in legs),
            duration_min=sum(l.duration_min for l in legs),
            geometry=[],  # never expose straight lines as route geometry
            legs=legs,
            provider="fallback_estimate",
            fallback_estimate=True,
            note=FALLBACK_NOTE,
        )

    @staticmethod
    def fallback_matrix(coords: list[Coordinate]) -> MatrixResponse:
        validate_coordinates(coords)
        d = [[haversine_km(a, b) for b in coords] for a in coords]
        return MatrixResponse(
            distance_km=d,
            duration_min=[[x / FALLBACK_SPEED_KMPH * 60 for x in row] for row in d],
            provider="fallback_estimate",
            fallback_estimate=True,
            note=FALLBACK_NOTE,
        )

    async def route_or_fallback(self, coords: list[Coordinate], allow_fallback: bool) -> RouteResponse:
        try:
            return await self.route(coords)
        except RoutingUnavailable:
            if not allow_fallback:
                raise
            return self.fallback_route(coords)

    async def matrix_or_fallback(self, coords: list[Coordinate], allow_fallback: bool) -> MatrixResponse:
        try:
            return await self.matrix(coords)
        except RoutingUnavailable:
            if not allow_fallback:
                raise
            return self.fallback_matrix(coords)
