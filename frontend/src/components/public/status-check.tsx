"use client";
import * as React from "react";
import { CheckCircle2, CircleSlash, RefreshCw, XCircle, AlertTriangle } from "lucide-react";
import { request, USE_DEMO_DATA } from "@/lib/api/client";
import { healthSchema } from "@/lib/schemas";
import type { Health } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type State = { kind: "loading" } | { kind: "demo" } | { kind: "error"; message: string; at: number } | { kind: "ok"; data: Health; at: number };

const LABELS: [keyof Health, string][] = [["db", "Database"], ["routing", "Routing service"], ["optimizer", "Classical optimiser"], ["quantum", "Quantum simulator"]];

function Icon({ v }: { v?: string }) {
  if (!v) return <CircleSlash className="size-5 text-muted-foreground" aria-hidden />;
  if (/^(ok|configured)/.test(v)) return <CheckCircle2 className="size-5 text-success" aria-hidden />;
  if (/degraded/.test(v)) return <AlertTriangle className="size-5 text-warning" aria-hidden />;
  return <XCircle className="size-5 text-danger" aria-hidden />;
}

async function runCheck(): Promise<State> {
  if (USE_DEMO_DATA) return { kind: "demo" };
  try {
    const data = await request("/ready", { schema: healthSchema, timeoutMs: 8000 });
    return { kind: "ok", data, at: Date.now() };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Unknown error", at: Date.now() };
  }
}

/** Shows only what GET /ready actually returns. No uptime history or incident feed is invented. */
export function StatusCheck() {
  const [state, setState] = React.useState<State>({ kind: "loading" });
  React.useEffect(() => { let live = true; void runCheck().then((r) => { if (live) setState(r); }); return () => { live = false; }; }, []);
  const recheck = () => { setState({ kind: "loading" }); void runCheck().then(setState); };

  return (
    <div className="space-y-4">
      <div aria-live="polite" role="status">
        {state.kind === "loading" && <p className="text-muted-foreground">Checking…</p>}
        {state.kind === "demo" && <Card className="p-4 text-sm"><strong>Demo mode.</strong> This build is running with demo data and does not contact a backend, so there are no live checks to show. Set <code>NEXT_PUBLIC_USE_DEMO_DATA=false</code> to check the real API.</Card>}
        {state.kind === "error" && <Card className="border-danger/40 bg-danger-soft p-4 text-sm"><strong>API unreachable.</strong> The readiness check failed: {state.message}. Last checked {new Date(state.at).toLocaleTimeString()}.</Card>}
        {state.kind === "ok" && (
          <Card className="flex items-center gap-3 p-4">
            <Icon v={state.data.status} />
            <div><div className="font-semibold">Overall: {state.data.status === "ok" ? "all required checks passing" : state.data.status}</div><div className="text-xs text-muted-foreground">Last checked {new Date(state.at).toLocaleTimeString()}</div></div>
          </Card>
        )}
      </div>
      {state.kind === "ok" && (
        <div role="list" className="grid gap-3 sm:grid-cols-2">
          {LABELS.map(([k, label]) => (
            <div role="listitem" key={k}><Card className="flex items-center gap-3 p-4"><Icon v={state.data[k]} /><div><div className="text-sm font-semibold">{label}</div><div className="text-sm text-muted-foreground">{state.data[k] ?? "not reported"}</div></div></Card></div>
          ))}
        </div>
      )}
      <Button variant="secondary" onClick={recheck} disabled={state.kind === "loading"}><RefreshCw className={state.kind === "loading" ? "animate-spin" : ""} /> Check again</Button>
      <p className="text-xs text-muted-foreground">Checks come from the API&apos;s <code>/ready</code> endpoint: a database ping and library availability. They do not make an outbound call to the routing provider, so &quot;configured&quot; means set up, not proven reachable. No uptime history is kept.</p>
    </div>
  );
}
