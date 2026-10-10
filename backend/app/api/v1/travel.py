"""FastAPI routes for Smart Travel & Logistics."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_workspace
from app.repositories.travel import TravelRepository
from app.schemas.travel import (
    TravelTripCreate,
    TravelTripUpdate,
    TravelTripOut,
    TravelPreferencesCreate,
    TravelPreferencesUpdate,
    TravelPreferencesOut,
    TravelCheckpointCreate,
    TravelCheckpointUpdate,
    TravelCheckpointOut,
    TravelRouteOptionOut,
    TravelPlaceOut,
    TravelItineraryDayOut,
    TripBudgetOut,
)
from app.services.travel_routing import TravelRoutingService
from app.services.travel_places import TravelPlacesService
from app.services.travel_budget import TravelBudgetEngine
from app.services.travel_schedule import TravelScheduleService

router = APIRouter(prefix="/travel", tags=["smart-travel"])


def _repo(db: Session = Depends(get_db), ws: str = Depends(get_workspace)) -> TravelRepository:
    return TravelRepository(db, ws)


# ── Trips ──────────────────────────────────────────────────────────────────

@router.get("/trips", response_model=list[TravelTripOut])
def list_trips(repo: TravelRepository = Depends(_repo)):
    return repo.list_trips()


@router.post("/trips", response_model=TravelTripOut, status_code=status.HTTP_201_CREATED)
def create_trip(payload: TravelTripCreate, repo: TravelRepository = Depends(_repo)):
    return repo.create_trip(payload.model_dump())


@router.get("/trips/{trip_id}", response_model=TravelTripOut)
def get_trip(trip_id: str, repo: TravelRepository = Depends(_repo)):
    trip = repo.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.patch("/trips/{trip_id}", response_model=TravelTripOut)
@router.post("/trips/{trip_id}", response_model=TravelTripOut)
def update_trip(trip_id: str, payload: TravelTripUpdate, repo: TravelRepository = Depends(_repo)):
    trip = repo.update_trip(trip_id, payload.model_dump(exclude_unset=True))
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.delete("/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: str, repo: TravelRepository = Depends(_repo)):
    if not repo.delete_trip(trip_id):
        raise HTTPException(status_code=404, detail="Trip not found")


# ── Preferences ────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/preferences", response_model=TravelPreferencesOut)
def get_preferences(trip_id: str, repo: TravelRepository = Depends(_repo)):
    trip = repo.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    prefs = repo.get_preferences(trip_id)
    if not prefs:
        prefs = repo.save_preferences(trip_id, {})
    return prefs


@router.post("/trips/{trip_id}/preferences", response_model=TravelPreferencesOut)
def save_preferences(trip_id: str, payload: TravelPreferencesUpdate, repo: TravelRepository = Depends(_repo)):
    trip = repo.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return repo.save_preferences(trip_id, payload.model_dump(exclude_unset=True))


# ── Checkpoints ────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/checkpoints", response_model=list[TravelCheckpointOut])
def list_checkpoints(trip_id: str, repo: TravelRepository = Depends(_repo)):
    trip = repo.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return repo.list_checkpoints(trip_id)


@router.post("/trips/{trip_id}/checkpoints", response_model=TravelCheckpointOut, status_code=status.HTTP_201_CREATED)
def add_checkpoint(trip_id: str, payload: TravelCheckpointCreate, repo: TravelRepository = Depends(_repo)):
    trip = repo.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return repo.add_checkpoint(trip_id, payload.model_dump())


@router.patch("/trips/{trip_id}/checkpoints/{cid}", response_model=TravelCheckpointOut)
def update_checkpoint(trip_id: str, cid: str, payload: TravelCheckpointUpdate, repo: TravelRepository = Depends(_repo)):
    cp = repo.update_checkpoint(cid, payload.model_dump(exclude_unset=True))
    if not cp:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return cp


@router.delete("/trips/{trip_id}/checkpoints/{cid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checkpoint(trip_id: str, cid: str, repo: TravelRepository = Depends(_repo)):
    if not repo.delete_checkpoint(cid):
        raise HTTPException(status_code=404, detail="Checkpoint not found")


@router.post("/trips/{trip_id}/reorder-checkpoints", response_model=list[TravelCheckpointOut])
def reorder_checkpoints(trip_id: str, checkpoint_ids: list[str], repo: TravelRepository = Depends(_repo)):
    return repo.reorder_checkpoints(trip_id, checkpoint_ids)


# ── Route Alternatives ─────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/route-options", response_model=list[TravelRouteOptionOut])
def get_route_options(trip_id: str, repo: TravelRepository = Depends(_repo)):
    """Return previously saved route options for a trip (no re-computation)."""
    return repo.list_route_options(trip_id)


@router.post("/trips/{trip_id}/route-options", response_model=list[TravelRouteOptionOut])
async def generate_route_options(trip_id: str, repo: TravelRepository = Depends(_repo)):
    """Generate (or regenerate) route alternatives using OSRM road geometry, save and return them."""
    trip = repo.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    cps = repo.list_checkpoints(trip_id)
    cp_dicts = [
        {
            "id": c.id,
            "lat": c.lat,
            "lng": c.lng,
            "name": c.name,
            "type": c.type,
            "is_mandatory": c.is_mandatory,
            "sequence": c.sequence,
        }
        for c in cps
    ]

    service = TravelRoutingService()
    options = await service.generate_route_alternatives(
        origin=(trip.origin_lat, trip.origin_lng),
        destination=(trip.destination_lat, trip.destination_lng),
        checkpoints=cp_dicts,
        travel_mode=trip.travel_mode,
    )
    return repo.save_route_options(trip_id, options)



# ── Places (Stays, Dining, Sightseeing) ─────────────────────────────────────

@router.get("/trips/{trip_id}/stays", response_model=list[TravelPlaceOut])
def list_stays(trip_id: str, checkpoint_id: str | None = None, repo: TravelRepository = Depends(_repo)):
    existing = repo.list_places(trip_id, category="stay", checkpoint_id=checkpoint_id)
    if not existing:
        places_svc = TravelPlacesService()
        discovered = places_svc.get_corridor_places(checkpoint_id=checkpoint_id, category="stay")
        return repo.save_places(trip_id, discovered)
    return existing


@router.get("/trips/{trip_id}/restaurants", response_model=list[TravelPlaceOut])
def list_restaurants(trip_id: str, checkpoint_id: str | None = None, repo: TravelRepository = Depends(_repo)):
    existing = repo.list_places(trip_id, category="restaurant", checkpoint_id=checkpoint_id)
    if not existing:
        places_svc = TravelPlacesService()
        discovered = places_svc.get_corridor_places(checkpoint_id=checkpoint_id, category="restaurant")
        return repo.save_places(trip_id, discovered)
    return existing


@router.get("/trips/{trip_id}/attractions", response_model=list[TravelPlaceOut])
def list_attractions(trip_id: str, checkpoint_id: str | None = None, repo: TravelRepository = Depends(_repo)):
    existing = repo.list_places(trip_id, category="attraction", checkpoint_id=checkpoint_id)
    if not existing:
        places_svc = TravelPlacesService()
        discovered = places_svc.get_corridor_places(checkpoint_id=checkpoint_id, category="attraction")
        return repo.save_places(trip_id, discovered)
    return existing


# ── Itinerary Building ─────────────────────────────────────────────────────

@router.post("/trips/{trip_id}/build-itinerary", response_model=list[TravelItineraryDayOut])
def build_itinerary(trip_id: str, repo: TravelRepository = Depends(_repo)):
    trip = repo.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    cps = repo.list_checkpoints(trip_id)
    cp_dicts = [
        {
            "id": c.id,
            "name": c.name,
            "lat": c.lat,
            "lng": c.lng,
            "stay_overnight": c.stay_overnight,
            "activity_duration_min": c.activity_duration_min,
            "distance_from_prev_km": c.distance_from_prev_km,
            "duration_from_prev_min": c.duration_from_prev_min,
            "notes": c.notes,
        }
        for c in cps
    ]

    prefs = repo.get_preferences(trip_id)
    max_drive_hours = prefs.max_drive_hours_per_day if prefs else 8.0

    sched_svc = TravelScheduleService()
    days = sched_svc.build_itinerary(
        checkpoints=cp_dicts,
        max_drive_hours=max_drive_hours,
        departure_date=trip.departure_date,
    )
    return repo.save_itinerary(trip_id, days)


# ── Budget Calculation ─────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/budget", response_model=TripBudgetOut)
def get_trip_budget(trip_id: str, repo: TravelRepository = Depends(_repo)):
    trip = repo.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    cps = repo.list_checkpoints(trip_id)
    total_km = sum(c.distance_from_prev_km or 350.0 for c in cps[1:]) if len(cps) > 1 else 3100.0

    prefs = repo.get_preferences(trip_id)
    target_budget = prefs.total_budget_inr if prefs else 80000.0
    meal_rate = prefs.meal_budget_per_person if prefs else 400.0
    stay_rate = prefs.max_price_per_night if prefs else 2200.0
    contingency = prefs.contingency_pct if prefs else 10.0

    days_count = max(2, len([c for c in cps if c.stay_overnight]) + 1)

    engine = TravelBudgetEngine()
    budget_dict = engine.calculate_budget(
        total_distance_km=total_km,
        duration_days=days_count,
        party_size=trip.adults,
        target_budget_inr=target_budget,
        travel_mode=trip.travel_mode,
        meal_budget_per_person=meal_rate,
        max_price_per_night=stay_rate,
        contingency_pct=contingency,
    )
    budget_dict["trip_id"] = trip_id
    return budget_dict
