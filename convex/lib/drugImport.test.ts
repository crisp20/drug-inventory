import { describe, expect, it } from "vitest";
import { buildImportDrugs, countPackageKinds, diffDrug, listDosageForms, sheetToRecords, toBaseUnit } from "./drugImport";

const HEADER = ["drugid", "printoutName", "brandName", "Manufacturer", "DosageForm", "drugPackageId", "drugId", "barcode", "form", "per", "amount"];

function sheet(rows: (string | number | null)[][]) {
  return sheetToRecords([HEADER, ...rows]).records;
}

describe("sheetToRecords", () => {
  it("maps by header name, first duplicate column wins, and reports missing columns", () => {
    const { records, missingColumns } = sheetToRecords([HEADER, ["7", "Amantadine", "PK-Merz", "--", "TABLET", "1", "99", "4046222740115", "Box", 100, 1]]);
    expect(missingColumns).toEqual([]);
    expect(records[0]).toMatchObject({ row: 2, values: { drugid: "7", per: "100" } });
    expect(sheetToRecords([["drugid", "name"]]).missingColumns).toContain("barcode");
  });
});

describe("buildImportDrugs", () => {
  const rows = sheet([
    ["32", "Amantadine 100mg Tab", "PK-Merz", "JACOBSON", "TABLET", "606", "32", null, "Strip", 20, 2],
    // GS1 and plain versions of the same barcode collapse into one form
    ["32", "Amantadine 100mg Tab", "PK-Merz", "JACOBSON", "TABLET", "22", "32", "0104046222740115112302151728011510B00023810", "Box", 100, 1],
    ["32", "Amantadine 100mg Tab", "PK-Merz", "JACOBSON", "TABLET", "21", "32", "4046222740115", "Box", 100, 1],
    ["1", "Ammo Mixt", "A&I", "--", "ML", "5", "1", "123", "Bot", 100, 1],
    ["2", "Vit K4 Tab", "Vit K4", "--", "TABLET", null, null, null, null, null, null],
    ["3", "Odd Cap", "Odd", "--", "CAPSULE", "9", "3", "999", "Tube", 10, 1],
  ]);

  it("keeps chosen forms, drugs with package forms, and collapses GS1 duplicates", () => {
    const { drugs, leftOut, problems } = buildImportDrugs(rows, ["TABLET", "CAPSULE"]);
    expect(drugs.map((d) => d.drugId)).toEqual(["32"]);
    expect(drugs[0].packages).toEqual([
      { barcode: "", qtyPerUnit: 20, baseUnit: "Strip", unitCount: 2 },
      { barcode: "4046222740115", qtyPerUnit: 100, baseUnit: "Box", unitCount: 1 },
    ]);
    expect(drugs[0].pieceName).toBe("TABLET");
    // "Vit K4" has no package form; "Odd Cap" has an unreadable one
    expect(leftOut).toBe(2);
    expect(problems.map((p) => p.drugId)).toEqual(["3"]);
  });

  it("can import only drugs without package forms, or both kinds", () => {
    const without = buildImportDrugs(rows, ["TABLET", "CAPSULE"], "without");
    expect(without.drugs.map((d) => d.drugId)).toEqual(["2", "3"]);
    expect(without.drugs.every((d) => d.packages.length === 0)).toBe(true);
    expect(without.leftOut).toBe(1);
    const both = buildImportDrugs(rows, ["TABLET", "CAPSULE"], "both");
    expect(both.drugs.map((d) => d.drugId)).toEqual(["32", "2", "3"]);
    expect(both.leftOut).toBe(0);
    expect(countPackageKinds(rows, ["TABLET", "CAPSULE"])).toEqual({ with: 1, without: 2 });
  });

  it("blanks the '--' manufacturer placeholder and maps Bot to Bottle", () => {
    const { drugs } = buildImportDrugs(rows, ["ML"]);
    expect(drugs[0]).toMatchObject({ manufacturer: "", packages: [{ baseUnit: "Bottle" }] });
    expect(toBaseUnit("bot")).toBe("Bottle");
    expect(toBaseUnit("Tube")).toBeNull();
  });

  it("counts distinct drugs per dosage form", () => {
    expect(listDosageForms(rows)[0]).toEqual({ form: "TABLET", drugs: 2 });
  });
});

describe("diffDrug", () => {
  const file = buildImportDrugs(
    sheet([["32", "Amantadine 100mg Tab", "PK-Merz", "JACOBSON", "TABLET", "1", "32", "4046222740115", "Box", 100, 1]]),
    ["TABLET"],
  ).drugs[0];
  const current = {
    name: "Amantadine 100mg Tab",
    brandName: "PK-Merz",
    manufacturer: "JACOBSON",
    pieceName: "TABLET",
    packages: [{ barcode: "(01)04046222740115", qtyPerUnit: 100, baseUnit: "Box" as const, unitCount: 1 }],
  };

  it("finds no changes when the barcode matches in another format", () => {
    expect(diffDrug(file, current).hasChanges).toBe(false);
  });

  it("reports changed fields, new and changed package forms", () => {
    const d = diffDrug(file, {
      ...current,
      brandName: "Old",
      packages: [{ ...current.packages[0], qtyPerUnit: 50 }],
    });
    expect(d.fields).toEqual([{ label: "Brand name", current: "Old", file: "PK-Merz" }]);
    expect(d.changed).toHaveLength(1);
    expect(diffDrug(file, { ...current, packages: [] }).added).toHaveLength(1);
  });

  it("fills blank notes without asking, asks when saved text differs (including a blank file cell)", () => {
    const withNotes = { ...file, specifications: "Round white", remarks: "" };
    const blankApp = diffDrug(withNotes, current);
    expect(blankApp.notes).toEqual([
      { key: "specifications", label: "Specifications", current: "", file: "Round white", auto: true },
    ]);
    expect(blankApp).toMatchObject({ needsReview: false, hasChanges: true, detailChanges: false });

    const saved = diffDrug(withNotes, { ...current, specifications: "Oval", remarks: "Fridge" });
    expect(saved.notes.map((n) => [n.key, n.auto])).toEqual([["specifications", false], ["remarks", false]]);
    expect(saved.needsReview).toBe(true);
  });

  it("ignores notes when the file has no such columns", () => {
    expect(diffDrug(file, { ...current, remarks: "Fridge" }).hasChanges).toBe(false);
  });
});

describe("note columns", () => {
  it("accepts header variations and takes the first non-blank value per drug", () => {
    const { records } = sheetToRecords([
      [...HEADER, "Spec", "Notes"],
      ["32", "A", "B", "M", "TABLET", "1", "32", "111", "Box", 1, 1, "", "Keep dry"],
      ["32", "A", "B", "M", "TABLET", "2", "32", "222", "Box", 2, 1, "Scored", ""],
    ]);
    const [drug] = buildImportDrugs(records, ["TABLET"]).drugs;
    expect(drug).toMatchObject({ specifications: "Scored", remarks: "Keep dry" });
    expect(buildImportDrugs(sheet([["1", "A", "B", "M", "TABLET", "1", "1", "3", "Box", 1, 1]]), ["TABLET"]).drugs[0].remarks).toBeUndefined();
  });
});
