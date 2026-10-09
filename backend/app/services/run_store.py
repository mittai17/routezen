"""Optimization run store (interface + in-memory implementation) and async runner."""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Protocol
from uuid import uuid4

from app.schemas.optimization import RunRecord

log = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RunStore(Protocol):
    def create(self, kind: str, request: dict) -> RunRecord: ...
    def get(self, run_id: str) -> RunRecord | None: ...
    def list(self, kind: str | None = None, status: str | None = None, limit: int = 50, offset: int = 0) -> tuple[list[RunRecord], int]: ...
    def update(self, run_id: str, **fields: Any) -> RunRecord | None: ...


class InMemoryRunStore:
    def __init__(self, max_runs: int = 500):
        self._runs: OrderedDict[str, RunRecord] = OrderedDict()
        self._lock = threading.Lock()
        self._max = max_runs

    def create(self, kind: str, request: dict) -> RunRecord:
        rec = RunRecord(id=str(uuid4()), kind=kind, status="queued", created_at=_now(), request=request)  # type: ignore[arg-type]
        with self._lock:
            self._runs[rec.id] = rec
            while len(self._runs) > self._max:
                self._runs.popitem(last=False)
        return rec

    def get(self, run_id: str) -> RunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def list(self, kind=None, status=None, limit=50, offset=0):
        with self._lock:
            items = [r for r in reversed(self._runs.values()) if (not kind or r.kind == kind) and (not status or r.status == status)]
        return items[offset : offset + limit], len(items)

    def update(self, run_id: str, **fields: Any) -> RunRecord | None:
        with self._lock:
            rec = self._runs.get(run_id)
            if rec is None:
                return None
            new = rec.model_copy(update=fields)
            self._runs[run_id] = new
            return new


class RunManager:
    """Runs blocking solver functions in worker threads and tracks status.

    Cancellation: queued runs are cancelled immediately; running quantum jobs
    observe a cooperative `threading.Event`; a running OR-Tools solve cannot be
    interrupted (bounded by its time limit) but its result is discarded.
    """

    def __init__(self, store: RunStore):
        self.store = store
        self._events: dict[str, threading.Event] = {}
        self._tasks: set[asyncio.Task] = set()

    def submit(
        self,
        kind: str,
        request: dict,
        work: Callable[[threading.Event], Any],
        timeout_s: float,
        timeout_exc: tuple[type[BaseException], ...] = (),
        cancel_exc: tuple[type[BaseException], ...] = (),
    ) -> RunRecord:
        rec = self.store.create(kind, request)
        ev = threading.Event()
        self._events[rec.id] = ev
        task = asyncio.get_running_loop().create_task(self._run(rec.id, work, ev, timeout_s, timeout_exc, cancel_exc))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return rec

    async def _run(self, run_id, work, ev, timeout_s, timeout_exc, cancel_exc) -> None:
        if ev.is_set():
            return
        self.store.update(run_id, status="running", started_at=_now())
        t0 = time.perf_counter()
        try:
            result = await asyncio.wait_for(asyncio.to_thread(work, ev), timeout=timeout_s)
            if ev.is_set():
                return
            self.store.update(run_id, status="succeeded", finished_at=_now(), result=result.model_dump(mode="json"))
        except asyncio.TimeoutError:
            ev.set()  # ask the worker thread to stop
            self.store.update(run_id, status="timed_out", finished_at=_now(), error=f"Exceeded timeout of {timeout_s:g}s")
        except BaseException as exc:  # noqa: BLE001 - recorded on the run, never swallowed
            if isinstance(exc, cancel_exc) or ev.is_set():
                return
            if isinstance(exc, timeout_exc):
                self.store.update(run_id, status="timed_out", finished_at=_now(), error=str(exc))
            else:
                log.exception("optimization run failed", extra={"run_id": run_id})
                self.store.update(run_id, status="failed", finished_at=_now(), error=f"{type(exc).__name__}: {exc}")
        finally:
            log.info("run finished", extra={"run_id": run_id, "runtime_s": round(time.perf_counter() - t0, 3)})
            self._events.pop(run_id, None)

    def cancel(self, run_id: str) -> RunRecord | None:
        rec = self.store.get(run_id)
        if rec is None:
            return None
        if rec.status in ("queued", "running"):
            ev = self._events.get(run_id)
            if ev:
                ev.set()
            return self.store.update(run_id, status="cancelled", finished_at=_now())
        return rec
