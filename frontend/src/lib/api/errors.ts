export type ApiErrorKind = "network" | "timeout" | "http" | "validation" | "unavailable";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly details?: unknown;
  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; details?: unknown } = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = opts.status;
    this.details = opts.details;
  }
  get userMessage(): string {
    switch (this.kind) {
      case "timeout": return "The request took too long. Please try again.";
      case "network": return "Cannot reach the RouteZen API. Check that the backend is running.";
      case "unavailable": return this.message;
      case "validation": return "The server returned data in an unexpected shape.";
      default: return this.status && this.status >= 500 ? "The server hit an error. Please try again." : this.message;
    }
  }
}
export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
