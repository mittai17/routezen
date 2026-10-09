from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Coordinate


class CoordinatesRequest(BaseModel):
    coordinates: list[Coordinate] = Field(min_length=2, max_length=100)
    allow_fallback_estimate: bool = False


class Leg(BaseModel):
    distance_km: float
    duration_min: float


class RouteResponse(BaseModel):
    distance_km: float
    duration_min: float
    geometry: list[list[float]]  # [[lat, lng], ...] road geometry from OSRM; empty for fallback
    legs: list[Leg]
    provider: Literal["osrm", "fallback_estimate"]
    fallback_estimate: bool = False
    note: str | None = None


class MatrixResponse(BaseModel):
    distance_km: list[list[float]]
    duration_min: list[list[float]]
    provider: Literal["osrm", "fallback_estimate"]
    fallback_estimate: bool = False
    note: str | None = None


class RoutingStatus(BaseModel):
    provider: str
    base_url: str
    reachable: bool
    latency_ms: float | None = None
    error: str | None = None
