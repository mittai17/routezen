"use client";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { useTravelWizard } from "./travel-wizard-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VEHICLE_TYPES = [
  { id: "car", label: "Car / Hatchback", icon: "🚗", bestFor: "Family trips, long distance", maxPax: 5 },
  { id: "suv", label: "SUV / Van", icon: "🚙", bestFor: "Group trips, rough roads", maxPax: 7 },
  { id: "motorcycle", label: "Motorcycle", icon: "🏍️", bestFor: "Solo / duo, budget, adventure", maxPax: 2 },
  { id: "ev", label: "Electric Vehicle", icon: "⚡", bestFor: "Eco-friendly, city highways", maxPax: 5 },
] as const;

const FUEL_TYPES = [
  { id: "petrol", label: "Petrol" },
  { id: "diesel", label: "Diesel" },
  { id: "ev", label: "Electric" },
  { id: "cng", label: "CNG" },
] as const;

export function VehicleLogisticsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { data, set } = useTravelWizard();
  const isEV = data.fuelType === "ev" || data.vehicleCategory === "ev";

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-bold">Vehicle &amp; Logistics</h2>
        <p className="mt-1 text-sm text-muted-foreground">Provide details about your vehicle and logistics needs.</p>
      </div>

      {/* Vehicle type */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Vehicle type</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VEHICLE_TYPES.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => set({ vehicleCategory: v.id })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center transition-all",
                data.vehicleCategory === v.id
                  ? "border-brand bg-brand-soft shadow-sm"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span className="text-3xl">{v.icon}</span>
              <span className="text-sm font-semibold">{v.label}</span>
              <span className="text-[10px] text-muted-foreground">{v.bestFor}</span>
              <span className="text-[10px] text-muted-foreground">Up to {v.maxPax} passengers</span>
            </button>
          ))}
        </div>
      </section>

      {/* Fuel type */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Fuel / energy type</h3>
        <div className="flex flex-wrap gap-2">
          {FUEL_TYPES.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ fuelType: f.id })}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                data.fuelType === f.id ? "border-brand bg-brand-soft" : "border-border bg-card hover:bg-muted",
              )}
            >{f.label}</button>
          ))}
        </div>
      </section>

      {/* Fuel-powered specs */}
      {!isEV && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Fuel specs <span className="font-normal text-muted-foreground">(user-provided)</span></h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm">Mileage (km/L)</label>
              <input type="number" min={1} className="rz-input" placeholder="e.g. 14" value={data.mileageKmpl ?? ""} onChange={e => set({ mileageKmpl: parseFloat(e.target.value) || undefined })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm">Fuel price (₹/litre)</label>
              <input type="number" className="rz-input" placeholder="e.g. 105" value={data.fuelPricePerL ?? ""} onChange={e => set({ fuelPricePerL: parseFloat(e.target.value) || undefined })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm">Tank capacity (litres)</label>
              <input type="number" className="rz-input" placeholder="e.g. 40" value={data.tankCapacityL ?? ""} onChange={e => set({ tankCapacityL: parseFloat(e.target.value) || undefined })} />
            </div>
          </div>
        </section>
      )}

      {/* EV specs */}
      {isEV && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">EV specs <span className="font-normal text-muted-foreground">(user-provided)</span></h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm">Consumption (kWh/km)</label>
              <input type="number" step="0.01" className="rz-input" placeholder="e.g. 0.18" value={data.kwhPerKm ?? ""} onChange={e => set({ kwhPerKm: parseFloat(e.target.value) || undefined })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm">Electricity tariff (₹/kWh)</label>
              <input type="number" className="rz-input" placeholder="e.g. 8" value={data.electricityTariff ?? ""} onChange={e => set({ electricityTariff: parseFloat(e.target.value) || undefined })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm">Battery range (km)</label>
              <input type="number" className="rz-input" placeholder="e.g. 400" value={data.batteryRangeKm ?? ""} onChange={e => set({ batteryRangeKm: parseFloat(e.target.value) || undefined })} />
            </div>
          </div>
        </section>
      )}

      {/* Maximum daily drive */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Maximum driving hours per day</h3>
        <div className="flex items-center gap-4">
          <input
            type="range" min={4} max={14} step={1}
            value={data.maxDriveHoursPerDay ?? 8}
            onChange={e => set({ maxDriveHoursPerDay: parseInt(e.target.value) })}
            className="flex-1 accent-brand"
          />
          <span className="text-sm font-bold w-12 text-right">{data.maxDriveHoursPerDay ?? 8} hrs</span>
        </div>
      </section>

      {/* Special requirements */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Need special requirements?</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { icon: "♿", label: "Wheelchair accessible" },
            { icon: "👶", label: "Travelling with infants" },
            { icon: "👴", label: "Senior citizens" },
            { icon: "🐾", label: "Pet friendly" },
          ].map(r => (
            <label key={r.label} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors">
              <input type="checkbox" className="accent-brand" />
              <span>{r.icon} {r.label}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-info/30 bg-info-soft p-3 flex gap-2 text-sm text-info">
        <Info className="size-4 shrink-0 mt-0.5" />
        <span>Vehicle specifications are user-provided. Fuel cost estimates use these values. Verify actual consumption before relying on budget estimates for long journeys.</span>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" onClick={onBack}><ArrowLeft className="size-4" /> Back</Button>
        <Button variant="primary" size="lg" onClick={onNext}>Next: Priorities &amp; Constraints <ArrowRight className="size-4" /></Button>
      </div>
    </div>
  );
}
