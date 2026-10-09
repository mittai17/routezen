"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTravelWizard } from "./travel-wizard-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PACE_OPTIONS = [
  { id: "relaxed", label: "Relaxed", sub: "More rest & sightseeing", icon: "🌿" },
  { id: "balanced", label: "Balanced", sub: "Mix of driving and experiences", icon: "⚖️" },
  { id: "fast", label: "Fast", sub: "Prioritise reaching the destination", icon: "🚀" },
] as const;

const BUDGET_CATS = [
  { id: "budget", label: "Budget-friendly", sub: "₹500–1,000/night", icon: "💰" },
  { id: "mid_range", label: "Mid-range", sub: "₹1,000–3,000/night", icon: "🏨" },
  { id: "premium", label: "Premium", sub: "₹3,000+/night", icon: "⭐" },
  { id: "custom", label: "Custom budget", sub: "Set your total", icon: "🎯" },
] as const;

const ACCOMM_TYPES = [
  { id: "budget_hotel", label: "Budget hotel" },
  { id: "mid_hotel", label: "Mid-range hotel" },
  { id: "homestay", label: "Homestay" },
  { id: "hostel", label: "Hostel" },
  { id: "camping", label: "Camping" },
] as const;

const FOOD_PREFS = [
  { id: "any", label: "Any cuisine" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "non_vegetarian", label: "Non-vegetarian" },
  { id: "vegan", label: "Vegan" },
] as const;

const INTERESTS = [
  { id: "nature", label: "Nature", icon: "🌿" },
  { id: "historical_places", label: "Historical", icon: "🏛️" },
  { id: "cultural", label: "Cultural", icon: "🎭" },
  { id: "local_food", label: "Local food", icon: "🍛" },
  { id: "adventure", label: "Adventure", icon: "🧗" },
  { id: "photography", label: "Photography", icon: "📷" },
  { id: "shopping", label: "Shopping", icon: "🛍️" },
  { id: "temples", label: "Temples", icon: "🛕" },
  { id: "museums", label: "Museums", icon: "🏛" },
  { id: "family", label: "Family-friendly", icon: "👨‍👩‍👧" },
] as const;

function Toggle({ options, value, multi, onChange }: {
  options: readonly { id: string; label: string; sub?: string; icon?: string }[];
  value: string | string[];
  multi?: boolean;
  onChange: (v: string | string[]) => void;
}) {
  function isSelected(id: string) {
    return Array.isArray(value) ? value.includes(id) : value === id;
  }
  function handleClick(id: string) {
    if (multi && Array.isArray(value)) {
      onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
    } else {
      onChange(id);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => handleClick(o.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
            isSelected(o.id)
              ? "border-brand bg-brand-soft text-foreground shadow-sm"
              : "border-border bg-card hover:bg-muted",
          )}
        >
          {o.icon && <span>{o.icon}</span>}
          <span>{o.label}</span>
          {o.sub && <span className="ml-1 text-[10px] text-muted-foreground hidden sm:inline">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function TravelPreferencesStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { data, set } = useTravelWizard();

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-bold">Your Travel Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">Help us create a plan that matches your travel style.</p>
      </div>

      {/* Pace */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Trip style</h3>
        <Toggle options={PACE_OPTIONS} value={data.pace ?? "balanced"} onChange={v => set({ pace: v as string })} />
      </section>

      {/* Budget */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Budget range</h3>
        <Toggle options={BUDGET_CATS} value={data.budgetCategory ?? "mid_range"} onChange={v => set({ budgetCategory: v as string })} />
        {(data.budgetCategory === "custom" || data.budgetCategory === "mid_range") && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm text-muted-foreground whitespace-nowrap">Total budget (₹)</label>
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₹</span>
              <input type="number" className="rz-input pl-7" placeholder="e.g. 80000" value={data.totalBudgetInr ?? ""} onChange={e => set({ totalBudgetInr: parseInt(e.target.value) || undefined })} />
            </div>
          </div>
        )}
      </section>

      {/* Accommodation */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Preferred stay type</h3>
        <Toggle options={ACCOMM_TYPES} value={data.accommodationTypes ?? []} multi onChange={v => set({ accommodationTypes: v as string[] })} />
        <div className="flex items-center gap-3 mt-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Max price / night (₹)</label>
          <input type="number" className="rz-input max-w-[140px]" placeholder="e.g. 2500" value={data.maxPricePerNight ?? ""} onChange={e => set({ maxPricePerNight: parseInt(e.target.value) || undefined })} />
        </div>
      </section>

      {/* Food */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Food preferences</h3>
        <Toggle options={FOOD_PREFS} value={data.foodPreference ?? "any"} onChange={v => set({ foodPreference: v as string })} />
      </section>

      {/* Interests */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Interests <span className="text-muted-foreground font-normal">(select multiple)</span></h3>
        <Toggle options={INTERESTS} value={data.interests ?? []} multi onChange={v => set({ interests: v as string[] })} />
      </section>

      {/* Driving limits */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Travel pace constraints</h3>
        <p className="text-xs text-muted-foreground">These are planning preferences — actual journey conditions may change the schedule.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm">Max drive hours/day</label>
            <input type="number" min={2} max={16} className="rz-input" value={data.maxDriveHoursPerDay ?? 8} onChange={e => set({ maxDriveHoursPerDay: parseInt(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Max drive km/day</label>
            <input type="number" min={50} className="rz-input" placeholder="e.g. 350" value={data.maxDriveKmPerDay ?? ""} onChange={e => set({ maxDriveKmPerDay: parseInt(e.target.value) || undefined })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Meal budget/person (₹/day)</label>
            <input type="number" className="rz-input" placeholder="e.g. 400" value={data.mealBudgetPerPerson ?? ""} onChange={e => set({ mealBudgetPerPerson: parseInt(e.target.value) || undefined })} />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand" checked={!!data.avoidNightDriving} onChange={e => set({ avoidNightDriving: e.target.checked })} />
          Avoid night driving
        </label>
      </section>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" onClick={onBack}><ArrowLeft className="size-4" /> Back</Button>
        <Button variant="primary" size="lg" onClick={onNext}>Next: Vehicle Details <ArrowRight className="size-4" /></Button>
      </div>
    </div>
  );
}
