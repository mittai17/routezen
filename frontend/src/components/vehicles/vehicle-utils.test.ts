import { describe, expect, it } from "vitest";
import { costPerKm, emptyFormValues, parseVehicleForm, specIssues, toFormValues, unitForEnergy, type VehicleInput, type VehicleFormValues } from "./vehicle-utils";

const base: VehicleInput = {
  name: "Diesel van", category: "van", payload_kg: 1200, volume_m3: 9, energy_type: "diesel", efficiency_value: 12, efficiency_unit: "km_per_l",
  energy_price: 92, fixed_cost_per_delivery: 60, operating_cost_per_km: 5.5, avg_speed_kmph: 25, emissions_g_per_km: 210, range_km: 600,
  available: true, source: "OEM sheet", verification: "external",
};
const valid = (over: Partial<VehicleFormValues> = {}): VehicleFormValues => ({ ...toFormValues(base), ...over });

describe("costing helpers", () => {
  it("cost per km = energy price / efficiency + operating cost", () => {
    expect(costPerKm(base)).toBeCloseTo(92 / 12 + 5.5, 6);
  });
  it("maps energy type to the efficiency unit", () => {
    expect(unitForEnergy("electric")).toBe("km_per_kwh");
    expect(unitForEnergy("cng")).toBe("km_per_l");
  });
});

describe("parseVehicleForm", () => {
  it("accepts a complete form and derives the unit", () => {
    const r = parseVehicleForm(valid({ energy_type: "electric", emissions_g_per_km: "0" }));
    expect(r.ok && r.data.efficiency_unit).toBe("km_per_kwh");
  });
  it("rejects blank required numbers instead of coercing to 0", () => {
    const r = parseVehicleForm(valid({ payload_kg: "", efficiency_value: " " }));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.errors.payload_kg).toMatch(/required/); expect(r.errors.efficiency_value).toMatch(/required/); }
  });
  it("rejects zero/negative capacity and efficiency, and negative costs", () => {
    const r = parseVehicleForm(valid({ payload_kg: "0", volume_m3: "-1", efficiency_value: "0", energy_price: "-5" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["efficiency_value", "energy_price", "payload_kg", "volume_m3"]);
  });
  it("rejects non-numeric text and more than 2 decimals on money", () => {
    const r = parseVehicleForm(valid({ payload_kg: "abc", energy_price: "92.555" }));
    expect(!r.ok && r.errors.payload_kg).toMatch(/number/);
    expect(!r.ok && r.errors.energy_price).toMatch(/2 decimal/);
  });
  it("requires a source unless the data is assumed", () => {
    const r = parseVehicleForm(valid({ source: "  ", verification: "measured" }));
    expect(!r.ok && r.errors.source).toMatch(/source/i);
    expect(parseVehicleForm(valid({ source: "", verification: "assumed" })).ok).toBe(true);
  });
  it("treats blank range as null and rejects non-positive range", () => {
    const ok = parseVehicleForm(valid({ range_km: "" }));
    expect(ok.ok && ok.data.range_km).toBeNull();
    expect(parseVehicleForm(valid({ range_km: "0" })).ok).toBe(false);
  });
  it("rejects empty name and category", () => {
    const r = parseVehicleForm({ ...emptyFormValues(), name: " ", category: "" });
    expect(!r.ok && r.errors.name).toBeTruthy();
    expect(!r.ok && r.errors.category).toBeTruthy();
  });
});

describe("specIssues", () => {
  it("is quiet for a complete verified vehicle", () => {
    expect(specIssues(base)).toEqual([]);
  });
  it("explains missing range, price, source and assumed data", () => {
    const f = specIssues({ ...base, range_km: null, energy_price: 0, source: "", verification: "assumed" }).map((i) => i.field);
    expect(f).toEqual(expect.arrayContaining(["range_km", "energy_price", "source", "verification"]));
  });
  it("flags unit mismatch as an error and zero emissions on a fuel vehicle", () => {
    const i = specIssues({ ...base, efficiency_unit: "km_per_kwh", emissions_g_per_km: 0 });
    expect(i.find((x) => x.field === "efficiency_unit")?.severity).toBe("error");
    expect(i.find((x) => x.field === "emissions_g_per_km")?.severity).toBe("warning");
  });
  it("does not flag zero emissions for electric vehicles", () => {
    expect(specIssues({ ...base, energy_type: "electric", efficiency_unit: "km_per_kwh", efficiency_value: 8, emissions_g_per_km: 0 }).some((x) => x.field === "emissions_g_per_km")).toBe(false);
  });
});
