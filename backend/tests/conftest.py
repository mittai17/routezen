from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import deps
from app.db import models  # noqa: F401
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.services.routing import OSRMClient
from app.services.run_store import InMemoryRunStore, RunManager


def osrm_handler(request: httpx.Request) -> httpx.Response:
    """Deterministic fake OSRM: 1 degree of lng/lat ~ 100 km; good enough for tests."""
    path = request.url.path
    coords = [tuple(map(float, p.split(","))) for p in path.rsplit("/", 1)[1].split(";")]

    def d(a, b):
        return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 * 100_000  # metres

    if "/table/" in path:
        dist = [[d(a, b) for b in coords] for a in coords]
        dur = [[x / 8 for x in row] for row in dist]  # 8 m/s
        return httpx.Response(200, json={"code": "Ok", "distances": dist, "durations": dur})
    legs = [{"distance": d(a, b), "duration": d(a, b) / 8} for a, b in zip(coords, coords[1:])]
    return httpx.Response(200, json={"code": "Ok", "routes": [{
        "distance": sum(l["distance"] for l in legs), "duration": sum(l["duration"] for l in legs), "legs": legs,
        "geometry": {"type": "LineString", "coordinates": [list(c) for c in coords]},
    }]})


@pytest.fixture
def osrm_client():
    return OSRMClient("http://osrm.test", transport=httpx.MockTransport(osrm_handler))


@pytest.fixture
def client(osrm_client):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    def _db():
        with Session() as s:
            yield s

    app = create_app()
    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[deps.get_routing] = lambda: osrm_client
    manager = RunManager(InMemoryRunStore())
    app.dependency_overrides[deps.get_run_manager] = lambda: manager
    with TestClient(app) as c:
        yield c


API = "/api/v1"


@pytest.fixture
def api(client):
    class A:
        def __init__(self, c):
            self.c = c

        def post(self, path, **kw):
            return self.c.post(API + path, **kw)

        def get(self, path, **kw):
            return self.c.get(API + path, **kw)

        def put(self, path, **kw):
            return self.c.put(API + path, **kw)

        def delete(self, path, **kw):
            return self.c.delete(API + path, **kw)

    return A(client)


def vehicle_payload(**over):
    base = dict(name="Test Van", category="van", payload_kg=100, volume_m3=1.0, energy_type="diesel",
                efficiency_value=15, efficiency_unit="km_per_l", energy_price="100.00",
                fixed_cost_per_delivery="10.00", operating_cost_per_km="2.00", avg_speed_kmph=30,
                emissions_g_per_km=100, range_km=200, available=True, source="test", verification="user")
    base.update(over)
    return base
