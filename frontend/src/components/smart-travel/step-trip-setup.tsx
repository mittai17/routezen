"use client";
import { MapPin, ArrowRight, ArrowLeftRight, Calendar, Users, ChevronDown } from "lucide-react";
import { useTravelWizard } from "./travel-wizard-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRAVEL_MODES = [
  { id: "car", label: "Car", icon: "🚗" },
  { id: "motorcycle", label: "Motorcycle", icon: "🏍️" },
  { id: "ev", label: "Electric Vehicle", icon: "⚡" },
  { id: "van", label: "Van / SUV", icon: "🚙" },
] as const;

export const POPULAR_CITIES: Record<string, { lat: number; lng: number; full: string }> = {
  "chennai": { lat: 13.0827, lng: 80.2707, full: "Chennai, Tamil Nadu" },
  "leh": { lat: 34.1526, lng: 77.5771, full: "Leh, Ladakh" },
  "bengaluru": { lat: 12.9716, lng: 77.5946, full: "Bengaluru, Karnataka" },
  "bangalore": { lat: 12.9716, lng: 77.5946, full: "Bengaluru, Karnataka" },
  "goa": { lat: 15.2993, lng: 74.1240, full: "Goa" },
  "panaji": { lat: 15.4909, lng: 73.8278, full: "Panaji, Goa" },
  "mumbai": { lat: 19.0760, lng: 72.8777, full: "Mumbai, Maharashtra" },
  "pune": { lat: 18.5204, lng: 73.8567, full: "Pune, Maharashtra" },
  "delhi": { lat: 28.6139, lng: 77.2090, full: "Delhi, NCR" },
  "new delhi": { lat: 28.6139, lng: 77.2090, full: "New Delhi" },
  "manali": { lat: 32.2396, lng: 77.1887, full: "Manali, Himachal Pradesh" },
  "shimla": { lat: 31.1048, lng: 77.1734, full: "Shimla, Himachal Pradesh" },
  "hyderabad": { lat: 17.3850, lng: 78.4867, full: "Hyderabad, Telangana" },
  "kolkata": { lat: 22.5726, lng: 88.3639, full: "Kolkata, West Bengal" },
  "jaipur": { lat: 26.9124, lng: 75.7873, full: "Jaipur, Rajasthan" },
  "udaipur": { lat: 24.5854, lng: 73.7125, full: "Udaipur, Rajasthan" },
  "ahmedabad": { lat: 23.0225, lng: 72.5714, full: "Ahmedabad, Gujarat" },
  "kochi": { lat: 9.9312, lng: 76.2673, full: "Kochi, Kerala" },
  "coimbatore": { lat: 11.0168, lng: 76.9558, full: "Coimbatore, Tamil Nadu" },
  "mysuru": { lat: 12.2958, lng: 76.6394, full: "Mysuru, Karnataka" },
  "mysore": { lat: 12.2958, lng: 76.6394, full: "Mysuru, Karnataka" },
  "pondicherry": { lat: 11.9416, lng: 79.8083, full: "Pondicherry, Puducherry" },
  "puducherry": { lat: 11.9416, lng: 79.8083, full: "Pondicherry, Puducherry" },
  "vijayawada": { lat: 16.5062, lng: 80.6480, full: "Vijayawada, Andhra Pradesh" },
  "nagpur": { lat: 21.1458, lng: 79.0882, full: "Nagpur, Maharashtra" },
  "chandigarh": { lat: 30.7333, lng: 76.7794, full: "Chandigarh, Punjab" },
  "srinagar": { lat: 34.0837, lng: 74.7973, full: "Srinagar, Jammu & Kashmir" },
  "varanasi": { lat: 25.3176, lng: 82.9739, full: "Varanasi, Uttar Pradesh" },
  "agra": { lat: 27.1767, lng: 78.0081, full: "Agra, Uttar Pradesh" },
  "rishikesh": { lat: 30.0869, lng: 78.2676, full: "Rishikesh, Uttarakhand" },
};

function lookupCityCoords(text: string) {
  const norm = text.trim().toLowerCase();
  for (const [key, val] of Object.entries(POPULAR_CITIES)) {
    if (norm === key || norm.includes(key)) {
      return val;
    }
  }
  return null;
}

const PRESET_ROUTES = [
  {
    name: "Bangalore → Goa",
    origin: "Bengaluru, Karnataka", originLat: 12.9716, originLng: 77.5946,
    dest: "Goa", destLat: 15.2993, destLng: 74.1240,
  },
  {
    name: "Mumbai → Pune",
    origin: "Mumbai, Maharashtra", originLat: 19.0760, originLng: 72.8777,
    dest: "Pune, Maharashtra", destLat: 18.5204, destLng: 73.8567,
  },
  {
    name: "Delhi → Manali",
    origin: "Delhi, NCR", originLat: 28.6139, originLng: 77.2090,
    dest: "Manali, Himachal Pradesh", destLat: 32.2396, destLng: 77.1887,
  },
  {
    name: "Chennai → Pondicherry",
    origin: "Chennai, Tamil Nadu", originLat: 13.0827, originLng: 80.2707,
    dest: "Pondicherry, Puducherry", destLat: 11.9416, destLng: 79.8083,
  },
  {
    name: "Chennai → Leh",
    origin: "Chennai, Tamil Nadu", originLat: 13.0827, originLng: 80.2707,
    dest: "Leh, Ladakh", destLat: 34.1526, destLng: 77.5771,
  },
];

export function TripSetupStep({ onNext }: { onNext: () => void }) {
  const { data, set } = useTravelWizard();

  const isValid =
    data.originName && data.originName.trim().length > 0 &&
    data.destName && data.destName.trim().length > 0 &&
    data.adults && data.adults >= 1;

  function swapLocations() {
    set({
      originName: data.destName,
      originLat: data.destLat,
      originLng: data.destLng,
      destName: data.originName,
      destLat: data.originLat,
      destLng: data.originLng,
    });
  }

  function handleOriginChange(val: string) {
    const coords = lookupCityCoords(val);
    set({
      originName: val,
      originLat: coords ? coords.lat : data.originLat ?? 13.0827,
      originLng: coords ? coords.lng : data.originLng ?? 80.2707,
    });
  }

  function handleDestChange(val: string) {
    const coords = lookupCityCoords(val);
    set({
      destName: val,
      destLat: coords ? coords.lat : data.destLat ?? 15.2993,
      destLng: coords ? coords.lng : data.destLng ?? 74.1240,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Plan Your Journey</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tell us about your trip and get a personalised itinerary.</p>
      </div>

      {/* Trip Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="trip-name">Trip name <span className="text-muted-foreground">(optional)</span></label>
        <input id="trip-name" className="rz-input" placeholder="e.g. Grand India Road Trip" value={data.name ?? ""} onChange={e => set({ name: e.target.value })} />
      </div>

      {/* Origin / Destination */}
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium" htmlFor="origin">Starting location <span className="text-danger">*</span></label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-success" />
              <input
                id="origin"
                className="rz-input pl-9"
                placeholder="City, State or address (e.g. Bangalore)"
                value={data.originName ?? ""}
                onChange={e => handleOriginChange(e.target.value)}
              />
            </div>
            {data.originLat && data.originLng ? (
              <span className="text-[11px] text-muted-foreground">
                📍 {data.originLat.toFixed(4)}, {data.originLng.toFixed(4)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={swapLocations}
            title="Swap origin and destination"
            className="mt-6 grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeftRight className="size-4" />
          </button>
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium" htmlFor="destination">Destination <span className="text-danger">*</span></label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-danger" />
              <input
                id="destination"
                className="rz-input pl-9"
                placeholder="City, State or address (e.g. Goa)"
                value={data.destName ?? ""}
                onChange={e => handleDestChange(e.target.value)}
              />
            </div>
            {data.destLat && data.destLng ? (
              <span className="text-[11px] text-muted-foreground">
                📍 {data.destLat.toFixed(4)}, {data.destLng.toFixed(4)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Quick Route Presets */}
        <div className="space-y-1.5 pt-1">
          <span className="text-xs font-medium text-muted-foreground">Quick Route Presets:</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_ROUTES.map((route) => (
              <button
                key={route.name}
                type="button"
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground/80 hover:bg-brand-soft hover:border-brand/40 hover:text-brand transition-colors"
                onClick={() =>
                  set({
                    name: route.name,
                    originName: route.origin,
                    originLat: route.originLat,
                    originLng: route.originLng,
                    destName: route.dest,
                    destLat: route.destLat,
                    destLng: route.destLng,
                  })
                }
              >
                {route.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium" htmlFor="dep-date">
              <Calendar className="mr-1 inline size-3.5" />Departure date
            </label>
            <input id="dep-date" type="date" className="rz-input" value={data.departureDate ?? ""} onChange={e => set({ departureDate: e.target.value })} />
          </div>
          {!data.isOneWay && (
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium" htmlFor="ret-date">Return date</label>
              <input id="ret-date" type="date" className="rz-input" value={data.returnDate ?? ""} onChange={e => set({ returnDate: e.target.value })} />
            </div>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand" checked={!!data.isOneWay} onChange={e => set({ isOneWay: e.target.checked })} />
          One-way trip
        </label>
      </div>

      {/* Travellers */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "adults" as const, label: "Adults", min: 1 },
          { key: "children" as const, label: "Children (under 18)", min: 0 },
          { key: "olderTravellers" as const, label: "Senior travellers", min: 0 },
        ].map(({ key, label, min }) => (
          <div key={key} className="space-y-1.5">
            <label className="flex items-center gap-1 text-sm font-medium"><Users className="size-3.5" />{label}</label>
            <input type="number" min={min} className="rz-input" value={data[key] ?? 0} onChange={e => set({ [key]: Math.max(min, parseInt(e.target.value) || 0) })} />
          </div>
        ))}
      </div>

      {/* Travel Mode */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Travel mode</label>
        <div className="flex flex-wrap gap-2">
          {TRAVEL_MODES.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => set({ travelMode: id })}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                data.travelMode === id
                  ? "border-brand bg-brand-soft text-foreground"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <Button variant="primary" size="lg" disabled={!isValid} onClick={onNext}>
          Next: Travel Preferences <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
