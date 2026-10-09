from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.schemas.recommendation import PackageInput, Preferences, VehicleSpec, Weights
from app.services.recommendation import compute_costs, recommend

NOW = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)


def veh(**o) -> VehicleSpec:
    base = dict(vehicle_id="v1", name="Diesel", payload_kg=100, volume_m3=1.0, energy_type="diesel",
                efficiency_value=15, efficiency_unit="km_per_l", energy_price=Decimal("100"),
                fixed_cost_per_delivery=Decimal("0"), operating_cost_per_km=Decimal("0"), avg_speed_kmph=30)
    base.update(o)
    return VehicleSpec(**base)


def pkg(**o) -> PackageInput:
    base = dict(package_id="p1", weight_kg=10, volume_m3=0.1, latitude=13, longitude=80)
    base.update(o)
    return PackageInput(**base)


def test_fuel_cost_formula_exact():
    c = compute_costs(veh(efficiency_value=15, energy_price=Decimal("100")), 12.0)
    assert c["energy_used"] == pytest.approx(0.8)  # 12 / 15
    assert c["energy_cost"] == Decimal("80.00")  # 12/15*100
    assert c["total_cost"] == Decimal("80.00")


def test_ev_cost_formula_exact():
    ev = veh(vehicle_id="e", energy_type="electric", efficiency_value=5, efficiency_unit="km_per_kwh",
             energy_price=Decimal("8"))
    c = compute_costs(ev, 12.0)
    assert c["energy_unit"] == "kWh" and c["energy_used"] == pytest.approx(2.4)  # 12 * (1/5)
    assert c["energy_cost"] == Decimal("19.20")  # 12 * 0.2 * 8


def test_operating_and_fixed_not_double_counted():
    v = veh(operating_cost_per_km=Decimal("2.5"), fixed_cost_per_delivery=Decimal("30"))
    c = compute_costs(v, 10.0)
    assert c["energy_cost"] == Decimal("66.67")  # 10/15*100
    assert c["operating_cost"] == Decimal("25.00")
    assert c["variable_cost"] == Decimal("91.67")
    assert c["fixed_cost"] == Decimal("30.00")
    assert c["total_cost"] == Decimal("121.67")  # energy + operating + fixed, each once
    assert c["cost_per_km"] == Decimal("12.17")


def test_round_trip_doubles_billed_distance():
    r = recommend(pkg(), 6.0, 10, [veh()], Preferences(round_trip=True, departure_time=NOW))
    assert r.billed_distance_km == 12 and r.recommended.total_cost == Decimal("80.00")


def test_payload_and_volume_hard_filters():
    vs = [veh(vehicle_id="small", name="Small", payload_kg=5), veh(vehicle_id="thin", name="Thin", volume_m3=0.05),
          veh(vehicle_id="ok", name="Ok")]
    r = recommend(pkg(), 5, 10, vs, Preferences(departure_time=NOW))
    assert r.recommended.vehicle_id == "ok"
    reasons = {i.vehicle_id: i.reasons[0] for i in r.ineligible}
    assert "weight" in reasons["small"] and "volume" in reasons["thin"]


def test_exact_capacity_boundary_is_eligible():
    r = recommend(pkg(weight_kg=100, volume_m3=1.0), 5, 10, [veh()], Preferences(departure_time=NOW))
    assert r.recommended is not None and r.recommended.payload_utilisation == 1.0


def test_availability_and_range_filters():
    vs = [veh(vehicle_id="off", available=False), veh(vehicle_id="short", range_km=20), veh(vehicle_id="ok")]
    r = recommend(pkg(), 15, 20, vs, Preferences(departure_time=NOW))  # round trip 30 km > 20
    assert r.recommended.vehicle_id == "ok"
    msgs = {i.vehicle_id: i.reasons[0] for i in r.ineligible}
    assert "unavailable" in msgs["off"] and "range" in msgs["short"]


def test_deadline_feasibility():
    # 15 km at 30 km/h = 30 min + 5 min service
    ok = recommend(pkg(deadline=NOW + timedelta(minutes=40)), 15, 20, [veh()], Preferences(departure_time=NOW))
    assert ok.recommended.deadline_feasible and ok.recommended.deadline_slack_min == pytest.approx(5)
    late = recommend(pkg(deadline=NOW + timedelta(minutes=34)), 15, 20, [veh()], Preferences(departure_time=NOW))
    assert late.recommended is None and "deadline" in late.ineligible[0].reasons[0]
    soft = recommend(pkg(deadline=NOW + timedelta(minutes=34)), 15, 20, [veh()],
                     Preferences(departure_time=NOW, require_deadline=False))
    assert soft.recommended is not None and not soft.recommended.deadline_feasible
    assert "misses the deadline" in soft.explanation


def test_infeasible_when_nothing_fits_has_reasons():
    r = recommend(pkg(weight_kg=1000), 5, 10, [veh()], Preferences(departure_time=NOW))
    assert r.recommended is None and r.alternatives == []
    assert "No vehicle is eligible" in r.explanation and r.ineligible[0].reasons


def test_scoring_weights_change_winner():
    cheap_slow = veh(vehicle_id="cheap", name="Cheap", energy_price=Decimal("50"), avg_speed_kmph=10)
    pricey_fast = veh(vehicle_id="fast", name="Fast", energy_price=Decimal("150"), avg_speed_kmph=60)
    cost_first = Preferences(departure_time=NOW, weights=Weights(cost=1, time=0, emissions=0, utilisation=0))
    time_first = Preferences(departure_time=NOW, weights=Weights(cost=0, time=1, emissions=0, utilisation=0))
    assert recommend(pkg(), 10, 10, [cheap_slow, pricey_fast], cost_first).recommended.vehicle_id == "cheap"
    assert recommend(pkg(), 10, 10, [cheap_slow, pricey_fast], time_first).recommended.vehicle_id == "fast"


def test_deterministic_and_explanation_uses_real_numbers():
    vs = [veh(), veh(vehicle_id="v2", name="Other", energy_price=Decimal("120"))]
    a = recommend(pkg(), 12, 15, vs, Preferences(departure_time=NOW))
    b = recommend(pkg(), 12, 15, vs, Preferences(departure_time=NOW))
    assert a == b
    assert "80.00" in a.explanation and "12.0 km" in a.explanation and "Diesel" in a.explanation
    assert any("marked 'assumed'" in x for x in a.assumptions)  # unverified specs are disclosed
    assert a.alternatives[0].vehicle_id == "v2"


def test_fallback_estimate_is_flagged():
    r = recommend(pkg(), 5, 10, [veh()], Preferences(departure_time=NOW), distance_source="fallback_estimate")
    assert r.fallback_estimate and "FALLBACK" in " ".join(r.assumptions)


def test_weights_validation():
    with pytest.raises(ValueError):
        Weights(cost=0, time=0, emissions=0, utilisation=0)
    with pytest.raises(ValueError):
        Weights(cost=-1)


def test_recommendations_endpoint_end_to_end(api):
    from tests.conftest import vehicle_payload
    api.post("/vehicles", json=vehicle_payload(name="Diesel"))
    api.post("/vehicles", json=vehicle_payload(name="Tiny", payload_kg=1))
    body = {"packages": [{"package_id": "x", "weight_kg": 10, "volume_m3": 0.1, "latitude": 13.1, "longitude": 80.0}],
            "depot": {"latitude": 13.0, "longitude": 80.0}}
    r = api.post("/recommendations", json=body)
    assert r.status_code == 200, r.text
    item = r.json()[0]
    assert item["recommended"]["name"] == "Diesel" and item["distance_source"] == "osrm"
    assert item["distance_km"] == pytest.approx(10.0)  # fake OSRM: 0.1 deg => 10 km
    assert item["ineligible"][0]["reasons"]
    assert api.post("/recommendations", json={"depot": body["depot"]}).status_code == 422
    assert api.post("/recommendations", json={**body, "depot": {"latitude": 99, "longitude": 0}}).status_code == 422
