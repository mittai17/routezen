import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { planningWindow } from "./plan-live";

describe("planningWindow", () => {
  it("converts local HH:MM delivery windows to elapsed route minutes", () => {
    expect(planningWindow("09:00", "10:30", "08:30", true)).toEqual({
      window_start_min: 30,
      window_end_min: 120,
    });
  });

  it("leaves windows out when the constraint is disabled", () => {
    expect(planningWindow("09:00", "10:30", "08:30", false)).toEqual({});
  });

  it("supports an open bound and clamps a window already open at departure", () => {
    expect(planningWindow("", "12:00", "09:00", true)).toEqual({ window_start_min: null, window_end_min: 180 });
    expect(planningWindow("08:00", "12:00", "09:00", true)).toEqual({ window_start_min: 0, window_end_min: 180 });
  });

  it("rejects invalid or previous-day clock values instead of sending ambiguous offsets", () => {
    expect(() => planningWindow("09:00", "08:00", "07:00", true)).toThrow(ApiError);
    expect(() => planningWindow("09:00", "18:99", "08:00", true)).toThrow(ApiError);
    expect(() => planningWindow("09:00", "10:00", "11:00", true)).toThrow(ApiError);
  });
});
