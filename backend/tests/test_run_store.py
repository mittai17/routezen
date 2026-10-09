from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import sessionmaker

from app.api import deps
from app.db.base import Base
from app.db.models import OptimizationRun
from app.db.session import make_engine
from app.services.run_store import RunManager, SQLAlchemyRunStore
from app.schemas.optimization import OptimizationResult


@pytest.fixture
def sessions(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'runs.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    engine.dispose()


def test_history_survives_store_recreation(sessions):
    store = SQLAlchemyRunStore(sessions, "first")
    run = store.create("classical", {"stops": [{"id": "one"}]})
    started = datetime.now(timezone.utc)
    store.update(run.id, status="running", started_at=started)
    store.update(run.id, status="succeeded", finished_at=started + timedelta(seconds=2),
                 result={"status": "solved", "total_distance_km": 12})
    restored = SQLAlchemyRunStore(sessions, "first").get(run.id)
    assert restored.status == "succeeded"
    assert restored.request == run.request
    assert restored.result["total_distance_km"] == 12
    assert restored.created_at.tzinfo is not None
    assert restored.started_at == started
    with sessions() as session:
        assert session.get(OptimizationRun, run.id).runtime_ms == 2000


def test_workspace_isolation_filters_and_pagination(sessions):
    store = SQLAlchemyRunStore(sessions, "first")
    other = SQLAlchemyRunStore(sessions, "second")
    first = store.create("quantum", {})
    second = store.create("classical", {})
    foreign = other.create("quantum", {})
    store.update(first.id, status="failed", error="solver failed")
    assert store.get(foreign.id) is None
    assert store.update(foreign.id, status="cancelled") is None
    items, total = store.list(limit=1, offset=1)
    assert total == 2 and [item.id for item in items] == [first.id]
    assert [item.id for item in store.list(kind="classical")[0]] == [second.id]
    assert store.list(status="failed")[1] == 1
    assert store.list(offset=20) == ([], 2)


def test_restart_recovery_only_interrupts_active_workspace_jobs(sessions):
    store = SQLAlchemyRunStore(sessions, "first")
    queued = store.create("classical", {})
    running = store.create("quantum", {})
    finished = store.create("classical", {})
    store.update(running.id, status="running", started_at=datetime.now(timezone.utc))
    store.update(finished.id, status="succeeded", result={"status": "solved"})
    other = SQLAlchemyRunStore(sessions, "second")
    foreign = other.create("quantum", {})
    restarted = SQLAlchemyRunStore(sessions, "first")
    assert restarted.recover_interrupted() == 2
    assert restarted.recover_interrupted() == 0
    for run in [queued, running]:
        record = restarted.get(run.id)
        assert record.status == "failed" and record.finished_at is not None
        assert "restart" in record.error
    assert restarted.get(finished.id).status == "succeeded"
    assert other.get(foreign.id).status == "queued"


def test_default_dependency_uses_persistent_store_and_recovers(sessions, monkeypatch):
    store = SQLAlchemyRunStore(sessions, "first")
    abandoned = store.create("hybrid", {"stops": [{"id": "one"}]})

    class TestSettings:
        workspace_id = "first"

    deps._runs.cache_clear()
    monkeypatch.setattr(deps, "get_sessionmaker", lambda: sessions)
    monkeypatch.setattr(deps, "get_settings", lambda: TestSettings())
    try:
        manager = deps.get_run_manager()
        assert isinstance(manager.store, SQLAlchemyRunStore)
        recovered = manager.store.get(abandoned.id)
        assert recovered.status == "failed"
        assert "restart" in recovered.error
    finally:
        # Do not retain a manager backed by this test's disposed engine.
        deps._runs.cache_clear()


def test_terminal_state_cannot_be_overwritten_by_late_worker(sessions):
    store = SQLAlchemyRunStore(sessions, "first")
    run = store.create("classical", {})
    cancelled = RunManager(store).cancel(run.id)
    assert cancelled.status == "cancelled"
    assert store.update(run.id, status="succeeded", result={"status": "solved"}) == cancelled
    with pytest.raises(ValueError):
        store.update(run.id, workspace_id="second")


def test_concurrent_store_operations_use_independent_sessions(sessions):
    store = SQLAlchemyRunStore(sessions, "first")

    def write(index):
        run = store.create("classical", {"index": index})
        store.update(run.id, status="running")
        store.update(run.id, status="succeeded", result={"index": index})
        return store.get(run.id)

    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(write, range(12)))
    assert store.list(status="succeeded")[1] == 12
    assert {record.result["index"] for record in records} == set(range(12))


async def test_manager_persists_solver_result(sessions):
    import asyncio

    store = SQLAlchemyRunStore(sessions, "first")
    manager = RunManager(store)
    run = manager.submit("classical", {}, lambda _: OptimizationResult(status="solved"), timeout_s=2)
    await asyncio.gather(*manager._tasks)
    record = SQLAlchemyRunStore(sessions, "first").get(run.id)
    assert record.status == "succeeded"
    assert record.result["solver"] == "ortools_vrp"
    assert record.started_at is not None and record.finished_at is not None
