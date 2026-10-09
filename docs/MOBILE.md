# RouteZen Mobile — contract for all mobile agents

Branch: **`mobile-app`** (created off `main` at commit `d6a10f9`). Push ONLY to this branch, never `main`.
App dir: `mobile/` (sibling to `frontend/`, `backend/`). Reference: `docs/reference/mobile-app-showcase.png` — read it before building any screen.
Backend: FastAPI at `http://localhost:8000/api/v1` (same backend as web, already running). Neon DB migrated to `0002` (smart-travel schema applied). Full REST contract: `docs/ARCHITECTURE.md` (delivery/logistics) + this file (travel, added since).

## Stack already scaffolded — do not re-scaffold
- Expo SDK 57, TypeScript strict (`tsconfig.json` has `strict: true`, passes `npx tsc --noEmit`).
- **Expo Router. Routes live in `mobile/src/app/`** (not root `app/` — see `mobile/AGENTS.md`, which is binding). Non-route code in `mobile/src/{components,lib,hooks}`.
- NativeWind v4 configured (`tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css` imported once in `src/app/_layout.tsx`). Use `className` on RN components.
- Installed: `expo-router`, `@tanstack/react-query` (QueryClientProvider already wraps the app in `_layout.tsx`), `react-hook-form`, `zod`, `@hookform/resolvers`, `lucide-react-native` + `react-native-svg`, `react-native-maps`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `jest-expo` + `@testing-library/react-native`.
- `mobile/AGENTS.md` is binding: use `npx expo install <pkg>` for anything with native code (never plain npm for those), check `https://docs.expo.dev/llms.txt` before using any Expo API from memory, run `npx expo lint` and `npx tsc --noEmit` before calling a task done.
- Design tokens are in `tailwind.config.js`: `brand.green #0E4429`, `brand.green-light #1B6B3F`, `brand.yellow #F4C430`, `brand.yellow-dark #D9A61E`, `surface`, `muted`, `border`, `ink`, `ink-muted`, `success/warning/danger/info`. Extend, don't duplicate.

## Testing device
Android emulator **Pixel_10_Pro** (AVD, Android 16 "Baklava", google_apis_playstore x86_64) is set up and bootable: `emulator -avd Pixel_10_Pro -no-snapshot -gpu swiftshader_indirect &` then `adb devices` to confirm, then `npx expo run:android` (dev client — Expo Go lacks `react-native-maps` native code) or `npx expo start` + press `a`. iOS cannot be tested here (no macOS); do not claim iOS verification.

## Real backend endpoints (verify against `backend/app/schemas/*.py` before coding — do not invent fields)
Delivery/logistics (full contract in `docs/ARCHITECTURE.md`): `/locations`, `/packages`, `/vehicles`, `/recommendations`, `/optimization/{classical,hybrid,quantum,annealing,reroute,runs}`, `/analytics/*`, `/scenarios`, `/events`, `/settings`. Lists return `{items,total,limit,offset}`. Optimization POSTs return 202 + run record; poll `GET /optimization/runs/{id}`.

Smart Travel (new, `backend/app/api/v1/travel.py`, prefix `/travel`):
- `GET/POST /travel/trips`, `GET/PATCH/DELETE /travel/trips/{id}` (`TravelTripOut`: id, workspace_id, name, origin/destination fields, created_at/updated_at — read `TravelTripBase` in `app/schemas/travel.py` for the exact field list, it has more than shown here).
- `GET/POST /travel/trips/{id}/preferences` (`TravelPreferencesOut`: pace, budget_category, total_budget_inr, accommodation_types, max_price_per_night, food_preference, interests, max_drive_hours_per_day, max_drive_km_per_day, avoid_night_driving, meal_budget_per_person, contingency_pct).
- `GET/POST/PATCH/DELETE /travel/trips/{id}/checkpoints`, `POST /travel/trips/{id}/reorder-checkpoints` (`TravelCheckpointOut`: sequence, name, address, lat, lng, type, is_mandatory, stay_overnight, planned_arrival/departure, activity_duration_min, travel_mode, vehicle_profile_id, notes).
- `POST /travel/trips/{id}/route-options` → `list[TravelRouteOptionOut]` (label, description, total_distance_km, total_duration_min, estimated_days, estimated_fuel_cost_inr, estimated_total_cost_inr, **geometry: list[[lat,lng]]** from real routing, checkpoints, is_selected, data_source, **fallback_estimate: bool**, note). Draw `geometry` only; if `fallback_estimate` is true, label it, never present as a road route.
- `GET /travel/trips/{id}/{stays,restaurants,attractions}` → `list[TravelPlaceOut]` (category, name, lat/lng, rating, review_count, price_min/max, amenities, opening_hours, website, **source** e.g. "osm", distance_from_route_km, detour_km, estimated_visit_min, entry_price_inr). `source` must be shown — this is real OSM/provider data, not invented.
- `POST /travel/trips/{id}/build-itinerary` → `list[TravelItineraryDayOut]` (day_number, date, drive_distance_km/duration_min, estimated_cost_inr, items: list of `{type: drive|stay|meal|attraction, label, start/end_time, duration_min, cost_inr, notes}`).
- `GET /travel/trips/{id}/budget` → `TripBudgetOut` (target_budget_inr, estimated_total_inr, fuel/accommodation/meals/attractions/tolls/parking_inr).

If a screen in the mobile spec needs a field or endpoint that doesn't exist on either router, say so explicitly in your report — do not fabricate it client-side and do not silently fake a successful response.

## Non-negotiable product rules (same as web, re-stated for mobile)
- Never draw a route as a straight line. Use `geometry` from the API only; if absent/fallback, show an explicit "routing unavailable" / "straight-line estimate" state.
- Never claim quantum advantage or live GPS/traffic that isn't real. Label simulation, demo data, and "route preview" vs real navigation honestly.
- No authentication unless it already exists server-side (it doesn't — dev workspace only).
- `.env.example` with placeholders only; `EXPO_PUBLIC_API_BASE_URL` for the API base (document that physical devices need the dev machine's LAN IP, not `localhost`).
- No secrets committed.

## File ownership (avoid collisions — one subagent per group)
1. **Design system + shell + navigation**: `src/components/{brand,ui}`, root `_layout.tsx`, bottom tabs `src/app/(tabs)/_layout.tsx`, splash/onboarding.
2. **Home + Logistics + Packages + Vehicles**: `src/app/(tabs)/{home,logistics}`, nested package/vehicle routes, `src/lib/api/{packages,vehicles,recommendations}.ts`.
3. **Smart Travel (planner, route options, trip details, navigation)**: `src/app/(tabs)/travel/**`, `src/lib/api/travel.ts`.
4. **Map + Quantum Lab + Analytics**: `src/app/(tabs)/map`, `src/app/(tabs)/lab` or nested under logistics, `src/app/(tabs)/analytics`, `src/lib/api/{optimization,analytics}.ts`.
5. **Profile/Settings + offline/storage + QA pass on the emulator**: `src/app/(tabs)/profile/**`, `src/lib/storage.ts`, then drives the Pixel_10_Pro emulator end-to-end and reports defects.

Each agent: read this file + `docs/ARCHITECTURE.md` + the reference image first. Run `npx tsc --noEmit` and `npx expo lint` before reporting done. Report real findings only — screens you did not run, say so.
