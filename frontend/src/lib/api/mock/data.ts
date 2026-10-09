/**
 * DEMO DATA. Everything in this folder is illustrative and must be labelled "Demo data" in the UI.
 * Coordinates are real Chennai locations; vehicle specs are assumptions, not measurements.
 */
import type { Location, Package, PlanStop, VehicleProfile } from "../types";

export const DEPOT = { id: "loc-depot", name: "Depot (Chennai Central)", lat: 13.0827, lng: 80.2757 };

export const demoLocations: Location[] = [
  { id: DEPOT.id, name: "Depot (Chennai Central)", address: "Chennai Central, Park Town, Chennai", latitude: 13.0827, longitude: 80.2757, type: "depot", zone: "Central", notes: "Demo data" },
  { id: "loc-anna", name: "Anna Nagar", address: "Anna Nagar, Chennai", latitude: 13.085, longitude: 80.2101, type: "stop", zone: "North-West", notes: null },
  { id: "loc-mogappair", name: "Mogappair", address: "Mogappair, Chennai", latitude: 13.0875, longitude: 80.17, type: "stop", zone: "North-West", notes: null },
  { id: "loc-porur", name: "Porur", address: "Porur, Chennai", latitude: 13.0382, longitude: 80.1565, type: "stop", zone: "West", notes: null },
  { id: "loc-tnagar", name: "T. Nagar", address: "T. Nagar, Chennai", latitude: 13.0418, longitude: 80.2341, type: "stop", zone: "Central", notes: null },
  { id: "loc-adyar", name: "Adyar", address: "Adyar, Chennai", latitude: 13.0012, longitude: 80.2565, type: "stop", zone: "South", notes: null },
  { id: "loc-velachery", name: "Velachery", address: "Velachery, Chennai", latitude: 12.9815, longitude: 80.218, type: "stop", zone: "South", notes: null },
  { id: "loc-besant", name: "Besant Nagar", address: "Besant Nagar, Chennai", latitude: 13.0002, longitude: 80.2668, type: "stop", zone: "South", notes: null },
  { id: "loc-guindy", name: "Guindy", address: "Guindy, Chennai", latitude: 13.0067, longitude: 80.2206, type: "stop", zone: "South-West", notes: null },
  { id: "loc-sholinganallur", name: "Sholinganallur", address: "Sholinganallur, OMR, Chennai", latitude: 12.901, longitude: 80.2279, type: "stop", zone: "OMR", notes: null },
  { id: "loc-thiruvanmiyur", name: "Thiruvanmiyur", address: "Thiruvanmiyur, Chennai", latitude: 12.983, longitude: 80.2594, type: "stop", zone: "South", notes: null },
  { id: "loc-marina", name: "Marina Beach", address: "Marina Beach, Chennai", latitude: 13.05, longitude: 80.2824, type: "stop", zone: "East", notes: null },
  { id: "loc-airport", name: "Chennai International Airport", address: "Meenambakkam, Chennai", latitude: 12.9941, longitude: 80.1709, type: "stop", zone: "South-West", notes: null },
];

type VSeed = [id: string, name: string, cat: string, payload: number, vol: number, energy: VehicleProfile["energy_type"], eff: number, price: number, fixed: number, perKm: number, speed: number, co2: number, range: number | null];
const vseed: VSeed[] = [
  ["veh-bike", "Bike", "Two-wheeler", 20, 0.08, "petrol", 32, 105, 6, 3.3, 28, 55, 300],
  ["veh-auto", "Auto", "Three-wheeler", 60, 0.4, "cng", 28, 80, 9, 4.2, 24, 90, 250],
  ["veh-car", "Car", "Passenger car", 150, 0.35, "petrol", 18, 105, 14, 6.5, 30, 140, 500],
  ["veh-van", "Van", "Light van", 500, 3, "diesel", 18, 92, 18, 7.8, 28, 190, 600],
  ["veh-minitruck", "Mini Truck", "Light truck", 1000, 6, "diesel", 12, 92, 24, 9.5, 26, 240, 600],
  ["veh-truck", "Truck", "Medium truck", 3000, 18, "diesel", 8, 92, 40, 13, 24, 380, 700],
  ["veh-drone", "Drone", "UAV", 5, 0.02, "electric", 20, 9, 12, 2.1, 40, 0, 12],
];
export const demoVehicles: VehicleProfile[] = vseed.map(([id, name, category, payload_kg, volume_m3, energy_type, efficiency_value, energy_price, fixed, perKm, avg_speed_kmph, emissions_g_per_km, range_km]) => ({
  id, name, category, payload_kg, volume_m3, energy_type, efficiency_value,
  efficiency_unit: energy_type === "electric" ? "km_per_kwh" : "km_per_l",
  energy_price, fixed_cost_per_delivery: fixed, operating_cost_per_km: perKm, avg_speed_kmph, emissions_g_per_km,
  range_km, available: true, source: "Demo data (assumed values, not measured)", verification: "assumed",
}));

const L = (id: string) => demoLocations.find((l) => l.id === id)!;
type SSeed = [loc: string, kind: PlanStop["zone_kind"], pk: number, kg: number, pr: PlanStop["priority"]];
const sseed: SSeed[] = [
  ["loc-anna", "Residential", 2, 6, "medium"],
  ["loc-mogappair", "Residential", 1, 3, "low"],
  ["loc-porur", "Commercial", 5, 25, "high"],
  ["loc-tnagar", "Commercial", 8, 18, "medium"],
  ["loc-adyar", "Residential", 2, 4, "low"],
  ["loc-velachery", "Residential", 3, 10, "medium"],
  ["loc-besant", "Residential", 2, 5, "low"],
  ["loc-sholinganallur", "Commercial", 6, 22, "high"],
];
export const demoPlanStops: PlanStop[] = sseed.map(([loc, zone_kind, packages, weight_kg, priority], i) => ({
  id: `stop-${i + 1}`, name: L(loc).name, address: L(loc).address ?? "", latitude: L(loc).latitude, longitude: L(loc).longitude,
  zone_kind, packages, weight_kg, priority, window_start: "09:00", window_end: "18:00", service_minutes: 5, kind: "delivery",
}));

export const demoPackages: Package[] = demoPlanStops.map((s, i) => ({
  id: `pkg-${i + 1}`, reference: `RZ-${1001 + i}`, recipient: s.name, location_id: sseed[i][0], address: s.address,
  latitude: s.latitude, longitude: s.longitude, weight_kg: s.weight_kg, length_cm: null, width_cm: null, height_cm: null, volume_m3: null,
  priority: s.priority, handling: [], window_start: s.window_start, window_end: s.window_end, deadline: null,
  service_minutes: s.service_minutes, kind: "delivery", status: "pending", notes: "Demo data",
}));
