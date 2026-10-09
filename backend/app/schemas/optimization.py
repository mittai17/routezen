from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import AwareDatetime, Latitude, Longitude

NonNegF = Annotated[float, Field(ge=0, allow_inf_nan=False)]


class OptWeights(BaseModel):
    distance: NonNegF = 0.4
    time: NonNegF = 0.3
    cost: NonNegF = 0.2
    emissions: NonNegF = 0.1

    @model_validator(mode="after")
    def _sum(self) -> "OptWeights":
        if self.distance + self.time + self.cost + self.emissions <= 0:
            raise ValueError("at least one objective weight must be > 0")
        return self


class OptDepot(BaseModel):
    latitude: Latitude
    longitude: Longitude
    name: str = "Depot"


class OptStop(BaseModel):
    id: str
    latitude: Latitude
    longitude: Longitude
    weight_kg: NonNegF = 0
    volume_m3: NonNegF = 0
    service_minutes: NonNegF = 5
    # minutes since route start; None = unconstrained
    window_start_min: NonNegF | None = None
    window_end_min: NonNegF | None = None

    @model_validator(mode="after")
    def _w(self) -> "OptStop":
        if (
            self.window_start_min is not None
            and self.window_end_min is not None
            and self.window_end_min < self.window_start_min
        ):
            raise ValueError("window_end_min must be >= window_start_min")
        return self


class OptVehicle(BaseModel):
    vehicle_id: str
    name: str = ""
    payload_kg: Annotated[float, Field(gt=0)]
    volume_m3: Annotated[float, Field(gt=0)]
    available: bool = True
    max_stops: Annotated[int, Field(ge=1, le=500)] = 50
    cost_per_km: NonNegF = 0  # all-in per-km cost (energy + operating) used for the cost objective
    fixed_cost: NonNegF = 0
    emissions_g_per_km: NonNegF = 0


class Matrices(BaseModel):
    """Optional precomputed matrices over [depot, stop_1..stop_n]; skips routing."""

    distance_km: list[list[float]]
    duration_min: list[list[float]]


class OptimizationRequest(BaseModel):
    depot: OptDepot | None = None
    depot_location_id: str | None = None
    stops: list[OptStop] = Field(default_factory=list, max_length=200)
    package_ids: list[str] = Field(default_factory=list, max_length=200)
    vehicles: list[OptVehicle] = Field(default_factory=list, max_length=50)
    vehicle_ids: list[str] = Field(default_factory=list, max_length=50)
    start_time: AwareDatetime | None = None
    weights: OptWeights = Field(default_factory=OptWeights)
    return_to_depot: bool = True
    time_limit_s: Annotated[int, Field(ge=1, le=120)] | None = None
    horizon_min: Annotated[float, Field(gt=0, le=10080)] = 1440
    matrices: Matrices | None = None
    allow_fallback_estimate: bool = False


class StopVisit(BaseModel):
    stop_id: str
    arrival_min: float
    departure_min: float
    cumulative_distance_km: float
    load_kg: float
    load_m3: float


class VehicleRoute(BaseModel):
    vehicle_id: str
    stops: list[StopVisit]
    distance_km: float
    duration_min: float
    load_kg: float
    load_m3: float
    cost: float
    emissions_g: float


class Unassigned(BaseModel):
    stop_id: str
    reason: str


class OptimizationResult(BaseModel):
    solver: Literal["ortools_vrp"] = "ortools_vrp"
    status: Literal["solved", "partial", "infeasible", "empty", "error"]
    routes: list[VehicleRoute] = Field(default_factory=list)
    unassigned: list[Unassigned] = Field(default_factory=list)
    total_distance_km: float = 0
    total_duration_min: float = 0
    total_cost: float = 0
    total_emissions_g: float = 0
    objective: float | None = None
    runtime_ms: float = 0
    time_limit_s: int = 0
    distance_source: str = "provided"
    fallback_estimate: bool = False
    notes: list[str] = Field(default_factory=list)


class QuantumRequest(BaseModel):
    depot: OptDepot | None = None
    depot_location_id: str | None = None
    stops: list[OptStop] = Field(default_factory=list, max_length=10)
    package_ids: list[str] = Field(default_factory=list, max_length=10)
    vehicle: OptVehicle | None = None
    vehicle_id: str | None = None
    matrices: Matrices | None = None
    objective: Literal["distance", "duration"] = "distance"
    return_to_depot: bool = True
    reps: Annotated[int, Field(ge=1, le=3)] = 1
    max_iterations: Annotated[int, Field(ge=1, le=300)] = 60
    shots: Annotated[int, Field(ge=16, le=8192)] = 1024
    seed: int | None = 7
    timeout_s: Annotated[float, Field(gt=0, le=600)] | None = None
    allow_fallback_estimate: bool = False


class QuantumResult(BaseModel):
    solver: Literal["qaoa_aer_simulation"] = "qaoa_aer_simulation"
    simulation: bool = True
    disclaimer: str = (
        "Result from a classical statevector SIMULATION of QAOA (Qiskit Aer). "
        "No quantum hardware was used and no quantum advantage is claimed."
    )
    status: Literal["solved", "no_feasible_sample", "infeasible", "error"]
    n_stops: int
    n_qubits: int
    reps: int
    iterations: int = 0
    order: list[str] = Field(default_factory=list)  # stop ids in visiting order
    cost: float | None = None  # in matrix units (km or min)
    feasible: bool = False
    feasibility_issues: list[str] = Field(default_factory=list)
    feasible_probability: float = 0
    shots: int = 0
    brute_force_order: list[str] = Field(default_factory=list)
    brute_force_cost: float | None = None
    gap_vs_brute_force_pct: float | None = None
    matches_brute_force: bool | None = None
    classical_ortools_cost: float | None = None
    runtime_ms: float = 0
    objective: str = "distance"
    distance_source: str = "provided"
    fallback_estimate: bool = False


RunStatus = Literal["queued", "running", "succeeded", "failed", "cancelled", "timed_out"]


class RunRecord(BaseModel):
    id: str
    kind: Literal["classical", "quantum"]
    status: RunStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    request: dict
    result: dict | None = None
    error: str | None = None
