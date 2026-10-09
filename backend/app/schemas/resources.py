"""Pydantic v2 schemas for CRUD resources (snake_case, matches docs/ARCHITECTURE.md)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import AwareDatetime, Latitude, Longitude, ORMModel

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
NonNeg = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Pos = Annotated[float, Field(gt=0, allow_inf_nan=False)]
Name = Annotated[str, Field(min_length=1, max_length=200)]


class Stamped(ORMModel):
    id: str
    created_at: datetime
    updated_at: datetime


# ---- Locations
class LocationIn(BaseModel):
    name: Name
    address: str | None = Field(default=None, max_length=500)
    latitude: Latitude
    longitude: Longitude
    type: Literal["depot", "stop", "warehouse"] = "stop"
    zone: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class LocationOut(LocationIn, Stamped):
    pass


# ---- Packages
class PackageIn(BaseModel):
    reference: Name
    recipient: str | None = Field(default=None, max_length=200)
    location_id: str | None = None
    address: str | None = Field(default=None, max_length=500)
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    weight_kg: NonNeg = 0
    length_cm: Pos | None = None
    width_cm: Pos | None = None
    height_cm: Pos | None = None
    volume_m3: NonNeg | None = None
    priority: Literal["low", "medium", "high"] = "medium"
    handling: list[str] = Field(default_factory=list, max_length=20)
    window_start: AwareDatetime | None = None
    window_end: AwareDatetime | None = None
    deadline: AwareDatetime | None = None
    service_minutes: NonNeg = 5
    kind: Literal["delivery", "pickup"] = "delivery"
    status: Literal["pending", "assigned", "in_transit", "delivered", "failed", "cancelled"] = "pending"
    notes: str | None = None

    @model_validator(mode="after")
    def _check(self) -> "PackageIn":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        dims = [self.length_cm, self.width_cm, self.height_cm]
        if any(d is not None for d in dims) and not all(d is not None for d in dims):
            raise ValueError("length_cm, width_cm and height_cm must be provided together")
        if self.volume_m3 is None and all(d is not None for d in dims):
            self.volume_m3 = round(self.length_cm * self.width_cm * self.height_cm / 1_000_000, 6)  # type: ignore[operator]
        if self.window_start and self.window_end and self.window_end < self.window_start:
            raise ValueError("window_end must not be before window_start")
        return self

    @field_validator("handling")
    @classmethod
    def _handling(cls, v: list[str]) -> list[str]:
        return [h.strip().lower() for h in v if h.strip()]


class PackageOut(PackageIn, Stamped):
    pass


# ---- Vehicles
class VehicleIn(BaseModel):
    name: Name
    category: str = Field(default="van", max_length=50)
    payload_kg: Pos
    volume_m3: Pos
    energy_type: Literal["petrol", "diesel", "cng", "electric"]
    efficiency_value: Pos
    efficiency_unit: Literal["km_per_l", "km_per_kwh"]
    energy_price: Money = Decimal("0")
    fixed_cost_per_delivery: Money = Decimal("0")
    operating_cost_per_km: Money = Decimal("0")
    avg_speed_kmph: Pos = 25
    emissions_g_per_km: NonNeg = 0
    range_km: Pos | None = None
    available: bool = True
    source: str = ""
    verification: Literal["measured", "external", "user", "assumed"] = "assumed"

    @model_validator(mode="after")
    def _units(self) -> "VehicleIn":
        if (self.energy_type == "electric") != (self.efficiency_unit == "km_per_kwh"):
            raise ValueError("electric vehicles must use km_per_kwh; fuel vehicles must use km_per_l")
        return self


class VehicleOut(VehicleIn, Stamped):
    pass


# ---- Plans
class AssignmentIn(BaseModel):
    vehicle_id: str
    package_id: str
    sequence: int = Field(default=0, ge=0)
    eta: AwareDatetime | None = None
    distance_km: NonNeg | None = None
    cost: Money | None = None


class AssignmentOut(AssignmentIn, ORMModel):
    id: str


class PlanIn(BaseModel):
    name: Name
    status: Literal["draft", "optimized", "dispatched", "completed", "cancelled"] = "draft"
    depot_location_id: str | None = None
    start_time: AwareDatetime | None = None
    total_distance_km: NonNeg | None = None
    total_duration_min: NonNeg | None = None
    total_cost: Money | None = None
    total_emissions_g: NonNeg | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None
    assignments: list[AssignmentIn] = Field(default_factory=list, max_length=2000)

    @model_validator(mode="after")
    def _unique(self) -> "PlanIn":
        ids = [a.package_id for a in self.assignments]
        if len(ids) != len(set(ids)):
            raise ValueError("a package may be assigned only once per plan")
        return self


class PlanOut(PlanIn, Stamped):
    assignments: list[AssignmentOut] = Field(default_factory=list)


class PlanValidateIn(BaseModel):
    assignments: list[AssignmentIn] = Field(max_length=2000)


class PlanValidateOut(BaseModel):
    valid: bool
    issues: list[str]
    per_vehicle: list[dict[str, Any]]


# ---- Scenarios
class ScenarioIn(BaseModel):
    name: Name
    description: str | None = None
    kind: Literal["recommendation", "classical", "quantum"] = "recommendation"
    config: dict[str, Any] = Field(default_factory=dict)


class ScenarioOut(ScenarioIn, Stamped):
    result: dict[str, Any] | None = None
    last_run_at: datetime | None = None


class ScenarioCompareIn(BaseModel):
    scenario_ids: list[str] = Field(min_length=2, max_length=10)


# ---- Events
class EventIn(BaseModel):
    plan_id: str | None = None
    package_id: str | None = None
    vehicle_id: str | None = None
    type: Annotated[str, Field(min_length=1, max_length=40)]
    message: str | None = None
    occurred_at: AwareDatetime | None = None
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    payload: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _pair(self) -> "EventIn":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class EventOut(EventIn, Stamped):
    occurred_at: datetime


# ---- Settings
class SettingsPayload(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)
