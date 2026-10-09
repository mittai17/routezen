"""Invalid optimization input is rejected before expensive jobs are queued."""
import pytest


def body():
    return {
        "depot": {"latitude": 13, "longitude": 80},
        "stops": [{"id": "a", "latitude": 13, "longitude": 80}],
        "vehicles": [{"vehicle_id": "v", "payload_kg": 100, "volume_m3": 1}],
        "matrices": {"distance_km": [[0, 1], [1, 0]], "duration_min": [[0, 1], [1, 0]]},
    }


@pytest.mark.parametrize("kind", ["classical", "quantum", "hybrid"])
@pytest.mark.parametrize("matrix", [[[0]], [[0, -1], [1, 0]], [[0, 1], [1]]])
def test_bad_matrix_rejected_before_queue(api, kind, matrix):
    req = body()
    req["matrices"]["distance_km"] = matrix
    response = api.post(f"/optimization/{kind}", json=req)
    assert response.status_code == 422
    assert "distance_km" in response.json()["detail"]
    assert api.get("/optimization/runs").json()["total"] == 0


@pytest.mark.parametrize("kind", ["classical", "quantum", "hybrid"])
def test_duplicate_stop_ids_rejected_before_queue(api, kind):
    req = body()
    req["stops"] *= 2
    assert api.post(f"/optimization/{kind}", json=req).status_code == 422
    assert api.get("/optimization/runs").json()["total"] == 0


def test_duplicate_vehicle_ids_rejected_before_queue(api):
    req = body()
    req["vehicles"] *= 2
    assert api.post("/optimization/classical", json=req).status_code == 422
    assert api.post("/optimization/hybrid", json=req).status_code == 422


@pytest.mark.parametrize("window", [
    {"deadline": "2026-10-09T08:59:00+05:30"},
    {"window_end": "2026-10-09T08:59:00+05:30"},
    {"window_start": "2026-10-09T11:00:00+05:30", "deadline": "2026-10-09T10:00:00+05:30"},
])
def test_expired_or_contradictory_package_window_is_not_silently_clamped(api, window):
    package = api.post("/packages", json={
        "reference": "Window test", "latitude": 13, "longitude": 80, **window,
    })
    assert package.status_code == 201
    req = body()
    req.update(stops=[], package_ids=[package.json()["id"]], start_time="2026-10-09T09:00:00+05:30")
    response = api.post("/optimization/classical", json=req)
    assert response.status_code == 422
    assert "before" in response.json()["detail"]


def test_same_stop_and_package_id_is_rejected(api):
    package = api.post("/packages", json={"reference": "Duplicate", "latitude": 13, "longitude": 80}).json()
    req = body()
    req["stops"][0]["id"] = package["id"]
    req["package_ids"] = [package["id"]]
    response = api.post("/optimization/classical", json=req)
    assert response.status_code == 422
    assert "unique" in response.json()["detail"]
