import type { z } from "zod";
import { ApiError } from "./errors";
import { apiErrorBodySchema } from "@/lib/schemas";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
/** Demo data is ON unless explicitly disabled. */
export const USE_DEMO_DATA = process.env.NEXT_PUBLIC_USE_DEMO_DATA !== "false";
export const DEFAULT_TIMEOUT_MS = 15_000;

export interface RequestOptions<T> {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function request<T>(path: string, opts: RequestOptions<T>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  opts.signal?.addEventListener("abort", () => controller.abort(opts.signal?.reason), { once: true });

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { Accept: "application/json", ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || controller.signal.reason?.name === "TimeoutError")) {
      throw new ApiError("timeout", "Request timed out");
    }
    if (opts.signal?.aborted) throw e;
    throw new ApiError("network", e instanceof Error ? e.message : "Network error");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try { json = JSON.parse(text); } catch { json = undefined; }
  }
  if (!res.ok) {
    const parsed = apiErrorBodySchema.safeParse(json);
    const detail = parsed.success ? parsed.data.detail : undefined;
    const msg = typeof detail === "string" ? detail : parsed.success && parsed.data.message ? parsed.data.message : `Request failed (${res.status})`;
    throw new ApiError("http", msg, { status: res.status, details: detail });
  }
  const result = opts.schema.safeParse(json);
  if (!result.success) throw new ApiError("validation", "Response did not match the API contract", { status: res.status, details: result.error.issues });
  return result.data;
}
