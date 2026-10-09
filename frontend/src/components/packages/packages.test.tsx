import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { packageFormSchema, computeVolumeM3, isDuplicateReference } from "./package-schema";
import { parseCsv, toCsv, validateImport, csvCell } from "./csv";
import { PackageFormDialog } from "./package-form-dialog";

const ok = { reference: "RZ-1", weight_kg: "2.5", priority: "medium", kind: "delivery", status: "pending", service_minutes: "5" };

describe("package form schema", () => {
  it("accepts a minimal valid package", () => {
    const r = packageFormSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.weight_kg).toBe(2.5);
  });
  it("rejects blank reference and blank weight (not coerced to 0)", () => {
    const r = packageFormSchema.safeParse({ ...ok, reference: "  ", weight_kg: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("reference"); expect(paths).toContain("weight_kg");
    }
  });
  it("rejects negative weight, partial dimensions and unpaired coordinates", () => {
    expect(packageFormSchema.safeParse({ ...ok, weight_kg: "-1" }).success).toBe(false);
    expect(packageFormSchema.safeParse({ ...ok, length_cm: "10" }).success).toBe(false);
    expect(packageFormSchema.safeParse({ ...ok, latitude: "13.1" }).success).toBe(false);
    expect(packageFormSchema.safeParse({ ...ok, latitude: "91", longitude: "80" }).success).toBe(false);
    expect(packageFormSchema.safeParse({ ...ok, length_cm: "10", width_cm: "20", height_cm: "30", latitude: "13", longitude: "80" }).success).toBe(true);
  });
});

describe("helpers", () => {
  it("computes volume in m3", () => {
    expect(computeVolumeM3(100, 50, 40)).toBe(0.2);
    expect(computeVolumeM3(10, 10, null)).toBeNull();
  });
  it("detects duplicate references case-insensitively, ignoring self", () => {
    const ex = [{ id: "a", reference: "RZ-1" }];
    expect(isDuplicateReference(" rz-1 ", ex)).toBe(true);
    expect(isDuplicateReference("rz-1", ex, "a")).toBe(false);
  });
  it("round-trips CSV with quotes and guards formula injection", () => {
    expect(parseCsv('a,b\r\n"x,1","he said ""hi"""\n')).toEqual([["a", "b"], ["x,1", 'he said "hi"']]);
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(-5)).toBe("-5");
    expect(toCsv([{ reference: "A,B" }]).split("\r\n")[1].startsWith('"A,B"')).toBe(true);
  });
  it("validates imports and flags duplicates and invalid rows", () => {
    const csv = "reference,weight_kg,priority\nRZ-1,2,HIGH\nrz-2,x,low\nRZ-3,1,low\nRZ-3,1,low\nEXIST,1,low\n";
    const { rows } = validateImport(csv, ["exist"]);
    expect(rows[0].values?.priority).toBe("high");
    expect(rows[1].errors.length).toBeGreaterThan(0);
    expect(rows[2].duplicate).toBeUndefined();
    expect(rows[3].duplicate).toBe("file");
    expect(rows[4].duplicate).toBe("existing");
    expect(validateImport("name\nx\n", []).fatal).toMatch(/reference/);
  });
});

describe("PackageFormDialog", () => {
  const setup = (existing = [] as never[]) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PackageFormDialog open onOpenChange={() => {}} editing={null} existing={existing} onSubmit={onSubmit} />);
    return onSubmit;
  };
  it("shows validation errors and does not submit invalid data", async () => {
    const onSubmit = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add package" }));
    expect(await screen.findByText("Reference is required")).toBeInTheDocument();
    expect(screen.getByText("Weight is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it("auto-calculates volume and submits a valid package", async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText("Reference"), "RZ-9");
    await userEvent.type(screen.getByLabelText("Weight (kg)"), "3");
    await userEvent.type(screen.getByLabelText("Length (cm)"), "100");
    await userEvent.type(screen.getByLabelText("Width (cm)"), "50");
    await userEvent.type(screen.getByLabelText("Height (cm)"), "40");
    expect(screen.getByTestId("volume-preview")).toHaveTextContent("0.2 m³");
    await userEvent.click(screen.getByRole("button", { name: "Add package" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ reference: "RZ-9", weight_kg: 3, volume_m3: 0.2 });
  });
  it("blocks duplicate references", async () => {
    const onSubmit = setup([{ id: "x", reference: "RZ-9" }] as never[]);
    await userEvent.type(screen.getByLabelText("Reference"), "rz-9");
    await userEvent.type(screen.getByLabelText("Weight (kg)"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Add package" }));
    expect(await screen.findByText("A package with this reference already exists")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
