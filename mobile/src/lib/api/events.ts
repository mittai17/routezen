/**
 * Events data access — mirrors `backend/app/schemas/resources.py` (`EventIn`/`EventOut`)
 * and `backend/app/api/v1/resources.py` (`events`).
 */
import { apiRequest, ApiError } from "./client";

export interface DeliveryEvent {
  id: string;
  created_at: string;
  updated_at: string;
  plan_id: string | null;
  package_id: string | null;
  vehicle_id: string | null;
  type: string;
  message: string | null;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  payload: Record<string, unknown>;
}

export type EventInput = Omit<DeliveryEvent, "id" | "created_at" | "updated_at">;

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListEventsParams {
  type?: string;
  plan_id?: string;
  package_id?: string;
  vehicle_id?: string;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export async function listEvents(params: ListEventsParams = {}): Promise<Page<DeliveryEvent>> {
  const { signal, ...query } = params;
  return apiRequest<Page<DeliveryEvent>>("/events", {
    query: { limit: 50, offset: 0, sort: "occurred_at", order: "desc", ...query },
    signal,
  });
}

export async function getEvent(id: string, signal?: AbortSignal): Promise<DeliveryEvent> {
  return apiRequest<DeliveryEvent>(`/events/${encodeURIComponent(id)}`, { signal });
}

export function toEventPayload(e: EventInput): Record<string, unknown> {
  return {
    plan_id: e.plan_id || null,
    package_id: e.package_id || null,
    vehicle_id: e.vehicle_id || null,
    type: e.type.trim(),
    message: e.message ? e.message.trim() : null,
    occurred_at: e.occurred_at || null,
    latitude: e.latitude ?? null,
    longitude: e.longitude ?? null,
    payload: e.payload ?? {},
  };
}

export async function createEvent(input: EventInput): Promise<DeliveryEvent> {
  return apiRequest<DeliveryEvent>("/events", {
    method: "POST",
    body: toEventPayload(input),
  });
}

export async function updateEvent(id: string, input: EventInput): Promise<DeliveryEvent> {
  return apiRequest<DeliveryEvent>(`/events/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: toEventPayload(input),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await apiRequest<unknown>(`/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export { ApiError };
