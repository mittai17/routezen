"""SQLAlchemy 2 models for Smart Travel & Logistics module."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, Numeric, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, WorkspaceScoped, new_id, utcnow
from app.db.types import UTCDateTime

Money = Numeric(12, 2)


class TravelTrip(WorkspaceScoped, Base):
    __tablename__ = "travel_trips"
    __table_args__ = (
        CheckConstraint("origin_lat BETWEEN -90 AND 90", name="ck_trips_orig_lat"),
        CheckConstraint("origin_lng BETWEEN -180 AND 180", name="ck_trips_orig_lng"),
        CheckConstraint("destination_lat BETWEEN -90 AND 90", name="ck_trips_dest_lat"),
        CheckConstraint("destination_lng BETWEEN -180 AND 180", name="ck_trips_dest_lng"),
        CheckConstraint("adults >= 1", name="ck_trips_adults"),
        Index("ix_travel_trips_ws_status", "workspace_id", "status"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    origin_name: Mapped[str] = mapped_column(String(200), nullable=False)
    origin_lat: Mapped[float] = mapped_column(Float, nullable=False)
    origin_lng: Mapped[float] = mapped_column(Float, nullable=False)
    destination_name: Mapped[str] = mapped_column(String(200), nullable=False)
    destination_lat: Mapped[float] = mapped_column(Float, nullable=False)
    destination_lng: Mapped[float] = mapped_column(Float, nullable=False)
    departure_date: Mapped[str | None] = mapped_column(String(50))
    return_date: Mapped[str | None] = mapped_column(String(50))
    is_one_way: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    adults: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    children: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    older_travellers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    travel_mode: Mapped[str] = mapped_column(String(30), default="car", nullable=False)
    vehicle_profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("vehicle_profiles.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text)

    preferences: Mapped[TravelPreferences | None] = relationship(
        "TravelPreferences", back_populates="trip", uselist=False, cascade="all, delete-orphan"
    )
    checkpoints: Mapped[list[TravelCheckpoint]] = relationship(
        "TravelCheckpoint", back_populates="trip", cascade="all, delete-orphan", order_by="TravelCheckpoint.sequence"
    )
    route_options: Mapped[list[TravelRouteOption]] = relationship(
        "TravelRouteOption", back_populates="trip", cascade="all, delete-orphan"
    )
    places: Mapped[list[TravelPlace]] = relationship(
        "TravelPlace", back_populates="trip", cascade="all, delete-orphan"
    )
    itinerary_days: Mapped[list[TravelItineraryDay]] = relationship(
        "TravelItineraryDay", back_populates="trip", cascade="all, delete-orphan", order_by="TravelItineraryDay.day_number"
    )


class TravelPreferences(Base):
    __tablename__ = "travel_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("travel_trips.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    pace: Mapped[str] = mapped_column(String(30), default="balanced", nullable=False)
    budget_category: Mapped[str] = mapped_column(String(30), default="mid_range", nullable=False)
    total_budget_inr: Mapped[float | None] = mapped_column(Float)
    accommodation_types: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    max_price_per_night: Mapped[float | None] = mapped_column(Float)
    food_preference: Mapped[str] = mapped_column(String(30), default="vegetarian", nullable=False)
    interests: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    max_drive_hours_per_day: Mapped[float] = mapped_column(Float, default=8.0, nullable=False)
    max_drive_km_per_day: Mapped[float | None] = mapped_column(Float)
    avoid_night_driving: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    meal_budget_per_person: Mapped[float | None] = mapped_column(Float)
    contingency_pct: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)

    trip: Mapped[TravelTrip] = relationship("TravelTrip", back_populates="preferences")


class TravelCheckpoint(Base):
    __tablename__ = "travel_checkpoints"
    __table_args__ = (
        Index("ix_travel_cp_trip_seq", "trip_id", "sequence"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("travel_trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    type: Mapped[str] = mapped_column(String(30), default="mandatory", nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    stay_overnight: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    planned_arrival: Mapped[str | None] = mapped_column(String(50))
    planned_departure: Mapped[str | None] = mapped_column(String(50))
    activity_duration_min: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    distance_from_prev_km: Mapped[float | None] = mapped_column(Float)
    duration_from_prev_min: Mapped[float | None] = mapped_column(Float)

    trip: Mapped[TravelTrip] = relationship("TravelTrip", back_populates="checkpoints")


class TravelRouteOption(Base):
    __tablename__ = "travel_route_options"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("travel_trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    total_distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    total_duration_min: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_days: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    estimated_fuel_cost_inr: Mapped[float | None] = mapped_column(Float)
    estimated_total_cost_inr: Mapped[float | None] = mapped_column(Float)
    geometry: Mapped[list[list[float]]] = mapped_column(JSON, default=list, nullable=False)
    checkpoints: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    data_source: Mapped[str] = mapped_column(String(50), default="osrm", nullable=False)
    fallback_estimate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))

    trip: Mapped[TravelTrip] = relationship("TravelTrip", back_populates="route_options")


class TravelPlace(Base):
    __tablename__ = "travel_places"
    __table_args__ = (
        Index("ix_travel_places_trip_cat", "trip_id", "category"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("travel_trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    checkpoint_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)  # stay, restaurant, attraction
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[float | None] = mapped_column(Float)
    review_count: Mapped[int | None] = mapped_column(Integer)
    price_min: Mapped[float | None] = mapped_column(Float)
    price_max: Mapped[float | None] = mapped_column(Float)
    price_label: Mapped[str | None] = mapped_column(String(100))
    amenities: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    opening_hours: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(50), default="osm", nullable=False)
    last_checked: Mapped[datetime | None] = mapped_column(UTCDateTime, default=utcnow)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    distance_from_route_km: Mapped[float | None] = mapped_column(Float)
    detour_km: Mapped[float | None] = mapped_column(Float)
    estimated_visit_min: Mapped[int | None] = mapped_column(Integer)
    entry_price_inr: Mapped[float | None] = mapped_column(Float)

    trip: Mapped[TravelTrip] = relationship("TravelTrip", back_populates="places")


class TravelItineraryDay(Base):
    __tablename__ = "travel_itinerary_days"
    __table_args__ = (
        Index("ix_travel_itinerary_day", "trip_id", "day_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("travel_trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[str | None] = mapped_column(String(50))
    start_checkpoint_id: Mapped[str | None] = mapped_column(String(36))
    end_checkpoint_id: Mapped[str | None] = mapped_column(String(36))
    drive_distance_km: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    drive_duration_min: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    estimated_cost_inr: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    trip: Mapped[TravelTrip] = relationship("TravelTrip", back_populates="itinerary_days")
