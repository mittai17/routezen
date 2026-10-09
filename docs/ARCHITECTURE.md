# RouteZen — Architecture & Contracts (source of truth for all agents)

Monorepo: `frontend/` (Next.js 16 App Router, TS strict, Tailwind v4, shadcn/ui), `backend/` (FastAPI, Python venv at `backend/.venv`), `docs/`.
Visual source of truth: `docs/reference/board-all-screens.png` (9 screens) and `docs/reference/plan-route-detail.png` (Plan Route detail). LOOK AT THEM.

## Visual language (derived from references)
- Sidebar: near-black (#0B0F14-ish), 220px wide, logo top (pin icon yellow/green + "Route**Zen**" wordmark, tagline "Smarter Deliveries. Greener Tomorrow."), items with Lucide icons, active item = solid amber/yellow (#FFC629-ish) pill with dark text.
- Sidebar order: Dashboard, Plan Route, Locations, Vehicles, Optimization, Live Tracking, Analytics, Scenarios, History(Reports), Reports, Settings. (Product spec uses: Overview, Plan Delivery, Locations, Packages, Vehicle Profiles, Optimization Results, Live Tracking, Analytics, Scenarios, Reports, Settings — use the spec's labels, reference's look.)
- Sidebar footer: Chennai promo card, plan card, workspace chip (dev workspace — NO auth).
- Top bar: search "Search location in Chennai…", weather chip, bell, theme toggle, avatar.
- Content: light panels (#F6F7F9 bg, white cards, radius 14-16px, subtle border), amber primary CTA ("Optimize Routes", "Run Optimization"), green for success/recommended, blue/purple/pink accents in charts.
- Plan Delivery: 5-step stepper at top (Locations → Vehicle Recommendation → Constraints → Optimize → Results), left list of stops with numbered markers, centre map (Leaflet, satellite/map/traffic toggles, legend), right "Vehicle Recommendation" list with "View Reason", bottom summary cards + charts (Mileage km/L, Cost per delivery ₹, Delivery time per vehicle).
- Currency ₹, km, Chennai (T. Nagar, Anna Nagar, Adyar, Velachery, Porur, Mogappair, Guindy, Besant Nagar, Sholinganallur, OMR, Thiruvanmiyur, Marina Beach, airport).

## Hard rules
- No authentication. Dev workspace id constant `dev-workspace`.
- Never draw straight lines as routes. Road geometry from OSRM only; if unavailable show explicit "routing unavailable" and label any straight-line distance as fallback estimate.
- Never fabricate "quantum advantage". Qiskit Aer = simulation, label it.
- Demo/mock data must be labelled "Demo data" in UI. Vehicle specs carry `source` + `verification` (`measured|external|user|assumed`).
- No secrets committed. `.env.example` placeholders only.

## API (all under `/api/v1`, JSON, snake_case)
Money = decimal string/number in ₹ (backend Numeric(12,2)). Distances km, durations minutes, weights kg, volumes m³.

Health: `GET /health`, `GET /ready` → `{status, db, routing, optimizer, quantum}` (no secrets).
Locations: `GET/POST /locations`, `GET/PUT/DELETE /locations/{id}`; Location `{id,name,address,latitude,longitude,type:'depot'|'stop'|'warehouse',zone,notes}`.
Packages: `GET/POST /packages`, `GET/PUT/DELETE /packages/{id}`; Package `{id,reference,recipient,location_id,address,latitude,longitude,weight_kg,length_cm,width_cm,height_cm,volume_m3,priority:'low'|'medium'|'high',handling:['fragile'|...],window_start,window_end,deadline,service_minutes,kind:'delivery'|'pickup',status,notes}`.
Vehicles: `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/{id}`; VehicleProfile `{id,name,category,payload_kg,volume_m3,energy_type:'petrol'|'diesel'|'cng'|'electric',efficiency_value,efficiency_unit:'km_per_l'|'km_per_kwh',energy_price,fixed_cost_per_delivery,operating_cost_per_km,avg_speed_kmph,emissions_g_per_km,range_km,available,source,verification}`.
Routing: `POST /routing/route {coordinates:[{lat,lng}]}` → `{distance_km,duration_min,geometry:[[lat,lng],...],legs:[...],provider}`; `POST /routing/matrix {coordinates}` → `{distance_km:[[]],duration_min:[[]],provider}`; `GET /routing/status`.
Recommend: `POST /recommendations {package(s), depot, preferences, vehicle_ids?}` → list of `{package_id, recommended, alternatives[], ineligible[{vehicle_id,reasons[]}], distance_km, duration_min, explanation, assumptions[]}`; each option has `{vehicle_id,name,category,energy_used,energy_unit,variable_cost,fixed_cost,total_cost,cost_per_km,payload_utilisation,volume_utilisation,deadline_feasible,score}`.
Plans: `GET/POST /plans`, `GET/PUT/DELETE /plans/{id}`, `POST /plans/validate`.
Optimization: `POST /optimization/classical`, `POST /optimization/quantum`, `POST /optimization/hybrid` (async job → persistent run id), `GET /optimization/runs`, `GET /optimization/runs/{id}`, `POST /optimization/runs/{id}/cancel`, `GET /optimization/compare?classical=&quantum=`. Hybrid uses simulated QAOA proposals as OR-Tools seeds and retains the classical baseline on regression or infeasibility.
Scenarios: `GET/POST /scenarios`, `GET/PUT/DELETE /scenarios/{id}`, `POST /scenarios/{id}/run`, `POST /scenarios/compare`.
Analytics: `GET /analytics/summary|cost|energy|vehicles|optimization`. Reports: `GET /reports/{kind}.csv`.
Events: `GET/POST /events`.
Settings: `GET/PUT /settings`.

## Frontend structure
`src/lib/api/` (typed client + `mock/` isolated demo-data mechanism, switch via `NEXT_PUBLIC_USE_DEMO_DATA`), `src/lib/schemas/` (zod), `src/components/{ui,shell,brand,maps,charts}`, routes in `src/app/(app)/…` (authenticated-less app shell) and `src/app/(public)/…`.
Map: Leaflet via client-only dynamic import. Tiles: OSM (documented usage-policy note) + Esri satellite toggle.

## Ownership
- Frontend agents: ONLY `frontend/**`. Backend agents: ONLY `backend/**`. Docs/README/.env.example: lead.
