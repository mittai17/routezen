#!/usr/bin/env bash
# RouteZen smoke driver: ensures backend (:8000) + frontend (:3000) are up,
# curls representative API calls, screenshots routes with headless Chrome.
# Usage (from repo root): .claude/skills/run-routezen/smoke.sh [outdir] [route ...]
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="${1:-/tmp/routezen-shots}"; shift || true
ROUTES=("${@:-/ /plan /locations /vehicles}")
API=http://localhost:8000/api/v1
mkdir -p "$OUT"; LOGS="$OUT/logs"; mkdir -p "$LOGS"

up() { curl -s -o /dev/null -m 3 "$1"; }
if ! up $API/health; then
  (cd "$ROOT/backend" && nohup .venv/bin/uvicorn app.main:app --port 8000 >"$LOGS/api.log" 2>&1 &)
fi
if ! up http://localhost:3000/; then
  (cd "$ROOT/frontend" && nohup npm run dev -- -p 3000 >"$LOGS/web.log" 2>&1 &)
fi
for i in $(seq 1 60); do up $API/health && up http://localhost:3000/ && break; sleep 1; done

echo "== API"; curl -s -m 20 $API/ready; echo
curl -s -m 20 "$API/vehicles?limit=1" | head -c 200; echo
curl -s -m 30 -X POST $API/routing/route -H 'content-type: application/json' \
  -d '{"coordinates":[{"lat":13.0827,"lng":80.2707},{"lat":13.0418,"lng":80.2341}]}' \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('route km',d.get('distance_km'),'pts',len(d.get('geometry',[])))"

echo "== Screenshots"
for r in ${ROUTES[@]}; do
  f="$OUT/$(echo "$r" | tr '/' '_' | sed 's/^_$/_home/;s/^_//').png"
  google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size=1536,1024 --virtual-time-budget=8000 --screenshot="$f" \
    "http://localhost:3000$r" >/dev/null 2>&1
  ls -la "$f" 2>/dev/null || echo "FAILED $r"
done
