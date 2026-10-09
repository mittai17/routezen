"""Repository for Smart Travel entities."""
from __future__ import annotations

from typing import Any
from sqlalchemy import asc, delete, select
from sqlalchemy.orm import Session, selectinload

from app.db.travel_models import (
    TravelTrip,
    TravelPreferences,
    TravelCheckpoint,
    TravelRouteOption,
    TravelPlace,
    TravelItineraryDay,
)
from app.repositories.base import ensure_workspace


class TravelRepository:
    def __init__(self, session: Session, workspace_id: str):
        self.s = session
        self.ws = workspace_id

    # ── Trip CRUD ──
    def list_trips(self) -> list[TravelTrip]:
        stmt = (
            select(TravelTrip)
            .where(TravelTrip.workspace_id == self.ws)
            .order_by(TravelTrip.created_at.desc())
        )
        return list(self.s.scalars(stmt))

    def get_trip(self, trip_id: str) -> TravelTrip | None:
        stmt = (
            select(TravelTrip)
            .where(TravelTrip.workspace_id == self.ws, TravelTrip.id == trip_id)
            .options(
                selectinload(TravelTrip.preferences),
                selectinload(TravelTrip.checkpoints),
                selectinload(TravelTrip.route_options),
                selectinload(TravelTrip.itinerary_days),
            )
        )
        return self.s.scalar(stmt)

    def create_trip(self, data: dict[str, Any]) -> TravelTrip:
        ensure_workspace(self.s, self.ws)
        prefs_data = data.pop("preferences", None)
        cps_data = data.pop("checkpoints", None)

        trip = TravelTrip(workspace_id=self.ws, **data)
        self.s.add(trip)
        self.s.flush()

        if prefs_data:
            prefs = TravelPreferences(trip_id=trip.id, **prefs_data)
            self.s.add(prefs)
        else:
            prefs = TravelPreferences(trip_id=trip.id)
            self.s.add(prefs)

        if cps_data:
            for idx, cp in enumerate(cps_data):
                cp_dict = dict(cp)
                if "sequence" not in cp_dict or cp_dict["sequence"] is None:
                    cp_dict["sequence"] = idx
                cp_obj = TravelCheckpoint(trip_id=trip.id, **cp_dict)
                self.s.add(cp_obj)
        else:
            if trip.origin_lat or trip.origin_lng or trip.destination_lat or trip.destination_lng:
                self.s.add(
                    TravelCheckpoint(
                        trip_id=trip.id,
                        sequence=0,
                        name=trip.origin_name,
                        lat=trip.origin_lat,
                        lng=trip.origin_lng,
                        type="origin",
                        is_mandatory=True,
                        stay_overnight=False,
                    )
                )
                self.s.add(
                    TravelCheckpoint(
                        trip_id=trip.id,
                        sequence=1,
                        name=trip.destination_name,
                        lat=trip.destination_lat,
                        lng=trip.destination_lng,
                        type="destination",
                        is_mandatory=True,
                        stay_overnight=False,
                    )
                )

        self.s.commit()
        self.s.refresh(trip)
        return trip

    def update_trip(self, trip_id: str, data: dict[str, Any]) -> TravelTrip | None:
        trip = self.get_trip(trip_id)
        if not trip:
            return None
        for k, v in data.items():
            if hasattr(trip, k):
                setattr(trip, k, v)
        self.s.commit()
        self.s.refresh(trip)
        return trip

    def delete_trip(self, trip_id: str) -> bool:
        trip = self.get_trip(trip_id)
        if not trip:
            return False
        self.s.delete(trip)
        self.s.commit()
        return True

    # ── Preferences ──
    def get_preferences(self, trip_id: str) -> TravelPreferences | None:
        stmt = select(TravelPreferences).where(TravelPreferences.trip_id == trip_id)
        return self.s.scalar(stmt)

    def save_preferences(self, trip_id: str, data: dict[str, Any]) -> TravelPreferences:
        prefs = self.get_preferences(trip_id)
        if not prefs:
            prefs = TravelPreferences(trip_id=trip_id, **data)
            self.s.add(prefs)
        else:
            for k, v in data.items():
                if hasattr(prefs, k):
                    setattr(prefs, k, v)
        self.s.commit()
        self.s.refresh(prefs)
        return prefs

    # ── Checkpoints ──
    def list_checkpoints(self, trip_id: str) -> list[TravelCheckpoint]:
        stmt = (
            select(TravelCheckpoint)
            .where(TravelCheckpoint.trip_id == trip_id)
            .order_by(asc(TravelCheckpoint.sequence))
        )
        return list(self.s.scalars(stmt))

    def add_checkpoint(self, trip_id: str, data: dict[str, Any]) -> TravelCheckpoint:
        cp = TravelCheckpoint(trip_id=trip_id, **data)
        self.s.add(cp)
        self.s.commit()
        self.s.refresh(cp)
        return cp

    def update_checkpoint(self, checkpoint_id: str, data: dict[str, Any]) -> TravelCheckpoint | None:
        cp = self.s.get(TravelCheckpoint, checkpoint_id)
        if not cp:
            return None
        for k, v in data.items():
            if hasattr(cp, k) and v is not None:
                setattr(cp, k, v)
        self.s.commit()
        self.s.refresh(cp)
        return cp

    def delete_checkpoint(self, checkpoint_id: str) -> bool:
        cp = self.s.get(TravelCheckpoint, checkpoint_id)
        if not cp:
            return False
        self.s.delete(cp)
        self.s.commit()
        return True

    def reorder_checkpoints(self, trip_id: str, checkpoint_ids: list[str]) -> list[TravelCheckpoint]:
        cps = self.list_checkpoints(trip_id)
        id_map = {cp.id: cp for cp in cps}
        for seq, cid in enumerate(checkpoint_ids):
            if cid in id_map:
                id_map[cid].sequence = seq
        self.s.commit()
        return self.list_checkpoints(trip_id)

    # ── Route Options ──
    def save_route_options(self, trip_id: str, options: list[dict[str, Any]]) -> list[TravelRouteOption]:
        # Clear previous options
        self.s.execute(delete(TravelRouteOption).where(TravelRouteOption.trip_id == trip_id))
        created = []
        for opt in options:
            ro = TravelRouteOption(trip_id=trip_id, **opt)
            self.s.add(ro)
            created.append(ro)
        self.s.commit()
        for ro in created:
            self.s.refresh(ro)
        return created

    def list_route_options(self, trip_id: str) -> list[TravelRouteOption]:
        stmt = select(TravelRouteOption).where(TravelRouteOption.trip_id == trip_id)
        return list(self.s.scalars(stmt))

    # ── Places (Stays, Restaurants, Attractions) ──
    def list_places(self, trip_id: str, category: str | None = None, checkpoint_id: str | None = None) -> list[TravelPlace]:
        stmt = select(TravelPlace).where(TravelPlace.trip_id == trip_id)
        if category:
            stmt = stmt.where(TravelPlace.category == category)
        if checkpoint_id:
            stmt = stmt.where(TravelPlace.checkpoint_id == checkpoint_id)
        return list(self.s.scalars(stmt))

    def save_places(self, trip_id: str, places: list[dict[str, Any]]) -> list[TravelPlace]:
        created = []
        for p_data in places:
            p = TravelPlace(trip_id=trip_id, **p_data)
            self.s.add(p)
            created.append(p)
        self.s.commit()
        return created

    # ── Itinerary Days ──
    def save_itinerary(self, trip_id: str, days: list[dict[str, Any]]) -> list[TravelItineraryDay]:
        self.s.execute(delete(TravelItineraryDay).where(TravelItineraryDay.trip_id == trip_id))
        created = []
        for d in days:
            day_obj = TravelItineraryDay(trip_id=trip_id, **d)
            self.s.add(day_obj)
            created.append(day_obj)
        self.s.commit()
        for d in created:
            self.s.refresh(d)
        return created

    def get_itinerary(self, trip_id: str) -> list[TravelItineraryDay]:
        stmt = (
            select(TravelItineraryDay)
            .where(TravelItineraryDay.trip_id == trip_id)
            .order_by(asc(TravelItineraryDay.day_number))
        )
        return list(self.s.scalars(stmt))
