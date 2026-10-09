# RouteZen backend

FastAPI + SQLAlchemy 2 + Alembic. Python 3.14 (venv at `backend/.venv`). API contract: `../docs/ARCHITECTURE.md`; all routes under `/api/v1`. No authentication (dev workspace `dev-workspace`).

## Setup
```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env          # fill DATABASE_URL; never commit .env
```
`DATABASE_URL` accepts `postgresql://...` (normalised to the psycopg v3 driver) or `sqlite:///./routezen.db` for local dev.

## Run
```bash
.venv/bin/alembic upgrade head          # migrate
.venv/bin/python -m scripts.seed        # optional: demo Chennai vehicles/locations
.venv/bin/uvicorn app.main:app --reload --port 8000    # docs at /docs
```
Demo vehicle profiles are seeded with `verification='assumed'` and a source note; they are planning placeholders, not verified mileage.

## Test
```bash
.venv/bin/python -m pytest -q     # uses in-memory SQLite and a mocked OSRM (no network)
```

## Layout
- `app/core` settings (env) and JSON logging; `app/schemas` Pydantic v2 models; `app/db` models/session; `alembic/` migrations
- `app/services/recommendation.py` deterministic engine (formulas documented in the module docstring)
- `app/services/routing.py` OSRM client (TTL cache, `RoutingUnavailable`; haversine only as opt-in, labelled `fallback_estimate`)
- `app/services/optimizer_classical.py` OR-Tools VRP; `optimizer_quantum.py` QAOA on Aer (simulation, max 4 stops by default, hard cap 5)
- `app/services/run_store.py` run store interface + in-memory implementation (history resets on restart)
- `app/repositories` repository interface + SQL implementation; `app/api/v1` routers

## Notes
- List endpoints return `{items,total,limit,offset}`; filters are query params (e.g. `/vehicles?energy_type=diesel&available=true`), plus `q`, `sort`, `order`. CSV: `/<resource>/export.csv`, `/reports/<kind>.csv` (formula-injection guarded).
- OSRM public demo server is rate-limited and not for production; set `OSRM_BASE_URL` to your own instance.
- Quantum results are statevector SIMULATIONS; no quantum advantage is claimed.
