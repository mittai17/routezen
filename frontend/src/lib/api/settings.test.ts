import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, normaliseWeights, settingsFormSchema, weightsValid } from "./settings";

describe("settings", () => {
  it("merges flat server values over defaults and ignores badly typed keys", () => {
    const s = mergeSettings({ currency: "USD", petrol_price: "nope", round_trip: true, scoring_weights: { cost: 1 } });
    expect(s.currency).toBe("USD");
    expect(s.petrol_price).toBe(DEFAULT_SETTINGS.petrol_price);
    expect(s.round_trip).toBe(true);
    expect(s.scoring_weights).toEqual(DEFAULT_SETTINGS.scoring_weights);
  });
  it("validates and normalises weights", () => {
    expect(weightsValid({ a: 0.5, b: 0.5 })).toBe(true);
    expect(weightsValid({ a: 0.5, b: 0.4 })).toBe(false);
    expect(weightsValid(normaliseWeights({ a: 2, b: 2 }))).toBe(true);
  });
  it("rejects invalid form values", () => {
    const { unit_system: _u, ...rest } = DEFAULT_SETTINGS;
    void _u;
    expect(settingsFormSchema.safeParse(rest).success).toBe(true);
    expect(settingsFormSchema.safeParse({ ...rest, petrol_price: -1 }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...rest, workspace_name: " " }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...rest, classical_time_limit_s: 0 }).success).toBe(false);
  });
});
