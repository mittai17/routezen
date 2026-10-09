---
name: run-routezen
description: Run, start, build, test and screenshot the RouteZen web app (Next.js frontend on :3000 + FastAPI backend on :8000, Neon Postgres). Use when asked to run RouteZen, start the dev servers, verify the UI in a browser, take a screenshot of a page, or smoke-test the API.
---

# Run RouteZen

Paths are relative to the repo root (`ROUTEZEN/`). Two services: `frontend/` (Next.js 16, npm) and `backend/` (FastAPI, venv at `backend/.venv`). The driver is `smoke.sh`: it starts whichever service is not already up, curls the API, and screenshots routes with headless `google-chrome`. (No `chromium-cli` on this machine.)

## Prerequisites
- Node 26 / npm, Python 3.14, `google-chrome` on PATH.
- Backend deps: `cd backend && python3 -m venv .venv && .venv/bin/pip install --resume-retries 20 --timeout 60 -r requirements.txt` (the OR-Tools wheel is ~30 MB and the download failed once on a flaky network; the retry flags fixed it).
- Frontend deps: `cd frontend && npm install`.
- `backend/.env` with `DATABASE_URL` (Neon, git-ignored; never print it). Without it the backend falls back to a local SQLite file. Use the `postgresql+psycopg://` scheme.

## Run (agent path)
```bash
.claude/skills/run-routezen/smoke.sh /tmp/routezen-shots / /plan /nonexistent
```
Arguments: output dir, then routes. It prints `/ready`, one vehicles call, a real OSRM route (Chennai, ~9.5 km) and writes `<route>.png` (1536x1024; `/` becomes `home.png`). Open the PNGs with the Read tool to inspect them. Logs for servers it started land in `<outdir>/logs/`.

Verified this session: `/plan` renders the shell, stepper, stop list and Leaflet map; `/nonexistent` renders the custom 404.

## Migrations and seed (Neon)
```bash
cd backend
.venv/bin/alembic upgrade head
PYTHONPATH=. .venv/bin/python scripts/seed.py     # idempotent; 7 demo vehicles, 6 locations
.venv/bin/python -m pytest -q                     # 77 tests, SQLite + mocked OSRM, no network
```
Frontend checks: `cd frontend && npm run lint && npx tsc --noEmit && npx vitest run`.

## Run (human path)
`cd backend && .venv/bin/uvicorn app.main:app --port 8000` and `cd frontend && npm run dev`, then open http://localhost:3000. API docs at http://localhost:8000/docs.

## Gotchas
- `NEXT_PUBLIC_USE_DEMO_DATA` defaults to **on**: pages show labelled "Demo data" and the map says "Routing unavailable" (demo mode has no road geometry). Set it to `false` in `frontend/.env.local` to hit the real API.
- Backend CORS allows only `http://localhost:3000`; other dev ports cannot call the API.
- List endpoints return `{items,total,limit,offset}` (max `limit=500`), not bare arrays.
- `scripts/seed.py` needs `PYTHONPATH=.`, otherwise `No module named 'app'`.
- The public OSRM server is rate-limited; set `OSRM_BASE_URL` for heavy use. Routing failures return 503 `routing_unavailable`, never a straight line.
- Quantum (Qiskit Aer) is capped at 4 stops and can take ~8 s; the result may not be optimal and is reported with its gap vs brute force.
- Optimization runs are kept in memory and are lost on backend restart.
- A stale `.next/types` directory can make `tsc` report errors for removed pages; delete `frontend/.next` if so.

## Troubleshooting
- `connection refused` on :8000 from the smoke script: check `<outdir>/logs/api.log`; usually a bad `DATABASE_URL`.
- `ready` shows `routing: degraded`: OSRM unreachable or slow; re-run, or point `OSRM_BASE_URL` elsewhere.
- `incomplete-download` from pip: re-run with the `--resume-retries` flags above.
