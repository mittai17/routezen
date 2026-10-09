import pytest

from tests.conftest import vehicle_payload


def test_health_and_ready(api):
    assert api.get("/health").json() == {"status": "ok"}
    r = api.get("/ready").json()
    assert r["db"] == "ok" and r["optimizer"] == "ok" and "simulation" in r["quantum"]


def test_cors_allows_frontend_origin(client):
    r = client.options("/api/v1/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
    r = client.options("/api/v1/health", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers


def loc(**o):
    return {"name": "T. Nagar", "latitude": 13.04, "longitude": 80.23, "type": "stop", **o}


def test_location_crud_pagination_filter_csv(api):
    ids = [api.post("/locations", json=loc(name=f"L{i}", type="depot" if i == 0 else "stop")).json()["id"] for i in range(5)]
    r = api.get("/locations", params={"limit": 2, "offset": 1, "sort": "name", "order": "asc"}).json()
    assert r["total"] == 5 and [i["name"] for i in r["items"]] == ["L1", "L2"]
    assert api.get("/locations", params={"type": "depot"}).json()["total"] == 1
    assert api.get("/locations", params={"q": "l3"}).json()["total"] == 1
    assert api.get("/locations", params={"sort": "bogus"}).status_code == 422
    one = api.get(f"/locations/{ids[0]}").json()
    assert one["name"] == "L0"
    upd = api.put(f"/locations/{ids[0]}", json=loc(name="Renamed")).json()
    assert upd["name"] == "Renamed"
    assert api.delete(f"/locations/{ids[0]}").status_code == 204
    assert api.get(f"/locations/{ids[0]}").status_code == 404
    assert api.delete(f"/locations/{ids[0]}").status_code == 404
    csv = api.get("/locations/export.csv")
    assert csv.headers["content-type"].startswith("text/csv")
    assert csv.text.splitlines()[0].startswith("id,name,address")
    assert len(csv.text.strip().splitlines()) == 5


def test_csv_formula_injection_is_neutralised(api):
    api.post("/locations", json=loc(name="=HYPERLINK(\"http://x\")"))
    assert "'=HYPERLINK" in api.get("/locations/export.csv").text


@pytest.mark.parametrize("lat,lng", [(91, 0), (-91, 0), (0, 181), (0, -181), ("x", 0)])
def test_invalid_coordinates_rejected(api, lat, lng):
    assert api.post("/locations", json=loc(latitude=lat, longitude=lng)).status_code == 422


def test_package_validation_and_volume_derivation(api):
    base = {"reference": "P1", "weight_kg": 5}
    r = api.post("/packages", json={**base, "length_cm": 100, "width_cm": 50, "height_cm": 40, "latitude": 13, "longitude": 80})
    assert r.status_code == 201 and r.json()["volume_m3"] == pytest.approx(0.2)
    assert api.post("/packages", json={**base, "weight_kg": -1}).status_code == 422
    assert api.post("/packages", json={**base, "length_cm": 0, "width_cm": 1, "height_cm": 1}).status_code == 422
    assert api.post("/packages", json={**base, "length_cm": -3, "width_cm": 1, "height_cm": 1}).status_code == 422
    assert api.post("/packages", json={**base, "length_cm": 3}).status_code == 422  # partial dims
    assert api.post("/packages", json={**base, "latitude": 13}).status_code == 422  # lat without lng
    assert api.post("/packages", json={**base, "service_minutes": -1}).status_code == 422
    assert api.post("/packages", json={**base, "deadline": "2026-01-01T10:00:00"}).status_code == 422  # naive tz
    assert api.post("/packages", json={**base, "window_start": "2026-01-02T10:00:00Z", "window_end": "2026-01-01T10:00:00Z"}).status_code == 422
    assert api.post("/packages", json={**base, "location_id": "nope"}).status_code == 422


def test_package_inherits_location_coords_and_timestamps_are_utc(api):
    lid = api.post("/locations", json=loc()).json()["id"]
    r = api.post("/packages", json={"reference": "P2", "location_id": lid, "deadline": "2026-01-01T10:00:00+05:30"}).json()
    assert r["latitude"] == 13.04 and r["longitude"] == 80.23
    assert r["deadline"].startswith("2026-01-01T04:30:00")
    assert api.get("/packages", params={"status": "pending"}).json()["total"] == 1


def test_vehicle_validation(api):
    assert api.post("/vehicles", json=vehicle_payload()).status_code == 201
    for bad in (dict(payload_kg=0), dict(payload_kg=-5), dict(volume_m3=-1), dict(efficiency_value=0),
                dict(energy_price="-1"), dict(operating_cost_per_km="-0.5"), dict(fixed_cost_per_delivery="-1"),
                dict(energy_type="electric"),  # unit mismatch
                dict(energy_type="steam"), dict(verification="verified")):
        assert api.post("/vehicles", json=vehicle_payload(**bad)).status_code == 422, bad


def test_vehicle_money_is_decimal_and_filterable(api):
    api.post("/vehicles", json=vehicle_payload(energy_price="101.55"))
    api.post("/vehicles", json=vehicle_payload(name="EV", energy_type="electric", efficiency_unit="km_per_kwh",
                                               efficiency_value=5, available=False))
    v = api.get("/vehicles", params={"energy_type": "diesel"}).json()
    assert v["total"] == 1 and v["items"][0]["energy_price"] == "101.55"
    assert api.get("/vehicles", params={"available": "false"}).json()["total"] == 1
    assert api.get("/vehicles", params={"available": "maybe"}).status_code == 422


def test_plan_crud_validate_and_fk(api):
    v = api.post("/vehicles", json=vehicle_payload()).json()["id"]
    p1 = api.post("/packages", json={"reference": "A", "weight_kg": 60, "volume_m3": 0.4}).json()["id"]
    p2 = api.post("/packages", json={"reference": "B", "weight_kg": 60, "volume_m3": 0.4}).json()["id"]
    a = lambda p, s: {"vehicle_id": v, "package_id": p, "sequence": s}  # noqa: E731
    val = api.post("/plans/validate", json={"assignments": [a(p1, 0), a(p2, 1)]}).json()
    assert not val["valid"] and any("exceeds payload" in i for i in val["issues"])
    assert api.post("/plans/validate", json={"assignments": [a(p1, 0)]}).json()["valid"]
    r = api.post("/plans", json={"name": "Plan", "total_cost": "123.45", "assignments": [a(p1, 0)]})
    assert r.status_code == 201
    plan = r.json()
    assert plan["total_cost"] == "123.45" and len(plan["assignments"]) == 1
    assert api.post("/plans", json={"name": "bad", "assignments": [a("missing", 0)]}).status_code == 422
    assert api.post("/plans", json={"name": "dup", "assignments": [a(p1, 0), a(p1, 1)]}).status_code == 422
    upd = api.put(f"/plans/{plan['id']}", json={"name": "Plan2", "assignments": [a(p2, 0)]}).json()
    assert upd["name"] == "Plan2" and upd["assignments"][0]["package_id"] == p2
    assert api.get("/plans").json()["total"] == 1
    assert api.get("/plans/export.csv").text.count("\n") == 2
    assert api.delete(f"/plans/{plan['id']}").status_code == 204
    assert api.get(f"/plans/{plan['id']}").status_code == 404


def test_events_scenarios_settings(api):
    e = api.post("/events", json={"type": "picked_up", "latitude": 13, "longitude": 80})
    assert e.status_code == 201 and e.json()["occurred_at"]
    assert api.post("/events", json={"type": "x", "latitude": 13}).status_code == 422
    assert api.post("/events", json={"type": "x", "plan_id": "nope"}).status_code == 422
    assert api.get("/events", params={"type": "picked_up"}).json()["total"] == 1

    s = api.post("/scenarios", json={"name": "S1", "kind": "recommendation", "config": {}}).json()
    assert api.get(f"/scenarios/{s['id']}").json()["name"] == "S1"
    assert api.put(f"/scenarios/{s['id']}", json={"name": "S1b"}).json()["name"] == "S1b"
    assert api.post("/scenarios/compare", json={"scenario_ids": [s["id"], "nope"]}).status_code == 404
    assert api.delete(f"/scenarios/{s['id']}").status_code == 204

    assert api.get("/settings").json()["currency"] == "INR"
    out = api.put("/settings", json={"round_trip": True, "custom": {"a": 1}}).json()
    assert out["round_trip"] is True and out["custom"] == {"a": 1}
    assert api.get("/settings").json()["round_trip"] is True


def test_analytics_and_reports(api):
    api.post("/vehicles", json=vehicle_payload())
    assert api.get("/analytics/summary").json()["vehicles"] == 1
    for k in ("cost", "energy", "vehicles", "optimization"):
        assert api.get(f"/analytics/{k}").status_code == 200
    assert api.get("/reports/vehicles.csv").text.count("\n") == 2
    assert api.get("/reports/nonsense.csv").status_code == 404
