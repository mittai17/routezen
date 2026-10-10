/**
 * Scenarios data access — mirrors `backend/app/schemas/resources.py`
 * (`ScenarioIn`/`ScenarioOut`/`ScenarioCompareIn`) and `backend/app/api/v1/resources.py` (`scenarios`).
 *
 * Scenarios CRUD:
 * - GET "" (Page<Scenario>)
 * - POST "" (201)
 * - GET "/{id}"
 * - PUT "/{id}"
 * - DELETE "/{id}"
 * Extra endpoints:
 * - POST "/compare" -> { scenarios: ScenarioCompareOut[], note: string }
 * - POST "/{id}/run" -> runs scenario synchronously, returns Scenario. (Quantum returns 422).
 */
import { apiRequest, ApiError } from "./client";

export type ScenarioKind = "recommendation" | "classical" | "quantum";

export interface Scenario {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  kind: ScenarioKind;
  config: Record<string, unknown>;
  result: Record<string, unknown> | null;
  last_run_at: string | null;
}

export type ScenarioInput = Omit<Scenario, "id" | "created_at" | "updated_at" | "result" | "last_run_at">;

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListScenariosParams {
  q?: string;
  kind?: ScenarioKind;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface ScenarioCompareItem {
  id: string;
  name: string;
  kind: ScenarioKind;
  last_run_at: string | null;
  result: Record<string, unknown> | null;
  summary?: Record<string, unknown>;
}

export interface ScenarioCompareResponse {
  scenarios: ScenarioCompareItem[];
  note: string;
}

export const SCENARIO_KIND_LABELS: Record<ScenarioKind, string> = {
  recommendation: "Recommendation",
  classical: "Classical",
  quantum: "Quantum",
};

export async function listScenarios(params: ListScenariosParams = {}): Promise<Page<Scenario>> {
  const { signal, ...query } = params;
  return apiRequest<Page<Scenario>>("/scenarios", {
    query: { limit: 50, offset: 0, sort: "created_at", order: "desc", ...query },
    signal,
  });
}

export async function getScenario(id: string, signal?: AbortSignal): Promise<Scenario> {
  return apiRequest<Scenario>(`/scenarios/${encodeURIComponent(id)}`, { signal });
}

export function toScenarioPayload(s: ScenarioInput): Record<string, unknown> {
  return {
    name: s.name.trim(),
    description: s.description ? s.description.trim() : null,
    kind: s.kind,
    config: s.config ?? {},
  };
}

export async function createScenario(input: ScenarioInput): Promise<Scenario> {
  return apiRequest<Scenario>("/scenarios", {
    method: "POST",
    body: toScenarioPayload(input),
  });
}

export async function updateScenario(id: string, input: ScenarioInput): Promise<Scenario> {
  return apiRequest<Scenario>(`/scenarios/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: toScenarioPayload(input),
  });
}

export async function deleteScenario(id: string): Promise<void> {
  await apiRequest<unknown>(`/scenarios/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function compareScenarios(scenarioIds: string[]): Promise<ScenarioCompareResponse> {
  return apiRequest<ScenarioCompareResponse>("/scenarios/compare", {
    method: "POST",
    body: { scenario_ids: scenarioIds },
  });
}

export async function runScenario(id: string): Promise<Scenario> {
  return apiRequest<Scenario>(`/scenarios/${encodeURIComponent(id)}/run`, {
    method: "POST",
  });
}

export { ApiError };
