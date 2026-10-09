/**
 * Smart Travel API client.
 * Uses USE_DEMO_DATA flag (default: true) for a functional demo without a running backend.
 * When backend is available, all calls hit /api/v1/travel/*.
 */
import { z } from "zod";
import { request, USE_DEMO_DATA } from "./client";

// ── Enums ──────────────────────────────────────────────────────────────────

export type TripStatus = "draft" | "planned" | "active" | "completed" | "archived";
export type TravelMode = "car" | "motorcycle" | "ev" | "van";
export type TripPace = "relaxed" | "balanced" | "fast";
export type BudgetCategory = "budget" | "mid_range" | "premium" | "custom";
export type AccommodationType = "budget_hotel" | "mid_hotel" | "homestay" | "hostel" | "camping";
export type FoodPref = "any" | "vegetarian" | "non_vegetarian" | "vegan";
export type CheckpointType = "origin" | "destination" | "mandatory" | "optional" | "sightseeing" | "food_stop" | "rest" | "fuel" | "overnight" | "pass_through";
export type PlaceCategory = "stay" | "restaurant" | "attraction";

// ── Zod Schemas ────────────────────────────────────────────────────────────

export const coordSchema = z.object({ lat: z.number(), lng: z.number() });

export const travelTripSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  status: z.string(),
  origin_name: z.string(),
  origin_lat: z.number(),
  origin_lng: z.number(),
  destination_name: z.string(),
  destination_lat: z.number(),
  destination_lng: z.number(),
  departure_date: z.string().nullable(),
  return_date: z.string().nullable(),
  is_one_way: z.boolean(),
  adults: z.number(),
  children: z.number(),
  older_travellers: z.number(),
  travel_mode: z.string(),
  vehicle_profile_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TravelTrip = z.infer<typeof travelTripSchema>;

export const tripListSchema = z.array(travelTripSchema);

export const travelPreferencesSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  pace: z.string(),
  budget_category: z.string(),
  total_budget_inr: z.number().nullable(),
  accommodation_types: z.array(z.string()),
  max_price_per_night: z.number().nullable(),
  food_preference: z.string(),
  interests: z.array(z.string()),
  max_drive_hours_per_day: z.number(),
  max_drive_km_per_day: z.number().nullable(),
  avoid_night_driving: z.boolean(),
  meal_budget_per_person: z.number().nullable(),
  contingency_pct: z.number(),
});
export type TravelPreferences = z.infer<typeof travelPreferencesSchema>;

export const checkpointSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  sequence: z.number(),
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  type: z.string(),
  is_mandatory: z.boolean(),
  stay_overnight: z.boolean(),
  planned_arrival: z.string().nullable(),
  planned_departure: z.string().nullable(),
  activity_duration_min: z.number(),
  notes: z.string().nullable(),
  distance_from_prev_km: z.number().nullable(),
  duration_from_prev_min: z.number().nullable(),
});
export type TravelCheckpoint = z.infer<typeof checkpointSchema>;

export const routeOptionSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  label: z.string(),
  description: z.string(),
  total_distance_km: z.number(),
  total_duration_min: z.number(),
  estimated_days: z.number(),
  estimated_fuel_cost_inr: z.number().nullable(),
  estimated_total_cost_inr: z.number().nullable(),
  geometry: z.array(z.tuple([z.number(), z.number()])),
  checkpoints: z.array(z.string()),
  is_selected: z.boolean(),
  data_source: z.string(),
  fallback_estimate: z.boolean(),
  note: z.string().nullable(),
});
export type RouteOption = z.infer<typeof routeOptionSchema>;

export const placeSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  checkpoint_id: z.string().nullable(),
  category: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  description: z.string().nullable(),
  rating: z.number().nullable(),
  review_count: z.number().nullable(),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  price_label: z.string().nullable(),
  amenities: z.array(z.string()),
  opening_hours: z.string().nullable(),
  website: z.string().nullable(),
  source: z.string(),
  last_checked: z.string().nullable(),
  is_selected: z.boolean(),
  distance_from_route_km: z.number().nullable(),
  detour_km: z.number().nullable(),
  estimated_visit_min: z.number().nullable(),
  entry_price_inr: z.number().nullable(),
});
export type TravelPlace = z.infer<typeof placeSchema>;

export const itineraryDaySchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  day_number: z.number(),
  date: z.string().nullable(),
  start_checkpoint_id: z.string().nullable(),
  end_checkpoint_id: z.string().nullable(),
  drive_distance_km: z.number(),
  drive_duration_min: z.number(),
  estimated_cost_inr: z.number(),
  notes: z.string().nullable(),
  items: z.array(z.object({
    id: z.string(),
    sequence: z.number(),
    type: z.string(),
    label: z.string(),
    place_id: z.string().nullable(),
    checkpoint_id: z.string().nullable(),
    start_time: z.string().nullable(),
    end_time: z.string().nullable(),
    duration_min: z.number(),
    cost_inr: z.number(),
    notes: z.string().nullable(),
  })),
});
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;

export const budgetSchema = z.object({
  trip_id: z.string(),
  target_budget_inr: z.number().nullable(),
  estimated_total_inr: z.number(),
  fuel_inr: z.number(),
  accommodation_inr: z.number(),
  meals_inr: z.number(),
  attractions_inr: z.number(),
  tolls_inr: z.number().nullable(),
  parking_inr: z.number(),
  other_inr: z.number(),
  contingency_inr: z.number(),
  unknown_items: z.array(z.string()),
  over_budget: z.boolean(),
  day_totals: z.array(z.object({ day: z.number(), date: z.string().nullable(), total_inr: z.number() })),
  assumptions: z.array(z.string()),
  data_source: z.string(),
});
export type TripBudget = z.infer<typeof budgetSchema>;

// ── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_TRIP: TravelTrip = {
  id: "demo-trip-001",
  workspace_id: "dev-workspace",
  name: "Chennai to Leh — Grand Adventure",
  status: "planned",
  origin_name: "Chennai, Tamil Nadu",
  origin_lat: 13.0827,
  origin_lng: 80.2707,
  destination_name: "Leh, Ladakh",
  destination_lat: 34.1526,
  destination_lng: 77.5771,
  departure_date: "2025-05-13",
  return_date: null,
  is_one_way: true,
  adults: 2,
  children: 0,
  older_travellers: 0,
  travel_mode: "car",
  vehicle_profile_id: null,
  notes: "Looking for scenic routes and great local food",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_TRIPS: TravelTrip[] = [DEMO_TRIP];

const DEMO_PREFS: TravelPreferences = {
  id: "demo-pref-001",
  trip_id: "demo-trip-001",
  pace: "balanced",
  budget_category: "mid_range",
  total_budget_inr: 80000,
  accommodation_types: ["mid_hotel", "homestay"],
  max_price_per_night: 2500,
  food_preference: "vegetarian",
  interests: ["nature", "historical_places", "local_food", "photography"],
  max_drive_hours_per_day: 8,
  max_drive_km_per_day: 350,
  avoid_night_driving: true,
  meal_budget_per_person: 400,
  contingency_pct: 10,
};

const DEMO_CHECKPOINTS: TravelCheckpoint[] = [
  { id: "cp-01", trip_id: "demo-trip-001", sequence: 0, name: "Chennai, Tamil Nadu", address: "Chennai, TN", lat: 13.0827, lng: 80.2707, type: "origin", is_mandatory: true, stay_overnight: false, planned_arrival: null, planned_departure: "2025-05-13T06:00:00", activity_duration_min: 0, notes: null, distance_from_prev_km: null, duration_from_prev_min: null },
  { id: "cp-02", trip_id: "demo-trip-001", sequence: 1, name: "Vijayawada, Andhra Pradesh", address: "Vijayawada, AP", lat: 16.5062, lng: 80.6480, type: "mandatory", is_mandatory: true, stay_overnight: true, planned_arrival: "2025-05-13T14:00:00", planned_departure: "2025-05-14T07:00:00", activity_duration_min: 120, notes: "Kanaka Durga temple visit", distance_from_prev_km: 422, duration_from_prev_min: 360 },
  { id: "cp-03", trip_id: "demo-trip-001", sequence: 2, name: "Hyderabad, Telangana", address: "Hyderabad, TS", lat: 17.3850, lng: 78.4867, type: "mandatory", is_mandatory: true, stay_overnight: true, planned_arrival: "2025-05-14T12:00:00", planned_departure: "2025-05-15T07:00:00", activity_duration_min: 240, notes: "Charminar & Golconda Fort", distance_from_prev_km: 280, duration_from_prev_min: 240 },
  { id: "cp-04", trip_id: "demo-trip-001", sequence: 3, name: "Nagpur, Maharashtra", address: "Nagpur, MH", lat: 21.1458, lng: 79.0882, type: "optional", is_mandatory: false, stay_overnight: true, planned_arrival: "2025-05-15T18:00:00", planned_departure: "2025-05-16T07:00:00", activity_duration_min: 60, notes: null, distance_from_prev_km: 502, duration_from_prev_min: 420 },
  { id: "cp-05", trip_id: "demo-trip-001", sequence: 4, name: "Jhansi, Uttar Pradesh", address: "Jhansi, UP", lat: 25.4484, lng: 78.5685, type: "optional", is_mandatory: false, stay_overnight: true, planned_arrival: "2025-05-16T17:00:00", planned_departure: "2025-05-17T07:00:00", activity_duration_min: 90, notes: "Jhansi Fort", distance_from_prev_km: 425, duration_from_prev_min: 380 },
  { id: "cp-06", trip_id: "demo-trip-001", sequence: 5, name: "Delhi, NCR", address: "New Delhi", lat: 28.6139, lng: 77.2090, type: "mandatory", is_mandatory: true, stay_overnight: true, planned_arrival: "2025-05-17T14:00:00", planned_departure: "2025-05-18T07:00:00", activity_duration_min: 180, notes: "India Gate & Old Delhi", distance_from_prev_km: 415, duration_from_prev_min: 360 },
  { id: "cp-07", trip_id: "demo-trip-001", sequence: 6, name: "Manali, Himachal Pradesh", address: "Manali, HP", lat: 32.2396, lng: 77.1887, type: "mandatory", is_mandatory: true, stay_overnight: true, planned_arrival: "2025-05-18T20:00:00", planned_departure: "2025-05-19T06:00:00", activity_duration_min: 120, notes: "Acclimatisation stop", distance_from_prev_km: 562, duration_from_prev_min: 480 },
  { id: "cp-08", trip_id: "demo-trip-001", sequence: 7, name: "Leh, Ladakh", address: "Leh, Ladakh", lat: 34.1526, lng: 77.5771, type: "destination", is_mandatory: true, stay_overnight: false, planned_arrival: "2025-05-20T14:00:00", planned_departure: null, activity_duration_min: 0, notes: null, distance_from_prev_km: 479, duration_from_prev_min: 420 },
];

const DEMO_ROUTE_OPTIONS: RouteOption[] = [
  {
    id: "route-01", trip_id: "demo-trip-001", label: "Recommended Route", description: "Via Vijayawada → Hyderabad → Delhi → Manali", total_distance_km: 3100, total_duration_min: 2640, estimated_days: 12, estimated_fuel_cost_inr: 16800, estimated_total_cost_inr: 48000, geometry: [[13.0827, 80.2707], [16.5062, 80.6480], [17.3850, 78.4867], [21.1458, 79.0882], [28.6139, 77.2090], [32.2396, 77.1887], [34.1526, 77.5771]], checkpoints: ["cp-01", "cp-02", "cp-03", "cp-04", "cp-06", "cp-07", "cp-08"], is_selected: true, data_source: "osrm+demo", fallback_estimate: false, note: null,
  },
  {
    id: "route-02", trip_id: "demo-trip-001", label: "Fastest Route", description: "Direct via NH-44 — fewer stops, 10–11 days", total_distance_km: 2750, total_duration_min: 2280, estimated_days: 10, estimated_fuel_cost_inr: 14900, estimated_total_cost_inr: 42000, geometry: [[13.0827, 80.2707], [17.3850, 78.4867], [28.6139, 77.2090], [34.1526, 77.5771]], checkpoints: ["cp-01", "cp-03", "cp-06", "cp-08"], is_selected: false, data_source: "osrm+demo", fallback_estimate: false, note: null,
  },
  {
    id: "route-03", trip_id: "demo-trip-001", label: "Scenic Route", description: "Southern + Northern highway with extra hill stops", total_distance_km: 3300, total_duration_min: 3000, estimated_days: 15, estimated_fuel_cost_inr: 17900, estimated_total_cost_inr: 58000, geometry: [[13.0827, 80.2707], [16.5062, 80.6480], [17.3850, 78.4867], [21.1458, 79.0882], [25.4484, 78.5685], [28.6139, 77.2090], [32.2396, 77.1887], [34.1526, 77.5771]], checkpoints: ["cp-01", "cp-02", "cp-03", "cp-04", "cp-05", "cp-06", "cp-07", "cp-08"], is_selected: false, data_source: "osrm+demo", fallback_estimate: false, note: "Includes Nagpur & Jhansi stops",
  },
];

const DEMO_STAYS: TravelPlace[] = [
  { id: "stay-01", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "stay", name: "Hotel Abode", address: "Banjara Hills, Hyderabad", lat: 17.4126, lng: 78.4483, description: "Comfortable mid-range hotel near Banjara Hills", rating: 4.2, review_count: 230, price_min: 1600, price_max: 1800, price_label: "₹1,800/night (est.)", amenities: ["Free WiFi", "Breakfast", "Parking"], opening_hours: null, website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: true, distance_from_route_km: 2.1, detour_km: 0, estimated_visit_min: null, entry_price_inr: null },
  { id: "stay-02", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "stay", name: "The Central Court", address: "HITEC City, Hyderabad", lat: 17.4435, lng: 78.3772, description: "Business hotel near HITEC City", rating: 4.1, review_count: 185, price_min: 1900, price_max: 2100, price_label: "₹2,000/night (est.)", amenities: ["WiFi", "AC Rooms"], opening_hours: null, website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: false, distance_from_route_km: 4.5, detour_km: 2, estimated_visit_min: null, entry_price_inr: null },
  { id: "stay-03", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "stay", name: "Deccan Comforts", address: "Secunderabad, Hyderabad", lat: 17.4399, lng: 78.4983, description: "Budget option near Secunderabad station", rating: 3.9, review_count: 412, price_min: 1400, price_max: 1700, price_label: "₹1,600/night (est.)", amenities: ["Free WiFi", "AC Rooms", "Parking"], opening_hours: null, website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: false, distance_from_route_km: 3.2, detour_km: 1, estimated_visit_min: null, entry_price_inr: null },
];

const DEMO_RESTAURANTS: TravelPlace[] = [
  { id: "rest-01", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "restaurant", name: "Bawchi Restaurant", address: "Basheer Bagh, Hyderabad", lat: 17.4062, lng: 78.4691, description: "Famous for Hyderabadi Biryani", rating: 4.4, review_count: 2500, price_min: 300, price_max: 500, price_label: "₹300–500 per person", amenities: ["Vegetarian options", "AC"], opening_hours: "12:00–22:30", website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: false, distance_from_route_km: 1.2, detour_km: 0, estimated_visit_min: 60, entry_price_inr: null },
  { id: "rest-02", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "restaurant", name: "Paradise Biryani", address: "Secunderabad, Hyderabad", lat: 17.4428, lng: 78.5029, description: "Iconic biryani — Muglai style", rating: 4.2, review_count: 5000, price_min: 300, price_max: 500, price_label: "₹300–500 per person", amenities: ["Vegetarian options"], opening_hours: "11:30–23:00", website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: false, distance_from_route_km: 3.0, detour_km: 1.5, estimated_visit_min: 60, entry_price_inr: null },
  { id: "rest-03", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "restaurant", name: "Chris Jiva Imperia", address: "HITEC City, Hyderabad", lat: 17.4450, lng: 78.3800, description: "Multi-cuisine restaurant", rating: 4.3, review_count: 680, price_min: 400, price_max: 600, price_label: "₹400–600 per person", amenities: ["Vegetarian", "Vegan options", "AC"], opening_hours: "11:00–23:00", website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: false, distance_from_route_km: 4.8, detour_km: 3.2, estimated_visit_min: 75, entry_price_inr: null },
];

const DEMO_ATTRACTIONS: TravelPlace[] = [
  { id: "attr-01", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "attraction", name: "Charminar", address: "Old City, Hyderabad", lat: 17.3616, lng: 78.4747, description: "Iconic 16th-century mosque and monument — must visit", rating: 4.4, review_count: 14200, price_min: 25, price_max: 25, price_label: "₹25 entry", amenities: ["Historic site", "Photography"], opening_hours: "09:00–17:30", website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: false, distance_from_route_km: 2.5, detour_km: 1, estimated_visit_min: 90, entry_price_inr: 25 },
  { id: "attr-02", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "attraction", name: "Golconda Fort", address: "Golconda, Hyderabad", lat: 17.3833, lng: 78.4011, description: "Fort & history — acoustics demonstration included", rating: 4.3, review_count: 11800, price_min: 15, price_max: 15, price_label: "₹15 entry", amenities: ["Historic site", "Guided tours"], opening_hours: "08:00–17:30", website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: true, distance_from_route_km: 5.0, detour_km: 2.5, estimated_visit_min: 120, entry_price_inr: 15 },
  { id: "attr-03", trip_id: "demo-trip-001", checkpoint_id: "cp-03", category: "attraction", name: "Hussain Sagar Lake", address: "Tank Bund, Hyderabad", lat: 17.4239, lng: 78.4738, description: "Large artificial lake with Buddha statue on island", rating: 4.1, review_count: 6400, price_min: null, price_max: null, price_label: "Free entry", amenities: ["Photography", "Boating"], opening_hours: "06:00–21:00", website: null, source: "osm_demo", last_checked: new Date().toISOString(), is_selected: false, distance_from_route_km: 1.0, detour_km: 0, estimated_visit_min: 60, entry_price_inr: 0 },
];

const DEMO_BUDGET: TripBudget = {
  trip_id: "demo-trip-001",
  target_budget_inr: 80000,
  estimated_total_inr: 48000,
  fuel_inr: 16800,
  accommodation_inr: 14000,
  meals_inr: 6000,
  attractions_inr: 1600,
  tolls_inr: 4200,
  parking_inr: 1200,
  other_inr: 0,
  contingency_inr: 4200,
  unknown_items: ["Toll estimates may vary by route", "Electricity tariff not configured for EV segments"],
  over_budget: false,
  day_totals: [
    { day: 1, date: "2025-05-13", total_inr: 3500 },
    { day: 2, date: "2025-05-14", total_inr: 4000 },
    { day: 3, date: "2025-05-15", total_inr: 4500 },
    { day: 4, date: "2025-05-16", total_inr: 3800 },
    { day: 5, date: "2025-05-17", total_inr: 4200 },
    { day: 6, date: "2025-05-18", total_inr: 5100 },
    { day: 7, date: "2025-05-19", total_inr: 5600 },
    { day: 8, date: "2025-05-20", total_inr: 4200 },
  ],
  assumptions: [
    "Fuel: Petrol @ ₹105/L, mileage 14 km/L",
    "Accommodation: ₹1,800/night avg, 8 nights",
    "Meals: ₹400/person/day × 2 adults × 8 days",
    "Contingency: 10% of sub-total",
    "Tolls: estimated from NH route — actual may differ",
  ],
  data_source: "demo_calculation",
};

const DEMO_ITINERARY: ItineraryDay[] = [
  {
    id: "day-01", trip_id: "demo-trip-001", day_number: 1, date: "2025-05-13",
    start_checkpoint_id: "cp-01", end_checkpoint_id: "cp-02",
    drive_distance_km: 422, drive_duration_min: 360, estimated_cost_inr: 3500, notes: "Start early from Chennai",
    items: [
      { id: "item-01a", sequence: 0, type: "drive", label: "Chennai → Vijayawada", place_id: null, checkpoint_id: "cp-02", start_time: "06:00", end_time: "14:00", duration_min: 360, cost_inr: 2800, notes: null },
      { id: "item-01b", sequence: 1, type: "stay", label: "Check-in Vijayawada hotel", place_id: null, checkpoint_id: "cp-02", start_time: "14:30", end_time: "15:00", duration_min: 30, cost_inr: 700, notes: null },
    ],
  },
  {
    id: "day-02", trip_id: "demo-trip-001", day_number: 2, date: "2025-05-14",
    start_checkpoint_id: "cp-02", end_checkpoint_id: "cp-03",
    drive_distance_km: 280, drive_duration_min: 240, estimated_cost_inr: 4000, notes: "Hyderabad sightseeing day",
    items: [
      { id: "item-02a", sequence: 0, type: "drive", label: "Vijayawada → Hyderabad", place_id: null, checkpoint_id: "cp-03", start_time: "07:00", end_time: "11:00", duration_min: 240, cost_inr: 1900, notes: null },
      { id: "item-02b", sequence: 1, type: "attraction", label: "Golconda Fort visit", place_id: "attr-02", checkpoint_id: "cp-03", start_time: "12:00", end_time: "14:00", duration_min: 120, cost_inr: 30, notes: "₹15 entry × 2 adults" },
      { id: "item-02c", sequence: 2, type: "meal", label: "Lunch at Bawchi", place_id: "rest-01", checkpoint_id: "cp-03", start_time: "14:30", end_time: "15:30", duration_min: 60, cost_inr: 800, notes: null },
      { id: "item-02d", sequence: 3, type: "stay", label: "Hotel Abode check-in", place_id: "stay-01", checkpoint_id: "cp-03", start_time: "16:00", end_time: "16:30", duration_min: 30, cost_inr: 1800, notes: null },
    ],
  },
  {
    id: "day-03", trip_id: "demo-trip-001", day_number: 3, date: "2025-05-15",
    start_checkpoint_id: "cp-03", end_checkpoint_id: "cp-04",
    drive_distance_km: 502, drive_duration_min: 420, estimated_cost_inr: 4500, notes: "Long drive to Nagpur",
    items: [
      { id: "item-03a", sequence: 0, type: "drive", label: "Hyderabad → Nagpur", place_id: null, checkpoint_id: "cp-04", start_time: "07:00", end_time: "14:00", duration_min: 420, cost_inr: 3400, notes: null },
      { id: "item-03b", sequence: 1, type: "stay", label: "Nagpur overnight", place_id: null, checkpoint_id: "cp-04", start_time: "15:00", end_time: "15:30", duration_min: 30, cost_inr: 1100, notes: null },
    ],
  },
];

// ── Local Dynamic Store & Helper Utilities ─────────────────────────────────

function getStoredTrips(): Map<string, TravelTrip> {
  const store = new Map<string, TravelTrip>();
  store.set(DEMO_TRIP.id, DEMO_TRIP);
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("routezen_travel_trips");
      if (raw) {
        const parsed: TravelTrip[] = JSON.parse(raw);
        for (const t of parsed) store.set(t.id, t);
      }
    } catch {
      // ignore
    }
  }
  return store;
}

function persistStoredTrips(store: Map<string, TravelTrip>) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("routezen_travel_trips", JSON.stringify(Array.from(store.values())));
    } catch {
      // ignore
    }
  }
}

function haversineDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
}

function interpolateCoords(
  origin: [number, number],
  dest: [number, number],
  steps = 8
): [number, number][] {
  const pts: [number, number][] = [];
  const [lat1, lng1] = origin;
  const [lat2, lng2] = dest;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = lat1 + t * (lat2 - lat1);
    const lng = lng1 + t * (lng2 - lng1);
    const curveOffset = Math.sin(t * Math.PI) * 0.04;
    pts.push([Number((lat + curveOffset).toFixed(4)), Number((lng + curveOffset * 0.5).toFixed(4))]);
  }
  return pts;
}

async function fetchOsrmGeometry(
  coords: [number, number][]
): Promise<[number, number][] | null> {
  try {
    const res = await fetch("http://localhost:8000/api/v1/routing/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: coords.map(([lat, lng]) => ({ lat, lng })),
        overview: "full",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.geometry) && data.geometry.length > 0) {
        return data.geometry;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// ── API Functions ──────────────────────────────────────────────────────────

async function demo<T>(value: T, delayMs = 300): Promise<T> {
  await new Promise(r => setTimeout(r, delayMs));
  return value;
}

export async function listTrips(): Promise<TravelTrip[]> {
  if (!USE_DEMO_DATA) {
    try {
      const remote = await request("/travel/trips", { schema: tripListSchema });
      const store = getStoredTrips();
      for (const t of remote) store.set(t.id, t);
      persistStoredTrips(store);
      return Array.from(store.values());
    } catch {
      // fallback to store
    }
  }
  const store = getStoredTrips();
  return demo(Array.from(store.values()));
}

export async function getTrip(id: string): Promise<TravelTrip> {
  if (!USE_DEMO_DATA) {
    try {
      const trip = await request(`/travel/trips/${id}`, { schema: travelTripSchema });
      const store = getStoredTrips();
      store.set(trip.id, trip);
      persistStoredTrips(store);
      return trip;
    } catch {
      // fallback to store
    }
  }
  const store = getStoredTrips();
  const found = store.get(id);
  if (found) return demo(found);
  return demo(DEMO_TRIP);
}

export async function createTrip(body: Partial<TravelTrip>): Promise<TravelTrip> {
  let created: TravelTrip;
  if (!USE_DEMO_DATA) {
    try {
      created = await request("/travel/trips", { method: "POST", body, schema: travelTripSchema });
      const store = getStoredTrips();
      store.set(created.id, created);
      persistStoredTrips(store);
      return created;
    } catch {
      // fallback to client-side creation
    }
  }
  const newId = `trip-${Date.now()}`;
  created = {
    ...DEMO_TRIP,
    ...body,
    id: newId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as TravelTrip;
  const store = getStoredTrips();
  store.set(created.id, created);
  persistStoredTrips(store);
  return demo(created);
}

export async function updateTrip(id: string, body: Partial<TravelTrip>): Promise<TravelTrip> {
  if (!USE_DEMO_DATA) {
    try {
      const updated = await request(`/travel/trips/${id}`, { method: "POST", body, schema: travelTripSchema });
      const store = getStoredTrips();
      store.set(id, updated);
      persistStoredTrips(store);
      return updated;
    } catch {
      // fallback
    }
  }
  const store = getStoredTrips();
  const existing = store.get(id) ?? DEMO_TRIP;
  const updated: TravelTrip = { ...existing, ...body, updated_at: new Date().toISOString() };
  store.set(id, updated);
  persistStoredTrips(store);
  return demo(updated);
}

export async function deleteTrip(id: string): Promise<void> {
  if (!USE_DEMO_DATA) {
    try {
      await request(`/travel/trips/${id}`, { method: "DELETE", schema: z.void() });
    } catch {
      // ignore
    }
  }
  const store = getStoredTrips();
  store.delete(id);
  persistStoredTrips(store);
  return demo(undefined);
}

export async function getTripPreferences(tripId: string): Promise<TravelPreferences> {
  if (!USE_DEMO_DATA) {
    try {
      return await request(`/travel/trips/${tripId}/preferences`, { schema: travelPreferencesSchema });
    } catch {
      // fallback
    }
  }
  return demo({ ...DEMO_PREFS, trip_id: tripId });
}

export async function saveTripPreferences(tripId: string, body: Partial<TravelPreferences>): Promise<TravelPreferences> {
  if (!USE_DEMO_DATA) {
    try {
      return await request(`/travel/trips/${tripId}/preferences`, { method: "POST", body, schema: travelPreferencesSchema });
    } catch {
      // fallback
    }
  }
  return demo({ ...DEMO_PREFS, ...body, trip_id: tripId });
}

export async function listCheckpoints(tripId: string): Promise<TravelCheckpoint[]> {
  if (!USE_DEMO_DATA) {
    try {
      const cps = await request(`/travel/trips/${tripId}/checkpoints`, { schema: z.array(checkpointSchema) });
      if (cps && cps.length > 0) return cps;
    } catch {
      // fallback
    }
  }
  if (tripId === "demo-trip-001") {
    return demo(DEMO_CHECKPOINTS);
  }
  const store = getStoredTrips();
  const trip = store.get(tripId) ?? DEMO_TRIP;
  const dynamicCps: TravelCheckpoint[] = [
    {
      id: `cp-start-${tripId}`,
      trip_id: tripId,
      sequence: 0,
      name: trip.origin_name,
      address: trip.origin_name,
      lat: trip.origin_lat,
      lng: trip.origin_lng,
      type: "origin",
      is_mandatory: true,
      stay_overnight: false,
      planned_arrival: null,
      planned_departure: trip.departure_date ? `${trip.departure_date}T06:00:00` : null,
      activity_duration_min: 0,
      notes: "Trip departure point",
      distance_from_prev_km: null,
      duration_from_prev_min: null,
    },
    {
      id: `cp-end-${tripId}`,
      trip_id: tripId,
      sequence: 1,
      name: trip.destination_name,
      address: trip.destination_name,
      lat: trip.destination_lat,
      lng: trip.destination_lng,
      type: "destination",
      is_mandatory: true,
      stay_overnight: false,
      planned_arrival: null,
      planned_departure: null,
      activity_duration_min: 0,
      notes: "Destination point",
      distance_from_prev_km: Math.round(haversineDistKm(trip.origin_lat, trip.origin_lng, trip.destination_lat, trip.destination_lng) * 1.25),
      duration_from_prev_min: Math.round(haversineDistKm(trip.origin_lat, trip.origin_lng, trip.destination_lat, trip.destination_lng) * 1.25 / 65 * 60),
    },
  ];
  return demo(dynamicCps);
}

export async function generateRouteOptions(tripId: string): Promise<RouteOption[]> {
  if (!USE_DEMO_DATA) {
    try {
      const remote = await request(`/travel/trips/${tripId}/route-options`, { method: "POST", schema: z.array(routeOptionSchema) });
      if (remote && remote.length > 0) return remote;
    } catch {
      // fallback to dynamic computation
    }
  }

  if (tripId === "demo-trip-001") {
    return demo(DEMO_ROUTE_OPTIONS, 800);
  }

  const store = getStoredTrips();
  const trip = store.get(tripId) ?? DEMO_TRIP;

  const oLat = trip.origin_lat || 13.0827;
  const oLng = trip.origin_lng || 80.2707;
  const dLat = trip.destination_lat || 15.2993;
  const dLng = trip.destination_lng || 74.1240;

  const directKm = haversineDistKm(oLat, oLng, dLat, dLng);
  const roadKm = Math.max(30, Math.round(directKm * 1.25));

  // Try real road geometry from OSRM
  let roadGeom = await fetchOsrmGeometry([[oLat, oLng], [dLat, dLng]]);
  if (!roadGeom || roadGeom.length === 0) {
    roadGeom = interpolateCoords([oLat, oLng], [dLat, dLng], 12);
  }

  const recDays = Math.max(1, Math.ceil(roadKm / 400));
  const recFuel = Math.round((roadKm / 14) * 105);
  const recTotal = recFuel + recDays * 3500;
  const recDuration = Math.round((roadKm / 65) * 60);

  const fastKm = Math.round(roadKm * 0.94);
  const fastDays = Math.max(1, Math.ceil(fastKm / 500));
  const fastFuel = Math.round((fastKm / 14) * 105);
  const fastTotal = fastFuel + fastDays * 3200;
  const fastDuration = Math.round((fastKm / 75) * 60);

  const scenicKm = Math.round(roadKm * 1.12);
  const scenicDays = recDays + 1;
  const scenicFuel = Math.round((scenicKm / 13) * 105);
  const scenicTotal = scenicFuel + scenicDays * 3900;
  const scenicDuration = Math.round((scenicKm / 55) * 60);

  const origCity = trip.origin_name.split(",")[0].trim();
  const destCity = trip.destination_name.split(",")[0].trim();

  const dynamicOptions: RouteOption[] = [
    {
      id: `route-${tripId}-rec`,
      trip_id: tripId,
      label: "Recommended Route",
      description: `Balanced highway corridor from ${origCity} to ${destCity} with comfortable halts`,
      total_distance_km: roadKm,
      total_duration_min: recDuration,
      estimated_days: recDays,
      estimated_fuel_cost_inr: recFuel,
      estimated_total_cost_inr: recTotal,
      geometry: roadGeom,
      checkpoints: [`cp-start-${tripId}`, `cp-end-${tripId}`],
      is_selected: true,
      data_source: "osrm_hybrid",
      fallback_estimate: false,
      note: "Optimized for safety and scenic balance",
    },
    {
      id: `route-${tripId}-fast`,
      trip_id: tripId,
      label: "Fastest Route",
      description: `Direct arterial route between ${origCity} and ${destCity} with minimum intermediate halts`,
      total_distance_km: fastKm,
      total_duration_min: fastDuration,
      estimated_days: fastDays,
      estimated_fuel_cost_inr: fastFuel,
      estimated_total_cost_inr: fastTotal,
      geometry: roadGeom,
      checkpoints: [`cp-start-${tripId}`, `cp-end-${tripId}`],
      is_selected: false,
      data_source: "osrm_hybrid",
      fallback_estimate: false,
      note: "Longer daily driving stretches",
    },
    {
      id: `route-${tripId}-scenic`,
      trip_id: tripId,
      label: "Scenic & Heritage Route",
      description: `Scenic roads connecting ${origCity} and ${destCity} with cultural sightseeing halts`,
      total_distance_km: scenicKm,
      total_duration_min: scenicDuration,
      estimated_days: scenicDays,
      estimated_fuel_cost_inr: scenicFuel,
      estimated_total_cost_inr: scenicTotal,
      geometry: roadGeom,
      checkpoints: [`cp-start-${tripId}`, `cp-end-${tripId}`],
      is_selected: false,
      data_source: "osrm_hybrid",
      fallback_estimate: false,
      note: "Extra time for local viewpoints and photography",
    },
  ];

  return demo(dynamicOptions, 600);
}

export async function listStays(tripId: string, checkpointId?: string): Promise<TravelPlace[]> {
  if (!USE_DEMO_DATA) {
    try {
      return await request(`/travel/trips/${tripId}/stays`, { query: { checkpoint_id: checkpointId }, schema: z.array(placeSchema) });
    } catch {
      // fallback
    }
  }
  return demo(DEMO_STAYS);
}

export async function listRestaurants(tripId: string, checkpointId?: string): Promise<TravelPlace[]> {
  if (!USE_DEMO_DATA) {
    try {
      return await request(`/travel/trips/${tripId}/restaurants`, { query: { checkpoint_id: checkpointId }, schema: z.array(placeSchema) });
    } catch {
      // fallback
    }
  }
  return demo(DEMO_RESTAURANTS);
}

export async function listAttractions(tripId: string, checkpointId?: string): Promise<TravelPlace[]> {
  if (!USE_DEMO_DATA) {
    try {
      return await request(`/travel/trips/${tripId}/attractions`, { query: { checkpoint_id: checkpointId }, schema: z.array(placeSchema) });
    } catch {
      // fallback
    }
  }
  return demo(DEMO_ATTRACTIONS);
}

export async function buildItinerary(tripId: string): Promise<ItineraryDay[]> {
  if (!USE_DEMO_DATA) {
    try {
      return await request(`/travel/trips/${tripId}/build-itinerary`, { method: "POST", schema: z.array(itineraryDaySchema) });
    } catch {
      // fallback
    }
  }
  if (tripId === "demo-trip-001") {
    return demo(DEMO_ITINERARY, 1000);
  }
  const store = getStoredTrips();
  const trip = store.get(tripId) ?? DEMO_TRIP;
  const dist = Math.round(haversineDistKm(trip.origin_lat, trip.origin_lng, trip.destination_lat, trip.destination_lng) * 1.25);
  const durMin = Math.round((dist / 65) * 60);

  const dynamicItinerary: ItineraryDay[] = [
    {
      id: `day-01-${tripId}`,
      trip_id: tripId,
      day_number: 1,
      date: trip.departure_date ?? "2025-06-01",
      start_checkpoint_id: `cp-start-${tripId}`,
      end_checkpoint_id: `cp-end-${tripId}`,
      drive_distance_km: dist,
      drive_duration_min: durMin,
      estimated_cost_inr: Math.round((dist / 14) * 105 + 2500),
      notes: `Scenic drive from ${trip.origin_name.split(",")[0]} towards ${trip.destination_name.split(",")[0]}`,
      items: [
        {
          id: `item-01a-${tripId}`,
          sequence: 0,
          type: "drive",
          label: `${trip.origin_name.split(",")[0]} → ${trip.destination_name.split(",")[0]}`,
          place_id: null,
          checkpoint_id: `cp-end-${tripId}`,
          start_time: "07:00",
          end_time: "15:00",
          duration_min: durMin,
          cost_inr: Math.round((dist / 14) * 105),
          notes: "Highway cruise leg",
        },
        {
          id: `item-01b-${tripId}`,
          sequence: 1,
          type: "stay",
          label: `Check-in at ${trip.destination_name.split(",")[0]}`,
          place_id: null,
          checkpoint_id: `cp-end-${tripId}`,
          start_time: "15:30",
          end_time: "16:00",
          duration_min: 30,
          cost_inr: 2200,
          notes: "Overnight stay",
        },
      ],
    },
  ];
  return demo(dynamicItinerary, 800);
}

export async function getTripBudget(tripId: string): Promise<TripBudget> {
  if (!USE_DEMO_DATA) {
    try {
      return await request(`/travel/trips/${tripId}/budget`, { schema: budgetSchema });
    } catch {
      // fallback
    }
  }
  if (tripId === "demo-trip-001") {
    return demo(DEMO_BUDGET, 600);
  }
  const store = getStoredTrips();
  const trip = store.get(tripId) ?? DEMO_TRIP;
  const dist = Math.round(haversineDistKm(trip.origin_lat, trip.origin_lng, trip.destination_lat, trip.destination_lng) * 1.25);
  const fuel = Math.round((dist / 14) * 105);
  const stay = 4500;
  const meals = 2400;
  const contingency = Math.round((fuel + stay + meals) * 0.1);
  const total = fuel + stay + meals + contingency;

  return demo({
    trip_id: tripId,
    target_budget_inr: total + 5000,
    estimated_total_inr: total,
    fuel_inr: fuel,
    accommodation_inr: stay,
    meals_inr: meals,
    attractions_inr: 800,
    tolls_inr: 950,
    parking_inr: 400,
    other_inr: 0,
    contingency_inr: contingency,
    unknown_items: ["Tolls may vary depending on expressway segments chosen"],
    over_budget: false,
    day_totals: [{ day: 1, date: trip.departure_date, total_inr: total }],
    assumptions: [
      `Fuel: Petrol @ ₹105/L, mileage 14 km/L for ${dist} km`,
      "Accommodation: ₹2,200/night average",
      `Meals: ₹400/person/day for ${trip.adults} adult(s)`,
      "Contingency: 10% safety cushion",
    ],
    data_source: "dynamic_calculation",
  }, 400);
}
