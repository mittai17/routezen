import { describe, expect, it } from "vitest";
import { analyseLocations, coordinateError, csvCell, locationFormSchema, locationsToCsv, parseCsv, parseLocationsCsv } from "./location-utils";

const L = (id: string, name: string, latitude: number, longitude: number) => ({ id, name, latitude, longitude, type: "stop" as const, address: null, zone: null, notes: null });

describe("coordinates", () => {
  it("rejects out of range, NaN and 0,0", () => {
    expect(coordinateError(91, 80)).toMatch(/Latitude/);
    expect(coordinateError(13, 181)).toMatch(/Longitude/);
    expect(coordinateError(NaN, 80)).toBeTruthy();
    expect(coordinateError(0, 0)).toBeTruthy();
    expect(coordinateError(13.08, 80.27)).toBeNull();
  });
});

describe("form schema", () => {
  const ok = { name: " A ", address: "", latitude: "13.08", longitude: "80.27", type: "stop", zone: "", notes: "" };
  it("coerces and trims", () => {
    const r = locationFormSchema.parse(ok);
    expect(r.name).toBe("A");
    expect(r.latitude).toBe(13.08);
  });
  it("reports coordinate errors", () => {
    expect(locationFormSchema.safeParse({ ...ok, latitude: "abc" }).success).toBe(false);
    expect(locationFormSchema.safeParse({ ...ok, latitude: "" }).success).toBe(false);
    expect(locationFormSchema.safeParse({ ...ok, longitude: "200" }).success).toBe(false);
    expect(locationFormSchema.safeParse({ ...ok, latitude: "0", longitude: "0" }).success).toBe(false);
  });
});

describe("analyseLocations", () => {
  it("finds duplicates by name and proximity and flags invalid", () => {
    const m = analyseLocations([L("1", "Adyar", 13.0, 80.25), L("2", " adyar ", 13.1, 80.3), L("3", "Other", 13.0001, 80.25), L("4", "Bad", 95, 80)]);
    expect(m.get("1")!.duplicates.map((d) => d.reason).sort()).toEqual(["coordinates", "name"]);
    expect(m.get("2")!.duplicates).toHaveLength(1);
    expect(m.get("4")!.invalid).toBeTruthy();
  });
});

describe("csv", () => {
  it("round-trips quotes, commas and newlines", () => {
    const csv = locationsToCsv([{ ...L("1", 'He said "hi", ok', 13.1, 80.2), notes: "a\nb" }]);
    const t = parseCsv(csv);
    expect(t[1][0]).toBe('He said "hi", ok');
    expect(t[1][6]).toBe("a\nb");
  });
  it("guards formulas but not numbers", () => {
    expect(csvCell("=SUM(1)")).toBe("'=SUM(1)");
    expect(csvCell(-5)).toBe("-5");
  });
  it("parses import with BOM, aliases, errors and duplicates", () => {
    const text = "﻿name,lat,lng,type\r\nNew,13.2,80.2,depot\r\nBad,xx,80,stop\r\nAdyar,13.5,80.1,stop\r\nFar,13.0001,80.25,warehouse\r\nWeird,13.3,80.3,hq\r\n";
    const r = parseLocationsCsv(text, [L("1", "Adyar", 13.0, 80.25)]);
    expect(r.rows[0].errors).toEqual([]);
    expect(r.rows[0].value?.type).toBe("depot");
    expect(r.rows[1].errors.length).toBeGreaterThan(0);
    expect(r.rows[2].duplicateOf).toBe("Adyar");
    expect(r.rows[3].duplicateOf).toBe("Adyar");
    expect(r.rows[4].errors.length).toBeGreaterThan(0);
  });
  it("rejects missing columns and empty files", () => {
    expect(parseLocationsCsv("foo,bar\n1,2", []).fileError).toMatch(/Missing/);
    expect(parseLocationsCsv("", []).fileError).toBeTruthy();
  });
});
