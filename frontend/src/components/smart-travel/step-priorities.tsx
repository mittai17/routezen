"use client";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTravelWizard } from "./travel-wizard-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUGGESTED_MANDATORY = ["Vijayawada", "Hyderabad", "Delhi", "Manali"];
const SUGGESTED_OPTIONAL = ["Nagpur", "Varanasi", "Agra", "Amritsar"];
const AVOID_SUGGESTIONS = ["Allahabad (congestion)", "NH-44 tolls", "Night highways"];

function TagInput({
  label,
  sublabel,
  tags,
  suggestions,
  onAdd,
  onRemove,
  colorClass = "bg-brand-soft text-foreground border-brand",
}: {
  label: string;
  sublabel?: string;
  tags: string[];
  suggestions: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
  colorClass?: string;
}) {
  const [input, setInput] = useState("");

  function add(val: string) {
    const t = val.trim();
    if (t && !tags.includes(t)) onAdd(t);
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div>
        <span className="text-sm font-semibold">{label}</span>
        {sublabel && <span className="ml-2 text-xs text-muted-foreground">{sublabel}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(t => (
          <span key={t} className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-1 text-sm font-medium", colorClass)}>
            {t}
            <button type="button" onClick={() => onRemove(t)} className="hover:text-danger transition-colors"><X className="size-3" /></button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            className="rz-input h-8 w-36 text-sm"
            placeholder="Add city…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          />
          <button type="button" onClick={() => add(input)} className="grid size-8 place-items-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"><Plus className="size-3.5" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.filter(s => !tags.includes(s)).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onAdd(s)}
            className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-brand hover:text-foreground transition-colors"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PrioritiesConstraintsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { data, set } = useTravelWizard();

  function addMandatory(t: string) { set({ mandatoryCheckpoints: [...(data.mandatoryCheckpoints ?? []), t] }); }
  function removeMandatory(t: string) { set({ mandatoryCheckpoints: (data.mandatoryCheckpoints ?? []).filter(x => x !== t) }); }
  function addAvoid(t: string) { set({ avoidList: [...(data.avoidList ?? []), t] }); }
  function removeAvoid(t: string) { set({ avoidList: (data.avoidList ?? []).filter(x => x !== t) }); }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-bold">Additional Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">Help us create a better itinerary for you.</p>
      </div>

      {/* Mandatory stops */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <TagInput
          label="Must visit cities"
          sublabel="(mandatory)"
          tags={data.mandatoryCheckpoints ?? []}
          suggestions={SUGGESTED_MANDATORY}
          onAdd={addMandatory}
          onRemove={removeMandatory}
          colorClass="bg-success/10 text-success border-success/30"
        />
        <p className="text-xs text-muted-foreground">These stops will be preserved by the route optimizer or you will see a feasibility warning.</p>
      </section>

      {/* Optional suggestions */}
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <span className="text-sm font-semibold">Optional cities</span>
        <p className="text-xs text-muted-foreground">Suggestions based on your route corridor. The planner will add these if time and budget allow.</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTED_OPTIONAL.map(s => (
            <button
              key={s}
              type="button"
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-1.5 text-sm hover:border-brand hover:bg-brand-soft transition-all"
              onClick={() => addMandatory(s)}
            >
              <Plus className="size-3.5" /> {s}
            </button>
          ))}
        </div>
      </section>

      {/* Avoid */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <TagInput
          label="Avoid list"
          sublabel="cities, roads or conditions"
          tags={data.avoidList ?? []}
          suggestions={AVOID_SUGGESTIONS}
          onAdd={addAvoid}
          onRemove={removeAvoid}
          colorClass="bg-danger-soft text-danger border-danger/30"
        />
        <p className="text-xs text-muted-foreground">Note: avoid preferences are applied as planning guidance. Actual enforcement depends on the routing provider&apos;s capabilities.</p>
      </section>

      {/* Budget constraints */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Budget constraints</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm">Max budget for the entire trip (₹)</label>
            <input type="number" className="rz-input" placeholder="e.g. 50,000" value={data.totalBudgetInr ?? ""} onChange={e => set({ totalBudgetInr: parseInt(e.target.value) || undefined })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Max accommodation / night (₹)</label>
            <input type="number" className="rz-input" placeholder="e.g. 2,500" value={data.maxAccommodationPerNight ?? ""} onChange={e => set({ maxAccommodationPerNight: parseInt(e.target.value) || undefined })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Activity budget (₹ total)</label>
            <input type="number" className="rz-input" placeholder="e.g. 5,000" value={data.activityBudget ?? ""} onChange={e => set({ activityBudget: parseInt(e.target.value) || undefined })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Contingency reserve (%)</label>
            <input type="number" min={0} max={50} className="rz-input" value={data.contingencyPct ?? 10} onChange={e => set({ contingencyPct: parseInt(e.target.value) })} />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Important notes <span className="text-muted-foreground font-normal">(optional)</span></h3>
        <textarea
          className="rz-input min-h-[80px] resize-none"
          placeholder="e.g. Looking for scenic routes and great local food. Need wheelchair access at accommodations."
          value={data.tripNotes ?? ""}
          onChange={e => set({ tripNotes: e.target.value })}
        />
      </section>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" onClick={onBack}><ArrowLeft className="size-4" /> Back</Button>
        <Button variant="primary" size="lg" onClick={onNext}>
          <Check className="size-4" /> Generate Route Options
        </Button>
      </div>
    </div>
  );
}
