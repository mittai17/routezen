/**
 * Minimal shared REST client for the RouteZen backend.
 *
 * NOTE for reconciliation: this file is not explicitly owned by any group in
 * docs/MOBILE.md's "File ownership" list, but src/lib/api/optimization.ts and
 * analytics.ts (owned by this agent) need a common request helper, and none
 * existed yet. Kept deliberately small and dependency-free so other agents'
 * src/lib/api/{packages,vehicles,recommendations,travel}.ts can reuse it
 * as-is, or the team can swap it for a shared version without touching the
 * call sites much (all go through `apiRequest`).
 *
 * Never run optimization math on-device: every call here is a network
 * request to the FastAPI backend, nothing is computed locally.
 */
import { Platform } from "react-native";

/**
 * Android emulators (AVD) cannot reach the host machine via "localhost" —
 * that resolves to the emulator itself. 10.0.2.2 is the AVD's documented
 * alias for the host loopback. Physical devices need the dev machine's LAN
 * IP (see .env.example); iOS simulators can use localhost directly.
 */
function defaultBaseUrl(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:8000/api/v1";
  return "http://localhost:8000/api/v1";
}

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultBaseUrl()).replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly detail: unknown;

  constructor(message: string, opts: { status?: number | null; code?: string | null; detail?: unknown } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? null;
    this.detail = opts.detail;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** Extract FastAPI's `{detail: string | {code, message}}` error shape, falling back to status text. */
function describeError(status: number, body: unknown): { message: string; code: string | null } {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return { message: detail, code: null };
    if (detail && typeof detail === "object") {
      const d = detail as Record<string, unknown>;
      if (typeof d.message === "string") return { message: d.message, code: typeof d.code === "string" ? d.code : null };
    }
  }
  return { message: `Request failed with status ${status}`, code: null };
}

/**
 * Fetch JSON from the backend. Throws ApiError on network failure, timeout, or non-2xx status.
 * Callers are expected to parse/validate the returned value themselves (no runtime schema here
 * to keep this file dependency-free; optimization.ts and analytics.ts narrow the shapes they use).
 */
export async function apiRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, timeoutMs = 15_000, signal } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal = signal
    ? mergeSignals(signal, controller.signal)
    : controller.signal;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combinedSignal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === "AbortError") {
      throw new ApiError(`Request to ${path} timed out after ${timeoutMs}ms`, { code: "timeout" });
    }
    throw new ApiError(
      `Could not reach the RouteZen backend at ${API_BASE_URL}. Is it running, and reachable from this device/emulator?`,
      { code: "network" },
    );
  }
  clearTimeout(timer);

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const { message, code } = describeError(res.status, data);
    throw new ApiError(message, { status: res.status, code, detail: data });
  }
  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (a.aborted || b.aborted) controller.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  return controller.signal;
}
