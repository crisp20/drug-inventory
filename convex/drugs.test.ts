import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { createTestUsers } from "./testUsers";

const drug = {
  drugId: "PCM500",
  name: "Paracetamol 500mg",
  brandName: "Panadol",
  manufacturer: "GSK",
  pieceName: "tablets",
  packages: [
    { barcode: "9312345678907", qtyPerUnit: 10, baseUnit: "Strip" as const, unitCount: 10, stock: 3, imageIds: [] },
  ],
};

async function setup() {
  const t = convexTest(schema, modules);
  const { owner, staff } = await createTestUsers(t);
  return { t, owner, staff };
}

describe("access", () => {
  it("keeps the admin active and new users pending", async () => {
    const { owner, staff } = await setup();
    expect(await owner.query(api.users.getCurrentUser, {})).toMatchObject({ role: "admin", status: "active" });
    expect(await staff.query(api.users.getCurrentUser, {})).toMatchObject({ role: "staff", status: "pending" });
  });

  it("blocks pending users from reading inventory", async () => {
    const { staff } = await setup();
    await expect(staff.query(api.drugs.search, { term: "x" })).rejects.toThrow(/approval/);
  });

  it("lets approved staff read but not edit", async () => {
    const { owner, staff } = await setup();
    await owner.mutation(api.drugs.create, drug);
    const [pending] = await owner.query(api.users.listByStatus, { status: "pending" });
    await owner.mutation(api.users.updateAccess, { userId: pending._id, status: "active" });

    const found = await staff.query(api.drugs.search, { term: "(01)09312345678907" });
    expect(found).toHaveLength(1);
    await expect(staff.mutation(api.drugs.create, { ...drug, drugId: "X2" })).rejects.toThrow(/Admin/);
  });
});

describe("drugs", () => {
  it("rejects duplicate Drug IDs and barcodes", async () => {
    const { owner } = await setup();
    await owner.mutation(api.drugs.create, drug);
    await expect(owner.mutation(api.drugs.create, drug)).rejects.toThrow(/already exists/);
    await expect(
      owner.mutation(api.drugs.create, {
        ...drug,
        drugId: "OTHER",
        packages: [{ ...drug.packages[0], barcode: "09312345678907" }],
      }),
    ).rejects.toThrow(/another drug/);
  });

  it("rejects negative stock", async () => {
    const { owner } = await setup();
    await expect(
      owner.mutation(api.drugs.create, { ...drug, packages: [{ ...drug.packages[0], stock: -1 }] }),
    ).rejects.toThrow(/Stock/);
  });

  it("allows package forms without a barcode on different drugs", async () => {
    const { owner } = await setup();
    const noBarcode = { ...drug.packages[0], barcode: "" };
    await owner.mutation(api.drugs.create, { ...drug, packages: [noBarcode] });
    await owner.mutation(api.drugs.create, { ...drug, drugId: "B2", packages: [noBarcode, noBarcode] });
    expect(await owner.query(api.drugs.search, { term: "B2" })).toHaveLength(1);
  });
});

describe("search", () => {
  const make = (drugId: string, name: string, brandName: string, barcode: string) => ({
    ...drug,
    drugId,
    name,
    brandName,
    packages: [{ ...drug.packages[0], barcode }],
  });

  it("requires every typed word to match", async () => {
    const { owner } = await setup();
    await owner.mutation(api.drugs.create, make("68", "Aripiprazole 10mg Tab", "Abilify 10mg Tab", "1111111111116"));
    await owner.mutation(api.drugs.create, make("69", "Aripiprazole 5mg Tab", "Abilify 5mg Tab", "2222222222222"));
    await owner.mutation(api.drugs.create, make("70", "Solifenacin 10mg Tab", "Vesicare", "3333333333338"));

    const names = async (term: string) =>
      (await owner.query(api.drugs.search, { term })).map((d) => d.drugId).sort();

    expect(await names("Abilify 10mg")).toEqual(["68"]);
    expect(await names("abilify 10")).toEqual(["68"]);
    expect(await names("Abilify")).toEqual(["68", "69"]);
  });
});

describe("look alike, sound alike", () => {
  const other = { ...drug, drugId: "PCM650", name: "Paracetamol 650mg", packages: [{ ...drug.packages[0], barcode: "" }] };

  it("links both ways, marks the other drug, and filters the list", async () => {
    const { owner } = await setup();
    const b = await owner.mutation(api.drugs.create, other);
    const a = await owner.mutation(api.drugs.create, { ...drug, lasa: true, lookAlikeIds: [b] });

    const gotA = await owner.query(api.drugs.get, { id: a });
    const gotB = await owner.query(api.drugs.get, { id: b });
    expect(gotA?.lookAlikes.map((d) => d.drugId)).toEqual(["PCM650"]);
    expect(gotB?.lasa).toBe(true);
    expect(gotB?.lookAlikes.map((d) => d.drugId)).toEqual(["PCM500"]);

    const list = await owner.query(api.drugs.listLasa, { paginationOpts: { numItems: 10, cursor: null } });
    expect(list.page.map((d) => d.drugId).sort()).toEqual(["PCM500", "PCM650"]);
  });

  it("unmarking clears links, and deleting a drug removes its links", async () => {
    const { owner } = await setup();
    const b = await owner.mutation(api.drugs.create, other);
    const a = await owner.mutation(api.drugs.create, { ...drug, lasa: true, lookAlikeIds: [b] });
    const saved = await owner.query(api.drugs.get, { id: a });
    if (!saved) throw new Error("missing");
    const pkg = saved.packages[0];
    const packages = [{ packageId: pkg._id, barcode: pkg.barcode, qtyPerUnit: 10, baseUnit: "Strip" as const, unitCount: 10, stock: 3, imageIds: [] }];

    await owner.mutation(api.drugs.update, { id: a, ...drug, packages, lasa: false, lookAlikeIds: [b] });
    expect((await owner.query(api.drugs.get, { id: a }))?.lasa).toBeUndefined();
    expect((await owner.query(api.drugs.get, { id: b }))?.lookAlikes).toEqual([]);

    await owner.mutation(api.drugs.update, { id: a, ...drug, packages, lasa: true, lookAlikeIds: [b] });
    await owner.mutation(api.drugs.remove, { id: a });
    expect((await owner.query(api.drugs.get, { id: b }))?.lookAlikes).toEqual([]);
  });

  it("does not link a drug to itself", async () => {
    const { owner } = await setup();
    const a = await owner.mutation(api.drugs.create, { ...drug, lasa: true });
    const saved = await owner.query(api.drugs.get, { id: a });
    if (!saved) throw new Error("missing");
    const pkg = saved.packages[0];
    await owner.mutation(api.drugs.update, {
      id: a,
      ...drug,
      lasa: true,
      lookAlikeIds: [a],
      packages: [{ packageId: pkg._id, barcode: pkg.barcode, qtyPerUnit: 10, baseUnit: "Strip", unitCount: 10, stock: 3, imageIds: [] }],
    });
    expect((await owner.query(api.drugs.get, { id: a }))?.lookAlikes).toEqual([]);
  });

  it("returns the drug and its look-alikes in full for the warning", async () => {
    const { owner } = await setup();
    const b = await owner.mutation(api.drugs.create, other);
    const a = await owner.mutation(api.drugs.create, { ...drug, lasa: true, lookAlikeIds: [b] });
    const got = await owner.query(api.drugs.lasaCompare, { id: a });
    expect(got?.selected.drugId).toBe("PCM500");
    expect(got?.lookAlikes.map((d) => d.drugId)).toEqual(["PCM650"]);
    expect(got?.lookAlikes[0].packages).toHaveLength(1);
    expect(await owner.query(api.drugs.lasaCompare, { id: "bad-id" })).toBeNull();
  });
});

describe("Dangerous Drug (DDA)", () => {
  it("saves, lists and clears the mark, and logs the change", async () => {
    const { owner } = await setup();
    const a = await owner.mutation(api.drugs.create, { ...drug, dda: true });
    await owner.mutation(api.drugs.create, {
      ...drug,
      drugId: "PCM650",
      name: "Other",
      packages: [{ ...drug.packages[0], barcode: "9300000000001" }],
    });
    const list = await owner.query(api.drugs.listDda, { paginationOpts: { numItems: 10, cursor: null } });
    expect(list.page.map((d) => d.drugId)).toEqual(["PCM500"]);

    const saved = await owner.query(api.drugs.get, { id: a });
    if (!saved) throw new Error("missing");
    const pkg = saved.packages[0];
    const packages = [{ packageId: pkg._id, barcode: pkg.barcode, qtyPerUnit: 10, baseUnit: "Strip" as const, unitCount: 10, stock: 3, imageIds: [] }];
    await owner.mutation(api.drugs.update, { id: a, ...drug, packages, dda: false });
    expect((await owner.query(api.drugs.get, { id: a }))?.dda).toBeUndefined();

    const log = await owner.query(api.activity.list, { paginationOpts: { numItems: 10, cursor: null } });
    const edit = log.page.find((e) => e.action === "Edited");
    expect(edit?.changes).toContainEqual({ field: "Dangerous Drug (DDA)", before: "Yes", after: "No" });
  });

  it("only lets admins mark a drug DDA", async () => {
    const { owner, staff } = await setup();
    const [pending] = await owner.query(api.users.listByStatus, { status: "pending" });
    await owner.mutation(api.users.updateAccess, { userId: pending._id, status: "active" });
    await expect(staff.mutation(api.drugs.create, { ...drug, dda: true })).rejects.toThrow(/admins/);
  });
});
