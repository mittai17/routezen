"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompare, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/form-controls";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  compareScenarios, createScenario, deleteScenario, describeError, listScenarios, loadFleet, readMeta, runScenario, updateScenario, withMeta,
  type Scenario,
} from "@/lib/api/scenarios";
import { USE_DEMO_DATA } from "@/lib/api/client";
import { CompareView } from "./compare-view";
import { ScenarioCard } from "./scenario-card";
import { ScenarioDetails } from "./scenario-details";
import { ScenarioEditor } from "./scenario-editor";
import { emptyForm, formToInput, scenarioToForm, type ScenarioForm, type Template } from "./scenario-form";
import { TemplateCards } from "./template-cards";

type Editor = { mode: "create"; title: string; form: ScenarioForm } | { mode: "edit"; title: string; form: ScenarioForm; scenario: Scenario };
type Notice = { tone: "success" | "danger"; text: string };

export function ScenariosPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["scenarios"], queryFn: listScenarios });
  const fleet = useQuery({ queryKey: ["scenario-fleet"], queryFn: loadFleet });
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [running, setRunning] = React.useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [comparing, setComparing] = React.useState(false);
  const [baseline, setBaseline] = React.useState("");
  const [viewId, setViewId] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<Scenario | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const scenarios = React.useMemo(() => list.data ?? [], [list.data]);
  const ctx = fleet.data ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["scenarios"] });
  const validSelected = React.useMemo(() => selected.filter((id) => scenarios.some((s) => s.id === id)), [selected, scenarios]);

  const compareKey = validSelected.map((id) => `${id}:${scenarios.find((s) => s.id === id)?.last_run_at ?? ""}`).join("|");
  const compare = useQuery({
    queryKey: ["scenario-compare", compareKey], enabled: comparing && validSelected.length >= 2,
    queryFn: () => compareScenarios(validSelected),
  });

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return scenarios.filter((s) => (showArchived || !readMeta(s.config).archived) && (!q || s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)));
  }, [scenarios, showArchived, search]);
  const archivedCount = scenarios.filter((s) => readMeta(s.config).archived).length;

  const say = (tone: Notice["tone"], text: string) => setNotice({ tone, text });

  const openTemplate = (t: Template) => { if (ctx) setEditor({ mode: "create", title: `New scenario: ${t.title}`, form: t.build(ctx) }); setSaveError(null); };
  const openCustom = () => { setSaveError(null); setEditor({ mode: "create", title: "New scenario", form: emptyForm() }); };

  const save = async (f: ScenarioForm) => {
    if (!editor) return;
    setSaving(true); setSaveError(null);
    try {
      if (editor.mode === "create") { const s = await createScenario(formToInput(f)); say("success", `Created "${s.name}". Run it to see results.`); }
      else { const s = await updateScenario(editor.scenario.id, formToInput(f, editor.scenario)); say("success", `Saved "${s.name}".${s.result ? " Inputs changed: re-run to refresh results." : ""}`); }
      setEditor(null);
      await refresh();
    } catch (e) { setSaveError(describeError(e)); } finally { setSaving(false); }
  };

  const run = async (s: Scenario) => {
    setRunning((p) => new Set(p).add(s.id));
    setNotice(null);
    try { await runScenario(s.id); say("success", `"${s.name}" ran successfully.`); await refresh(); await qc.invalidateQueries({ queryKey: ["scenario-compare"] }); }
    catch (e) { say("danger", `Run failed for "${s.name}": ${describeError(e)}`); }
    finally { setRunning((p) => { const n = new Set(p); n.delete(s.id); return n; }); }
  };

  const duplicate = async (s: Scenario) => {
    setBusy(true);
    try {
      const f = scenarioToForm(s);
      const config = { ...s.config };
      const input = formToInput({ ...f, name: `${s.name} (copy)` }, { config: withMeta(config, { archived: false, inputs_edited_at: new Date().toISOString() }) }, new Date());
      const copy = await createScenario({ ...input, kind: s.kind, config: { ...config, ...input.config } });
      say("success", `Duplicated as "${copy.name}". Results are not copied; run the copy to get its own.`);
      await refresh();
    } catch (e) { say("danger", `Duplicate failed: ${describeError(e)}`); } finally { setBusy(false); }
  };

  const archive = async (s: Scenario) => {
    setBusy(true);
    const next = !readMeta(s.config).archived;
    try {
      await updateScenario(s.id, { name: s.name, description: s.description ?? null, kind: s.kind, config: withMeta(s.config, { archived: next }) });
      say("success", next ? `Archived "${s.name}".` : `Restored "${s.name}".`);
      await refresh();
    } catch (e) { say("danger", `${next ? "Archive" : "Restore"} failed: ${describeError(e)}`); } finally { setBusy(false); }
  };

  const remove = async (s: Scenario) => {
    setBusy(true);
    try { await deleteScenario(s.id); setSelected((p) => p.filter((x) => x !== s.id)); say("success", `Deleted "${s.name}".`); await refresh(); }
    catch (e) { say("danger", `Delete failed: ${describeError(e)}`); } finally { setBusy(false); }
  };

  const toggleSelect = (s: Scenario) => setSelected((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : p.length >= 10 ? p : [...p, s.id]));
  const viewScenario = scenarios.find((s) => s.id === viewId) ?? null;
  const effBaseline = validSelected.includes(baseline) ? baseline : validSelected[0] ?? "";

  return (
    <>
      <PageHeader
        title="Scenarios"
        description="Save what-if delivery set-ups, run them on the backend, and compare cost, distance, time, energy and feasibility."
        actions={<>{USE_DEMO_DATA && <DemoBadge />}<Button variant="primary" onClick={openCustom}><Plus />New scenario</Button></>}
      />

      {USE_DEMO_DATA && <p className="mb-4 rounded-xl bg-brand-soft px-3 py-2 text-xs">Demo mode: scenarios live in this browser tab only and runs use a labelled demo engine with assumed vehicle specs and straight-line distance estimates. Turn demo mode off to use the real backend.</p>}
      <div aria-live="polite" className="empty:hidden">
        {notice && <p role={notice.tone === "danger" ? "alert" : "status"} className={`mb-4 flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm ${notice.tone === "danger" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
          <span>{notice.text}</span><button className="text-xs font-semibold underline" onClick={() => setNotice(null)}>Dismiss</button></p>}
      </div>

      <section aria-labelledby="tpl-h" className="mb-8">
        <h2 id="tpl-h" className="mb-3 text-base font-semibold">Templates</h2>
        <TemplateCards ctx={ctx} loading={fleet.isLoading} error={fleet.isError ? describeError(fleet.error) : undefined} onUse={openTemplate} onCustom={openCustom} />
      </section>

      <section aria-labelledby="saved-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="saved-h" className="text-base font-semibold">Saved scenarios{list.data ? ` (${visible.length})` : ""}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Search scenarios" placeholder="Search scenarios…" className="w-52 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <Switch checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} label={`Show archived${archivedCount ? ` (${archivedCount})` : ""}`} />
            <Button variant={validSelected.length >= 2 ? "primary" : "secondary"} disabled={validSelected.length < 2} onClick={() => { setComparing(true); setBaseline(validSelected[0]); }}>
              <GitCompare />Compare{validSelected.length ? ` (${validSelected.length})` : ""}
            </Button>
          </div>
        </div>
        {validSelected.length === 1 && <p className="mb-3 text-xs text-muted-foreground">Select at least one more scenario to compare.</p>}

        {list.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading scenarios">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-52 rounded-[var(--radius-card)]" />)}</div>
        ) : list.isError ? (
          <ErrorState title="Could not load scenarios" message={describeError(list.error)} onRetry={() => list.refetch()} />
        ) : scenarios.length === 0 ? (
          <EmptyState title="No scenarios yet" description="Pick a template above or create a custom scenario. Each scenario stores its inputs, so you can re-run and compare it later." action={<Button variant="primary" onClick={openCustom}><Plus />New scenario</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState title="No matching scenarios" description={archivedCount && !showArchived ? `${archivedCount} archived scenario(s) are hidden. Turn on "Show archived" to see them.` : "Try a different search."} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((s) => (
              <li key={s.id}>
                <ScenarioCard s={s} selected={validSelected.includes(s.id)} running={running.has(s.id)} busy={busy} actions={{
                  onRun: run, onView: (x) => setViewId(x.id), onEdit: (x) => { setSaveError(null); setEditor({ mode: "edit", title: `Edit "${x.name}"`, form: scenarioToForm(x), scenario: x }); },
                  onDuplicate: duplicate, onArchive: archive, onDelete: setToDelete, onToggleSelect: toggleSelect,
                }} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {comparing && validSelected.length >= 2 && (
        <section aria-labelledby="cmp-h" className="mt-8">
          <h2 id="cmp-h" className="sr-only">Comparison</h2>
          {compare.isLoading ? <Skeleton className="h-64 rounded-[var(--radius-card)]" />
            : compare.isError ? <ErrorState title="Could not compare scenarios" message={describeError(compare.error)} onRetry={() => compare.refetch()} />
            : compare.data ? <CompareView entries={compare.data.scenarios} scenarios={scenarios} baselineId={effBaseline} onBaseline={setBaseline} onRun={run} onClose={() => setComparing(false)} note={compare.data.note} /> : null}
        </section>
      )}

      <ScenarioEditor open={editor !== null} onOpenChange={(o) => { if (!o) setEditor(null); }} title={editor?.title ?? ""} initial={editor?.form ?? emptyForm()}
        ctx={ctx} saving={saving} error={saveError} onSave={save} canChangeKind={editor?.mode !== "edit"} />
      <ScenarioDetails scenario={viewScenario} vehicles={ctx?.vehicles ?? []} onOpenChange={(o) => { if (!o) setViewId(null); }} />
      <ConfirmDialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }} destructive confirmLabel="Delete" title="Delete scenario?"
        description={`"${toDelete?.name ?? ""}" and its stored results will be permanently deleted. Consider archiving instead.`} onConfirm={() => { if (toDelete) void remove(toDelete); }} />
    </>
  );
}
