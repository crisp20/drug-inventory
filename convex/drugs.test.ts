import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = { tokenIdentifier: "iss|owner", email: "Hubert@ActiveCareGroup.com", name: "Hubert" };
const STAFF = { tokenIdentifier: "iss|staff", email: "staff@example.com", name: "Sam" };

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
  const owner = t.withIdentity(OWNER);
  const staff = t.withIdentity(STAFF);
  await owner.mutation(api.users.updateCurrentUser, {});
  await staff.mutation(api.users.updateCurrentUser, {});
  return { t, owner, staff };
}

describe("access", () => {
  it("makes the owner an active admin and new users pending", async () => {
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
    await owner.mutation(api.users.updateAccess, { userId: pending._id, role: "staff", status: "active" });

    const found = await staff.query(api.drugs.search, { term: "(01)09312345678907" });
    expect(found).toHaveLength(1);
    await expect(staff.mutation(api.drugs.create, { ...drug, drugId: "X2" })).rejects.toThrow(/admins/);
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
