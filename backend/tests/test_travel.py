"""Tests for Smart Travel & Logistics backend endpoints and services."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_travel_trip_lifecycle(client: TestClient):
    # 1. Create trip (Chennai to Leh)
    trip_data = {
        "name": "Chennai to Leh Expedition",
        "origin_name": "Chennai, Tamil Nadu",
        "origin_lat": 13.0827,
        "origin_lng": 80.2707,
        "destination_name": "Leh, Ladakh",
        "destination_lat": 34.1526,
        "destination_lng": 77.5771,
        "departure_date": "2025-05-13",
        "is_one_way": True,
        "adults": 2,
        "travel_mode": "car",
        "notes": "Scenic route requested",
        "preferences": {
            "pace": "balanced",
            "budget_category": "mid_range",
            "total_budget_inr": 80000.0,
            "max_drive_hours_per_day": 8.0,
        },
        "checkpoints": [
            {
                "sequence": 0,
                "name": "Chennai, Tamil Nadu",
                "lat": 13.0827,
                "lng": 80.2707,
                "type": "origin",
                "is_mandatory": True,
                "stay_overnight": False,
            },
            {
                "sequence": 1,
                "name": "Vijayawada, Andhra Pradesh",
                "lat": 16.5062,
                "lng": 80.6480,
                "type": "mandatory",
                "is_mandatory": True,
                "stay_overnight": True,
                "distance_from_prev_km": 422.0,
                "duration_from_prev_min": 360.0,
            },
            {
                "sequence": 2,
                "name": "Hyderabad, Telangana",
                "lat": 17.3850,
                "lng": 78.4867,
                "type": "mandatory",
                "is_mandatory": True,
                "stay_overnight": True,
                "distance_from_prev_km": 280.0,
                "duration_from_prev_min": 240.0,
            },
            {
                "sequence": 3,
                "name": "Leh, Ladakh",
                "lat": 34.1526,
                "lng": 77.5771,
                "type": "destination",
                "is_mandatory": True,
                "stay_overnight": False,
                "distance_from_prev_km": 500.0,
                "duration_from_prev_min": 450.0,
            },
        ],
    }

    create_res = client.post("/api/v1/travel/trips", json=trip_data)
    assert create_res.status_code == 201
    created_trip = create_res.json()
    trip_id = created_trip["id"]
    assert created_trip["name"] == "Chennai to Leh Expedition"
    assert created_trip["adults"] == 2

    # 2. List trips
    list_res = client.get("/api/v1/travel/trips")
    assert list_res.status_code == 200
    trips = list_res.json()
    assert any(t["id"] == trip_id for t in trips)

    # 3. Get single trip
    get_res = client.get(f"/api/v1/travel/trips/{trip_id}")
    assert get_res.status_code == 200
    assert get_res.json()["origin_name"] == "Chennai, Tamil Nadu"

    # 4. Checkpoints
    cps_res = client.get(f"/api/v1/travel/trips/{trip_id}/checkpoints")
    assert cps_res.status_code == 200
    checkpoints = cps_res.json()
    assert len(checkpoints) == 4
    assert checkpoints[0]["name"] == "Chennai, Tamil Nadu"
    assert checkpoints[-1]["name"] == "Leh, Ladakh"

    # 5. Add custom waypoint
    new_cp = {
        "sequence": 2,
        "name": "Nagpur, Maharashtra",
        "lat": 21.1458,
        "lng": 79.0882,
        "type": "optional",
        "is_mandatory": False,
        "stay_overnight": True,
        "distance_from_prev_km": 502.0,
        "duration_from_prev_min": 420.0,
    }
    add_cp_res = client.post(f"/api/v1/travel/trips/{trip_id}/checkpoints", json=new_cp)
    assert add_cp_res.status_code == 201
    added_cp = add_cp_res.json()
    assert added_cp["name"] == "Nagpur, Maharashtra"

    # 6. Generate route options
    routes_res = client.post(f"/api/v1/travel/trips/{trip_id}/route-options")
    assert routes_res.status_code == 200
    routes = routes_res.json()
    assert len(routes) == 3
    assert any(r["label"] == "Recommended Route" for r in routes)
    assert any(r["label"] == "Fastest Route" for r in routes)
    assert any(r["label"] == "Scenic & Heritage Route" for r in routes)

    # 7. Discover places (Stays, Food, Attractions)
    stays_res = client.get(f"/api/v1/travel/trips/{trip_id}/stays")
    assert stays_res.status_code == 200
    assert len(stays_res.json()) > 0

    food_res = client.get(f"/api/v1/travel/trips/{trip_id}/restaurants")
    assert food_res.status_code == 200
    assert len(food_res.json()) > 0

    attr_res = client.get(f"/api/v1/travel/trips/{trip_id}/attractions")
    assert attr_res.status_code == 200
    assert len(attr_res.json()) > 0

    # 8. Build Itinerary
    itin_res = client.post(f"/api/v1/travel/trips/{trip_id}/build-itinerary")
    assert itin_res.status_code == 200
    days = itin_res.json()
    assert len(days) >= 2
    assert "items" in days[0]

    # 9. Calculate Budget
    budget_res = client.get(f"/api/v1/travel/trips/{trip_id}/budget")
    assert budget_res.status_code == 200
    budget = budget_res.json()
    assert budget["estimated_total_inr"] > 0
    assert budget["fuel_inr"] > 0
    assert budget["accommodation_inr"] > 0
    assert len(budget["assumptions"]) > 0

    # 10. Update trip
    update_res = client.patch(f"/api/v1/travel/trips/{trip_id}", json={"status": "planned"})
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "planned"

    # 11. Delete trip
    del_res = client.delete(f"/api/v1/travel/trips/{trip_id}")
    assert del_res.status_code == 204

    # 12. Verify 404 after deletion
    verify_res = client.get(f"/api/v1/travel/trips/{trip_id}")
    assert verify_res.status_code == 404
