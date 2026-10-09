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

export function TripSetupStep({ onNext }: { onNext: () => void }) {
  const { data, set } = useTravelWizard();

  const isValid =
    data.originName && data.originName.trim().length > 0 &&
    data.destName && data.destName.trim().length > 0 &&
    data.adults && data.adults >= 1;

  function swapLocations() {
    set({ originName: data.destName, originLat: data.destLat, originLng: data.destLng, destName: data.originName, destLat: data.originLat, destLng: data.originLng });
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
                placeholder="City, State or address"
                value={data.originName ?? ""}
                onChange={e => set({ originName: e.target.value })}
              />
            </div>
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
                placeholder="City, State or address"
                value={data.destName ?? ""}
                onChange={e => set({ destName: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Demo quick-fill */}
        <button
          type="button"
          className="text-xs text-brand underline underline-offset-2 hover:text-brand-hover transition-colors"
          onClick={() => set({ originName: "Chennai, Tamil Nadu", originLat: 13.0827, originLng: 80.2707, destName: "Leh, Ladakh", destLat: 34.1526, destLng: 77.5771 })}
        >
          Try example: Chennai → Leh, Ladakh
        </button>
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
