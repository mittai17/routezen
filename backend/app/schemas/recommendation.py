from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import AwareDatetime, Latitude, Longitude


class Weights(BaseModel):
    """Relative scoring weights (need not sum to 1; they are normalised)."""

    cost: Annotated[float, Field(ge=0)] = 0.5
    time: Annotated[float, Field(ge=0)] = 0.25
    emissions: Annotated[float, Field(ge=0)] = 0.15
    utilisation: Annotated[float, Field(ge=0)] = 0.10

    @model_validator(mode="after")
    def _positive_sum(self) -> "Weights":
        if self.cost + self.time + self.emissions + self.utilisation <= 0:
            raise ValueError("at least one weight must be > 0")
        return self


class Preferences(BaseModel):
    weights: Weights = Field(default_factory=Weights)
    departure_time: AwareDatetime | None = None
    round_trip: bool = False
    require_deadline: bool = True
    allow_fallback_estimate: bool = False
    top_n: Annotated[int, Field(ge=1, le=20)] = 5


class PackageInput(BaseModel):
    package_id: str | None = None
    weight_kg: Annotated[float, Field(ge=0, allow_inf_nan=False)]
    volume_m3: Annotated[float, Field(ge=0, allow_inf_nan=False)] = 0
    latitude: Latitude
    longitude: Longitude
    deadline: AwareDatetime | None = None
    service_minutes: Annotated[float, Field(ge=0)] = 5


class DepotInput(BaseModel):
    latitude: Latitude
    longitude: Longitude


class VehicleSpec(BaseModel):
    """Engine-side vehicle view (decoupled from ORM)."""

    vehicle_id: str
    name: str
    category: str = "van"
    payload_kg: float
    volume_m3: float
    energy_type: Literal["petrol", "diesel", "cng", "electric"]
    efficiency_value: float
    efficiency_unit: Literal["km_per_l", "km_per_kwh"]
    energy_price: Decimal
    fixed_cost_per_delivery: Decimal = Decimal("0")
    operating_cost_per_km: Decimal = Decimal("0")
    avg_speed_kmph: float = 25
    emissions_g_per_km: float = 0
    range_km: float | None = None
    available: bool = True
    verification: str = "assumed"


class RecommendationRequest(BaseModel):
    package: PackageInput | None = None
    packages: list[PackageInput] = Field(default_factory=list, max_length=200)
    package_ids: list[str] = Field(default_factory=list, max_length=200)
    depot: DepotInput | None = None
    depot_location_id: str | None = None
    preferences: Preferences = Field(default_factory=Preferences)
    vehicle_ids: list[str] | None = None


class VehicleOption(BaseModel):
    vehicle_id: str
    name: str
    category: str
    verification: str
    energy_used: float
    energy_unit: Literal["L", "kWh"]
    energy_cost: Decimal
    operating_cost: Decimal
    variable_cost: Decimal  # energy_cost + operating_cost (no double counting; fixed is separate)
    fixed_cost: Decimal
    total_cost: Decimal
    cost_per_km: Decimal
    travel_minutes: float
    eta: datetime | None = None
    deadline_slack_min: float | None = None
    emissions_g: float
    payload_utilisation: float
    volume_utilisation: float
    deadline_feasible: bool
    score: float


class Ineligible(BaseModel):
    vehicle_id: str
    name: str
    reasons: list[str]


class PackageRecommendation(BaseModel):
    package_id: str | None
    recommended: VehicleOption | None
    alternatives: list[VehicleOption]
    ineligible: list[Ineligible]
    distance_km: float
    billed_distance_km: float
    duration_min: float
    distance_source: Literal["osrm", "fallback_estimate", "provided"]
    fallback_estimate: bool = False
    explanation: str
    assumptions: list[str]
