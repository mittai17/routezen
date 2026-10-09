from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import VehicleProfile
from scripts.seed import seed


def test_seed_is_idempotent_and_flags_assumed():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as s:
        v1, _ = seed(s, "dev-workspace")
        v2, l2 = seed(s, "dev-workspace")
        assert v1 >= 5 and v2 == 0 and l2 == 0
        rows = list(s.scalars(select(VehicleProfile)))
        assert all(r.verification == "assumed" and "NOT a verified" in r.source for r in rows)
        assert {r.energy_type for r in rows} >= {"electric", "diesel", "petrol", "cng"}


def test_scenario_run_recommendation_and_compare(api):
    from tests.conftest import vehicle_payload
    api.post("/vehicles", json=vehicle_payload())
    cfg = {"packages": [{"weight_kg": 5, "latitude": 13.1, "longitude": 80.0}],
           "depot": {"latitude": 13.0, "longitude": 80.0}}
    a = api.post("/scenarios", json={"name": "A", "kind": "recommendation", "config": cfg}).json()
    b = api.post("/scenarios", json={"name": "B", "kind": "recommendation",
                                     "config": {**cfg, "preferences": {"round_trip": True}}}).json()
    ra = api.post(f"/scenarios/{a['id']}/run")
    assert ra.status_code == 200 and ra.json()["result"]["summary"]["total_cost"] > 0
    api.post(f"/scenarios/{b['id']}/run")
    cmp = api.post("/scenarios/compare", json={"scenario_ids": [a["id"], b["id"]]}).json()
    costs = [s["summary"]["total_cost"] for s in cmp["scenarios"]]
    assert costs[1] > costs[0]  # round trip costs more
    q = api.post("/scenarios", json={"name": "Q", "kind": "quantum", "config": {}}).json()
    assert api.post(f"/scenarios/{q['id']}/run").status_code == 422


def test_scenario_run_classical(api):
    cfg = {"depot": {"latitude": 13.0, "longitude": 80.0}, "time_limit_s": 1,
           "stops": [{"id": "a", "latitude": 13.05, "longitude": 80.0}],
           "vehicles": [{"vehicle_id": "v", "payload_kg": 10, "volume_m3": 1}]}
    s = api.post("/scenarios", json={"name": "C", "kind": "classical", "config": cfg}).json()
    r = api.post(f"/scenarios/{s['id']}/run").json()
    assert r["result"]["summary"]["status"] == "solved"
