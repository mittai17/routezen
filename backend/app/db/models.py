"""SQLAlchemy 2 models. Money = Numeric(12,2); timestamps are tz-aware UTC."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, Numeric, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, WorkspaceScoped, utcnow
from app.db.types import UTCDateTime

Money = Numeric(12, 2)


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)


class Location(WorkspaceScoped, Base):
    __tablename__ = "locations"
    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_locations_lat"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_locations_lng"),
        Index("ix_locations_ws_type", "workspace_id", "type"),
        Index("ix_locations_ws_name", "workspace_id", "name"),
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="stop")
    zone: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)


class Package(WorkspaceScoped, Base):
    __tablename__ = "packages"
    __table_args__ = (
        CheckConstraint("weight_kg >= 0", name="ck_packages_weight"),
        Index("ix_packages_ws_status", "workspace_id", "status"),
        Index("ix_packages_ws_reference", "workspace_id", "reference"),
        Index("ix_packages_ws_deadline", "workspace_id", "deadline"),
    )
    reference: Mapped[str] = mapped_column(String(100), nullable=False)
    recipient: Mapped[str | None] = mapped_column(String(200))
    location_id: Mapped[str | None] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"), index=True)
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    length_cm: Mapped[float | None] = mapped_column(Float)
    width_cm: Mapped[float | None] = mapped_column(Float)
    height_cm: Mapped[float | None] = mapped_column(Float)
    volume_m3: Mapped[float | None] = mapped_column(Float)
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    handling: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    window_start: Mapped[datetime | None] = mapped_column(UTCDateTime)
    window_end: Mapped[datetime | None] = mapped_column(UTCDateTime)
    deadline: Mapped[datetime | None] = mapped_column(UTCDateTime)
    service_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=5)
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="delivery")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    notes: Mapped[str | None] = mapped_column(Text)


class VehicleProfile(WorkspaceScoped, Base):
    __tablename__ = "vehicle_profiles"
    __table_args__ = (
        CheckConstraint("payload_kg > 0", name="ck_vehicles_payload"),
        CheckConstraint("volume_m3 > 0", name="ck_vehicles_volume"),
        CheckConstraint("efficiency_value > 0", name="ck_vehicles_efficiency"),
        Index("ix_vehicles_ws_energy", "workspace_id", "energy_type"),
        Index("ix_vehicles_ws_available", "workspace_id", "available"),
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="van")
    payload_kg: Mapped[float] = mapped_column(Float, nullable=False)
    volume_m3: Mapped[float] = mapped_column(Float, nullable=False)
    energy_type: Mapped[str] = mapped_column(String(20), nullable=False)
    efficiency_value: Mapped[float] = mapped_column(Float, nullable=False)
    efficiency_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    energy_price: Mapped[Decimal] = mapped_column(Money, nullable=False, default=0)
    fixed_cost_per_delivery: Mapped[Decimal] = mapped_column(Money, nullable=False, default=0)
    operating_cost_per_km: Mapped[Decimal] = mapped_column(Money, nullable=False, default=0)
    avg_speed_kmph: Mapped[float] = mapped_column(Float, nullable=False, default=25)
    emissions_g_per_km: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    range_km: Mapped[float | None] = mapped_column(Float)
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    source: Mapped[str] = mapped_column(Text, nullable=False, default="")
    verification: Mapped[str] = mapped_column(String(20), nullable=False, default="assumed")


class DeliveryPlan(WorkspaceScoped, Base):
    __tablename__ = "delivery_plans"
    __table_args__ = (Index("ix_plans_ws_status", "workspace_id", "status"),)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    depot_location_id: Mapped[str | None] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"))
    start_time: Mapped[datetime | None] = mapped_column(UTCDateTime)
    total_distance_km: Mapped[float | None] = mapped_column(Float)
    total_duration_min: Mapped[float | None] = mapped_column(Float)
    total_cost: Mapped[Decimal | None] = mapped_column(Money)
    total_emissions_g: Mapped[float | None] = mapped_column(Float)
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    notes: Mapped[str | None] = mapped_column(Text)
    assignments: Mapped[list["PlanAssignment"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanAssignment.sequence", lazy="selectin"
    )


class PlanAssignment(WorkspaceScoped, Base):
    __tablename__ = "plan_assignments"
    __table_args__ = (
        UniqueConstraint("plan_id", "package_id", name="uq_assignment_plan_package"),
        Index("ix_assignments_plan_vehicle", "plan_id", "vehicle_id"),
    )
    plan_id: Mapped[str] = mapped_column(ForeignKey("delivery_plans.id", ondelete="CASCADE"), nullable=False)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicle_profiles.id", ondelete="RESTRICT"), nullable=False)
    package_id: Mapped[str] = mapped_column(ForeignKey("packages.id", ondelete="CASCADE"), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    eta: Mapped[datetime | None] = mapped_column(UTCDateTime)
    distance_km: Mapped[float | None] = mapped_column(Float)
    cost: Mapped[Decimal | None] = mapped_column(Money)
    plan: Mapped[DeliveryPlan] = relationship(back_populates="assignments")


class OptimizationRun(WorkspaceScoped, Base):
    """Persistent shape for runs. The live run store is in-memory (see services/run_store.py)."""

    __tablename__ = "optimization_runs"
    __table_args__ = (Index("ix_runs_ws_kind_status", "workspace_id", "kind", "status"),)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    plan_id: Mapped[str | None] = mapped_column(ForeignKey("delivery_plans.id", ondelete="SET NULL"))
    request: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    runtime_ms: Mapped[float | None] = mapped_column(Float)


class Scenario(WorkspaceScoped, Base):
    __tablename__ = "scenarios"
    __table_args__ = (Index("ix_scenarios_ws_name", "workspace_id", "name"),)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="recommendation")
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    last_run_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class DeliveryEvent(WorkspaceScoped, Base):
    __tablename__ = "delivery_events"
    __table_args__ = (
        Index("ix_events_ws_time", "workspace_id", "occurred_at"),
        Index("ix_events_plan", "plan_id"),
    )
    plan_id: Mapped[str | None] = mapped_column(ForeignKey("delivery_plans.id", ondelete="CASCADE"))
    package_id: Mapped[str | None] = mapped_column(ForeignKey("packages.id", ondelete="SET NULL"))
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicle_profiles.id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)


class Setting(Base):
    __tablename__ = "settings"
    workspace_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow, nullable=False)
