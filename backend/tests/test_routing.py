import httpx
import pytest

from app.schemas.common import Coordinate
from app.services.routing import (
    InvalidCoordinates, OSRMClient, RoutingUnavailable, TTLCache, haversine_km, validate_coordinates,
)

A, B = Coordinate(lat=13.0, lng=80.0), Coordinate(lat=13.1, lng=80.1)


def client_with(handler, **kw):
    return OSRMClient("http://osrm.test", transport=httpx.MockTransport(handler), **kw)


async def test_route_parses_geometry_lat_lng_order():
    def h(req):
        assert "80.000000,13.000000;80.100000,13.100000" in str(req.url)
        return httpx.Response(200, json={"code": "Ok", "routes": [{
            "distance": 15000, "duration": 1200, "legs": [{"distance": 15000, "duration": 1200}],
            "geometry": {"coordinates": [[80.0, 13.0], [80.05, 13.02], [80.1, 13.1]]}}]})
    r = await client_with(h).route([A, B])
    assert r.provider == "osrm" and r.distance_km == 15 and r.duration_min == 20
    assert r.geometry[0] == [13.0, 80.0] and not r.fallback_estimate


async def test_cache_avoids_second_request():
    calls = []

    def h(req):
        calls.append(1)
        return httpx.Response(200, json={"code": "Ok", "distances": [[0, 1000], [1000, 0]], "durations": [[0, 60], [60, 0]]})
    c = client_with(h)
    m1, m2 = await c.matrix([A, B]), await c.matrix([A, B])
    assert m1 == m2 and len(calls) == 1 and m1.distance_km[0][1] == 1.0


def test_ttl_cache_expiry_and_eviction():
    t = [0.0]
    c = TTLCache(10, 2, clock=lambda: t[0])
    c.set("a", 1)
    assert c.get("a") == 1
    t[0] = 11
    assert c.get("a") is None
    c.set("a", 1), c.set("b", 2), c.set("c", 3)
    assert len(c) == 2 and c.get("a") is None


@pytest.mark.parametrize("handler", [
    lambda r: httpx.Response(500),
    lambda r: httpx.Response(200, text="not json"),
    lambda r: httpx.Response(200, json={"code": "NoRoute"}),
    lambda r: httpx.Response(200, json={"code": "Ok", "routes": []}),
    lambda r: (_ for _ in ()).throw(httpx.ConnectTimeout("boom")),
])
async def test_route_errors_raise_routing_unavailable(handler):
    with pytest.raises(RoutingUnavailable):
        await client_with(handler).route([A, B])


async def test_matrix_with_null_cells_is_unavailable():
    h = lambda r: httpx.Response(200, json={"code": "Ok", "distances": [[0, None], [1, 0]], "durations": [[0, None], [1, 0]]})  # noqa: E731
    with pytest.raises(RoutingUnavailable):
        await client_with(h).matrix([A, B])


def test_coordinate_validation():
    with pytest.raises(InvalidCoordinates):
        validate_coordinates([A])
    with pytest.raises(InvalidCoordinates):
        validate_coordinates([A] * 101)
    with pytest.raises(InvalidCoordinates):
        validate_coordinates([A, Coordinate.model_construct(lat=float("nan"), lng=0)])


async def test_fallback_only_when_explicitly_allowed_and_labelled():
    c = client_with(lambda r: httpx.Response(503))
    with pytest.raises(RoutingUnavailable):
        await c.route_or_fallback([A, B], allow_fallback=False)
    r = await c.route_or_fallback([A, B], allow_fallback=True)
    assert r.provider == "fallback_estimate" and r.fallback_estimate and r.geometry == [] and "FALLBACK" in r.note
    assert r.distance_km == pytest.approx(haversine_km(A, B))
    m = await c.matrix_or_fallback([A, B], True)
    assert m.fallback_estimate and m.distance_km[0][0] == 0


def test_haversine_known_distance():
    assert haversine_km(Coordinate(lat=0, lng=0), Coordinate(lat=0, lng=1)) == pytest.approx(111.195, abs=0.01)


def test_api_routing_unavailable_is_503_and_fallback_flagged(api, client):
    from app.api import deps
    down = client_with(lambda r: httpx.Response(503))
    client.app.dependency_overrides[deps.get_routing] = lambda: down
    body = {"coordinates": [{"lat": 13, "lng": 80}, {"lat": 13.1, "lng": 80.1}]}
    r = api.post("/routing/route", json=body)
    assert r.status_code == 503 and r.json()["detail"]["code"] == "routing_unavailable"
    r = api.post("/routing/route", json={**body, "allow_fallback_estimate": True})
    assert r.status_code == 200 and r.json()["fallback_estimate"] is True and r.json()["geometry"] == []
    assert api.get("/routing/status").json()["reachable"] is False
    r = api.post("/recommendations", json={"packages": [{"weight_kg": 1, "latitude": 13.1, "longitude": 80}],
                                           "depot": {"latitude": 13, "longitude": 80}})
    assert r.status_code == 503


def test_api_routing_validation(api):
    assert api.post("/routing/route", json={"coordinates": [{"lat": 13, "lng": 80}]}).status_code == 422
    assert api.post("/routing/route", json={"coordinates": [{"lat": 95, "lng": 80}, {"lat": 1, "lng": 1}]}).status_code == 422
    r = api.post("/routing/route", json={"coordinates": [{"lat": 13, "lng": 80}, {"lat": 13.1, "lng": 80}]})
    assert r.status_code == 200 and r.json()["provider"] == "osrm" and r.json()["geometry"]
    m = api.post("/routing/matrix", json={"coordinates": [{"lat": 13, "lng": 80}, {"lat": 13.1, "lng": 80}]}).json()
    assert m["distance_km"][0][1] == pytest.approx(10.0)
