# RouteZen

**Smarter Routes. Greener Tomorrow.**

RouteZen is a delivery vehicle recommendation and route optimization web app (initial region: Chennai, Tamil Nadu; currency ₹, distances in km). It helps an operator choose a suitable vehicle per delivery, group and sequence stops, follow real road routes, and run classical, simulated-quantum, or hybrid quantum-assisted optimization.

Web only. No authentication in this phase (a fixed development workspace is used).

## Layout
| Path | What |
|---|---|
| `frontend/` | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, Leaflet, Recharts, TanStack Query |
| `backend/` | FastAPI, SQLAlchemy 2, Alembic, OR-Tools, Qiskit + Aer, OSRM client |
| `docs/` | `ARCHITECTURE.md` (API contract), `reference/` (UI references) |
| `.claude/skills/run-routezen/` | Agent driver `smoke.sh` and run notes |

## Setup
Requirements: Node 22+, Python 3.12+ (developed on 3.14), a Neon account with `neonctl` logged in.

```bash
# backend
cd backend
python3 -m venv .venv
.venv/bin/pip install --resume-retries 20 --timeout 60 -r requirements.txt
cp .env.example .env            # then set DATABASE_URL (never commit .env)
.venv/bin/alembic upgrade head
PYTHONPATH=. .venv/bin/python scripts/seed.py   # demo vehicle profiles + Chennai locations
.venv/bin/uvicorn app.main:app --port 8000

# frontend
cd frontend
npm install
cp .env.example .env.local      # set NEXT_PUBLIC_USE_DEMO_DATA=false to use the real API
npm run dev                     # http://localhost:3000
```

### Database (Neon)
The project database is a dedicated Neon project named `routezen`, created with `neonctl projects create`. Get a connection string with `neonctl connection-string --project-id <id>` and put it in `backend/.env` as `DATABASE_URL`. Secrets live only in git-ignored env files. Timestamps are stored as UTC (timezone-aware); money uses `Numeric(12,2)`. Tests use in-memory SQLite and a mocked routing service.

### Demo vs real data
`NEXT_PUBLIC_USE_DEMO_DATA` defaults to **true**: pages show clearly labelled "Demo data" and no road geometry (routing needs the backend). Set it to `false` to use the API, Neon and OSRM.

## Verify
```bash
cd backend && .venv/bin/python -m pytest -q
cd frontend && npm run lint && npx tsc --noEmit && npx vitest run && npm run build
.claude/skills/run-routezen/smoke.sh /tmp/shots / /plan /nonexistent   # API checks + screenshots
```

## How the pieces fit (and what they do not claim)
- **Recommendation engine** (`backend/app/services/recommendation.py`): deterministic. Hard filters on payload, volume, availability, range and deadline first; then cost (fuel: distance ÷ km/L × price; EV: distance × kWh/km × tariff, plus operating and fixed charges) and weighted scoring. It is not machine learning.
- **Routing**: OSRM road geometry and distances. If OSRM is unreachable the API returns 503 `routing_unavailable`; a straight-line figure is only available as an explicit, labelled fallback estimate and is never drawn as a route.
- **Classical optimizer**: OR-Tools VRP with capacity (weight, volume), time windows, vehicle availability, max stops and weighted objectives.
- **Quantum experiment**: QAOA on a stop-ordering QUBO, run on the Qiskit **Aer simulator** (not quantum hardware), capped at 4 stops, with brute-force comparison on the same matrix. The result may be suboptimal and no quantum advantage is claimed.
- **Hybrid optimizer**: first builds a feasible OR-Tools baseline, splits its routes into groups of at most four stops, uses simulated QAOA to propose an order for each group, then asks OR-Tools to validate and refine the combined seed. It keeps the classical baseline whenever the proposal is infeasible or worse. The UI reports which result was selected and local gaps against brute force.
- **Run history**: optimization requests and outcomes are stored in Postgres/SQLite through the `optimization_runs` table. Jobs interrupted by a backend restart are closed as failed so they can be resubmitted.

## Known limitations
- Vehicle specs are seeded as `assumed` demo values; replace them with verified data before relying on cost figures.
- The in-process job runner assumes a single API worker. Multiple workers need a shared queue plus worker leases/heartbeats.
- The hybrid method uses a classical simulation of QAOA and small local subproblems; it does not demonstrate quantum speed-up or global quantum optimality.
- Archive (vehicles, scenarios) is a client-side convention; the backend has no `archived` column yet.
- Scenario "higher fuel price" what-if needs a backend per-scenario override (disabled in the UI).
- Public OSRM and OpenStreetMap tile servers are rate limited and not for production traffic; set `OSRM_BASE_URL` and a production tile provider.
- Plan Delivery supports same-day `HH:MM` windows by converting them to route-relative minutes. Overnight and multi-day windows still require package records with timezone-aware datetimes.

## Legal
The Privacy, Terms, Cookies and Acceptable Use pages are original drafts and **must be reviewed by a qualified professional before any commercial launch**. They make no compliance or certification claims.
