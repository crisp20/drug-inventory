import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { createTestUsers } from "./testUsers";

const fileDrug = {
  drugId: "32",
  name: "Amantadine 100mg Tab",
  brandName: "PK-Merz",
  manufacturer: "JACOBSON",
  pieceName: "TABLET",
  dosageForm: "TABLET",
  row: 2,
  packages: [{ barcode: "4046222740115", qtyPerUnit: 100, baseUnit: "Box" as const, unitCount: 1 }],
};

async function setup() {
  const t = convexTest(schema, modules);
  const { owner, staff } = await createTestUsers(t);
  return { owner, staff };
}

describe("drug import", () => {
  it("is admin only", async () => {
    const { staff } = await setup();
    await expect(staff.query(api.drugImport.checkBatch, { drugs: [fileDrug] })).rejects.toThrow();
    await expect(staff.mutation(api.drugImport.applyBatch, { items: [] })).rejects.toThrow();
  });

  it("can import a drug that has no package form", async () => {
    const { owner } = await setup();
    const bare = { ...fileDrug, drugId: "2", name: "Vit K4 Tab", packages: [] };
    const res = await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: bare, action: "create" }] });
    expect(res.failures).toEqual([]);
    const [saved] = await owner.query(api.drugs.search, { term: "Vit K4" });
    expect(saved.packages).toEqual([]);
  });

  it("creates new drugs, then reports a conflict and keeps stock when using the file", async () => {
    const { owner } = await setup();
    const [first] = await owner.query(api.drugImport.checkBatch, { drugs: [fileDrug] });
    expect(first.status).toBe("new");
    await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: fileDrug, action: "create" }] });

    const [saved] = await owner.query(api.drugs.search, { term: "32" });
    await owner.mutation(api.drugs.update, {
      id: saved._id,
      drugId: "32",
      name: saved.name,
      brandName: "Edited",
      manufacturer: saved.manufacturer,
      pieceName: saved.pieceName,
      packages: saved.packages.map((p) => ({
        packageId: p._id,
        barcode: p.barcode,
        qtyPerUnit: p.qtyPerUnit,
        baseUnit: p.baseUnit,
        unitCount: p.unitCount,
        imageIds: p.imageIds,
        stock: 7,
      })),
    });

    const [again] = await owner.query(api.drugImport.checkBatch, { drugs: [fileDrug] });
    expect(again.status).toBe("conflict");
    expect(again.diff?.fields).toEqual([{ label: "Brand name", current: "Edited", file: "PK-Merz" }]);

    const res = await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: fileDrug, action: "update" }] });
    expect(res).toMatchObject({ applied: 1, failures: [] });
    const [updated] = await owner.query(api.drugs.search, { term: "32" });
    expect(updated.brandName).toBe("PK-Merz");
    expect(updated.packages[0].stock).toBe(7);
  });

  it("notes-only update changes Specifications/Remarks and nothing else", async () => {
    const { owner } = await setup();
    await owner.mutation(api.drugImport.applyBatch, {
      items: [{ drug: { ...fileDrug, remarks: "Old remark" }, action: "create" }],
    });
    const fromFile = { ...fileDrug, brandName: "Changed", specifications: "Scored", remarks: "" };
    const [check] = await owner.query(api.drugImport.checkBatch, { drugs: [fromFile] });
    expect(check.status).toBe("conflict");
    expect(check.diff?.notes.map((n) => [n.key, n.auto])).toEqual([["specifications", true], ["remarks", false]]);

    // Keep the saved remark and brand; fill Specifications
    await owner.mutation(api.drugImport.applyBatch, {
      items: [{ drug: { ...fromFile, remarks: undefined }, action: "notes" }],
    });
    const [saved] = await owner.query(api.drugs.search, { term: "32" });
    expect(saved).toMatchObject({ brandName: "PK-Merz", specifications: "Scored", remarks: "Old remark" });

    // Use the file's blank remark: clears it
    await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: fromFile, action: "notes" }] });
    const [cleared] = await owner.query(api.drugs.search, { term: "32" });
    expect(cleared.remarks).toBeUndefined();
  });

  it("adds the package form without a barcode already used by another drug", async () => {
    const { owner } = await setup();
    await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: fileDrug, action: "create" }] });
    const other = { ...fileDrug, drugId: "33", packages: [...fileDrug.packages, { ...fileDrug.packages[0], barcode: "", qtyPerUnit: 10, baseUnit: "Strip" as const }] };
    const [check] = await owner.query(api.drugImport.checkBatch, { drugs: [other] });
    expect(check.clashes).toHaveLength(1);
    expect(check.clashes[0]).toMatchObject({
      otherDrugId: "32",
      otherBrand: "PK-Merz",
      otherManufacturer: "JACOBSON",
      otherPackage: { qtyPerUnit: 100, baseUnit: "Box", unitCount: 1, stock: 0 },
      otherImageUrl: null,
    });
    const res = await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: other, action: "create" }] });
    expect(res.skipped).toEqual([{ drugId: "33", name: other.name, barcodes: ["4046222740115"] }]);
    const [created] = await owner.query(api.drugs.search, { term: "33" });
    expect(created.packages.map((p) => [p.barcode, p.qtyPerUnit, p.baseUnit])).toEqual(
      expect.arrayContaining([["", 100, "Box"], ["", 10, "Strip"]]),
    );
    expect(created.packages).toHaveLength(2);
    // The barcode stays with the first drug
    const [first] = await owner.query(api.drugs.search, { term: "32" });
    expect(first.packages[0].barcode).toBe("4046222740115");
  });

  it("saves a changed barcode given for a clash", async () => {
    const { owner } = await setup();
    await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: fileDrug, action: "create" }] });
    const changed = { ...fileDrug, drugId: "34", packages: [{ ...fileDrug.packages[0], barcode: "4891234567890" }] };
    const res = await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: changed, action: "create" }] });
    expect(res.skipped).toEqual([]);
    const [created] = await owner.query(api.drugs.search, { term: "4891234567890" });
    expect(created.drugId).toBe("34");
  });

  it("merges two clashing barcodes with the same form into one form", async () => {
    const { owner } = await setup();
    const owners = [
      { ...fileDrug, drugId: "50", packages: [{ ...fileDrug.packages[0], barcode: "1111111111116" }] },
      { ...fileDrug, drugId: "51", packages: [{ ...fileDrug.packages[0], barcode: "2222222222222" }] },
    ];
    await owner.mutation(api.drugImport.applyBatch, { items: owners.map((drug) => ({ drug, action: "create" as const })) });
    const both = { ...fileDrug, drugId: "52", packages: owners.map((o) => o.packages[0]) };
    await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: both, action: "create" }] });
    const [created] = await owner.query(api.drugs.search, { term: "52" });
    expect(created.packages).toHaveLength(1);
    expect(created.packages[0].barcode).toBe("");
  });

  it("sets the Look Alike, Sound Alike mark, and unmarking removes the links", async () => {
    const { owner } = await setup();
    await owner.mutation(api.drugImport.applyBatch, {
      items: [
        { drug: { ...fileDrug, lasa: true }, action: "create" },
        { drug: { ...fileDrug, drugId: "40", name: "Amiodarone", packages: [] }, action: "create" },
      ],
    });
    const [marked] = await owner.query(api.drugs.search, { term: "32" });
    expect(marked.lasa).toBe(true);
    const [other] = await owner.query(api.drugs.search, { term: "Amiodarone" });
    expect(other.lasa).toBeUndefined();

    // Link it from the form, then leave the mark alone when the file cell is blank
    await owner.mutation(api.drugs.update, {
      id: marked._id,
      drugId: "32",
      name: marked.name,
      brandName: marked.brandName,
      manufacturer: marked.manufacturer,
      pieceName: marked.pieceName,
      lasa: true,
      lookAlikeIds: [other._id],
      packages: marked.packages.map((p) => ({
        packageId: p._id,
        barcode: p.barcode,
        qtyPerUnit: p.qtyPerUnit,
        baseUnit: p.baseUnit,
        unitCount: p.unitCount,
        imageIds: p.imageIds,
        stock: p.stock,
      })),
    });
    const [same] = await owner.query(api.drugImport.checkBatch, { drugs: [fileDrug] });
    expect(same.status).toBe("same");

    const [check] = await owner.query(api.drugImport.checkBatch, { drugs: [{ ...fileDrug, lasa: false }] });
    expect(check.status).toBe("conflict");
    await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: { ...fileDrug, lasa: false }, action: "notes" }] });
    const after = await owner.query(api.drugs.get, { id: marked._id });
    expect(after?.lasa).toBeUndefined();
    expect(after?.lookAlikes).toEqual([]);
  });
});
