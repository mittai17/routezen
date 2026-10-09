"""Pydantic schemas for Smart Travel & Logistics."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class TravelPreferencesBase(BaseModel):
    pace: str = "balanced"
    budget_category: str = "mid_range"
    total_budget_inr: float | None = 80000.0
    accommodation_types: list[str] = Field(default_factory=lambda: ["mid_hotel", "homestay"])
    max_price_per_night: float | None = 2500.0
    food_preference: str = "vegetarian"
    interests: list[str] = Field(default_factory=lambda: ["nature", "historical_places", "local_food"])
    max_drive_hours_per_day: float = 8.0
    max_drive_km_per_day: float | None = 400.0
    avoid_night_driving: bool = True
    meal_budget_per_person: float | None = 400.0
    contingency_pct: float = 10.0


class TravelPreferencesCreate(TravelPreferencesBase):
    pass


class TravelPreferencesUpdate(BaseModel):
    pace: str | None = None
    budget_category: str | None = None
    total_budget_inr: float | None = None
    accommodation_types: list[str] | None = None
    max_price_per_night: float | None = None
    food_preference: str | None = None
    interests: list[str] | None = None
    max_drive_hours_per_day: float | None = None
    max_drive_km_per_day: float | None = None
    avoid_night_driving: bool | None = None
    meal_budget_per_person: float | None = None
    contingency_pct: float | None = None


class TravelPreferencesOut(TravelPreferencesBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    trip_id: str


class TravelCheckpointBase(BaseModel):
    sequence: int
    name: str
    address: str | None = None
    lat: float
    lng: float
    type: str = "mandatory"
    is_mandatory: bool = True
    stay_overnight: bool = False
    planned_arrival: str | None = None
    planned_departure: str | None = None
    activity_duration_min: int = 60
    notes: str | None = None
    distance_from_prev_km: float | None = None
    duration_from_prev_min: float | None = None


class TravelCheckpointCreate(TravelCheckpointBase):
    pass


class TravelCheckpointUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    type: str | None = None
    is_mandatory: bool | None = None
    stay_overnight: bool | None = None
    planned_arrival: str | None = None
    planned_departure: str | None = None
    activity_duration_min: int | None = None
    notes: str | None = None


class TravelCheckpointOut(TravelCheckpointBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    trip_id: str


class TravelTripBase(BaseModel):
    name: str
    status: str = "draft"
    origin_name: str
    origin_lat: float
    origin_lng: float
    destination_name: str
    destination_lat: float
    destination_lng: float
    departure_date: str | None = None
    return_date: str | None = None
    is_one_way: bool = True
    adults: int = 2
    children: int = 0
    older_travellers: int = 0
    travel_mode: str = "car"
    vehicle_profile_id: str | None = None
    notes: str | None = None


class TravelTripCreate(TravelTripBase):
    preferences: TravelPreferencesCreate | None = None
    checkpoints: list[TravelCheckpointCreate] | None = None


class TravelTripUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    origin_name: str | None = None
    origin_lat: float | None = None
    origin_lng: float | None = None
    destination_name: str | None = None
    destination_lat: float | None = None
    destination_lng: float | None = None
    departure_date: str | None = None
    return_date: str | None = None
    is_one_way: bool | None = None
    adults: int | None = None
    children: int | None = None
    older_travellers: int | None = None
    travel_mode: str | None = None
    vehicle_profile_id: str | None = None
    notes: str | None = None


class TravelTripOut(TravelTripBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workspace_id: str
    created_at: datetime
    updated_at: datetime


class TravelRouteOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    trip_id: str
    label: str
    description: str
    total_distance_km: float
    total_duration_min: float
    estimated_days: int
    estimated_fuel_cost_inr: float | None = None
    estimated_total_cost_inr: float | None = None
    geometry: list[list[float]]
    checkpoints: list[str]
    is_selected: bool
    data_source: str
    fallback_estimate: bool
    note: str | None = None


class TravelPlaceBase(BaseModel):
    checkpoint_id: str | None = None
    category: str
    name: str
    address: str | None = None
    lat: float
    lng: float
    description: str | None = None
    rating: float | None = None
    review_count: int | None = None
    price_min: float | None = None
    price_max: float | None = None
    price_label: str | None = None
    amenities: list[str] = Field(default_factory=list)
    opening_hours: str | None = None
    website: str | None = None
    source: str = "osm"
    is_selected: bool = False
    distance_from_route_km: float | None = None
    detour_km: float | None = None
    estimated_visit_min: int | None = None
    entry_price_inr: float | None = None


class TravelPlaceCreate(TravelPlaceBase):
    pass


class TravelPlaceOut(TravelPlaceBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    trip_id: str
    last_checked: datetime | None = None


class ItineraryItem(BaseModel):
    id: str
    sequence: int
    type: str  # drive, stay, meal, attraction
    label: str
    place_id: str | None = None
    checkpoint_id: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    duration_min: int
    cost_inr: float
    notes: str | None = None


class TravelItineraryDayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    trip_id: str
    day_number: int
    date: str | None = None
    start_checkpoint_id: str | None = None
    end_checkpoint_id: str | None = None
    drive_distance_km: float
    drive_duration_min: float
    estimated_cost_inr: float
    notes: str | None = None
    items: list[ItineraryItem] = Field(default_factory=list)


class TripBudgetOut(BaseModel):
    trip_id: str
    target_budget_inr: float | None = None
    estimated_total_inr: float
    fuel_inr: float
    accommodation_inr: float
    meals_inr: float
    attractions_inr: float
    tolls_inr: float | None = None
    parking_inr: float
    other_inr: float
    contingency_inr: float
    unknown_items: list[str]
    over_budget: bool
    day_totals: list[dict[str, Any]]
    assumptions: list[str]
    data_source: str
