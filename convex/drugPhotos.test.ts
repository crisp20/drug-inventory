import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = { tokenIdentifier: "iss|owner", email: "hubert@activecaregroup.com", name: "Hubert" };
const STAFF = { tokenIdentifier: "iss|staff", email: "staff@example.com", name: "Sam" };

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
  const owner = t.withIdentity(OWNER);
  const staff = t.withIdentity(STAFF);
  await owner.mutation(api.users.updateCurrentUser, {});
  await staff.mutation(api.users.updateCurrentUser, {});
  await owner.mutation(api.drugImport.applyBatch, { items: [{ drug: fileDrug, action: "create" }] });
  const store = () => t.run(async (ctx) => await ctx.storage.store(new Blob(["img"], { type: "image/jpeg" })));
  const fileExists = (id: string) =>
    t.run(async (ctx) => {
      const nid = ctx.db.system.normalizeId("_storage", id);
      return nid ? !!(await ctx.db.system.get("_storage", nid)) : false;
    });
  return { owner, staff, store, fileExists };
}

describe("drug photos", () => {
  it("is admin only", async () => {
    const { staff, store } = await setup();
    const storageId = await store();
    await expect(staff.query(api.drugPhotos.checkPhotos, { drugIds: ["32"] })).rejects.toThrow();
    await expect(staff.mutation(api.drugPhotos.setPhotos, { items: [{ drugId: "32", storageId }] })).rejects.toThrow();
  });

  it("matches by Drug ID, replaces the old picture and removes unmatched uploads", async () => {
    const { owner, store, fileExists } = await setup();
    const [found, missing] = await owner.query(api.drugPhotos.checkPhotos, { drugIds: ["32", "999"] });
    expect(found).toMatchObject({ found: true, hasPhoto: false });
    expect(missing.found).toBe(false);

    const first = await store();
    await owner.mutation(api.drugPhotos.setPhotos, { items: [{ drugId: "32", storageId: first }] });
    const [withPhoto] = await owner.query(api.drugPhotos.checkPhotos, { drugIds: ["32"] });
    expect(withPhoto.hasPhoto).toBe(true);
    expect(withPhoto.photoUrl).toEqual(expect.any(String));
    const second = await store();
    const orphan = await store();
    const res = await owner.mutation(api.drugPhotos.setPhotos, {
      items: [
        { drugId: "32", storageId: second },
        { drugId: "999", storageId: orphan },
      ],
    });

    expect(res).toEqual({ applied: 1, notFound: ["999"] });
    const [saved] = await owner.query(api.drugs.search, { term: "32" });
    expect(saved.imageId).toBe(second);
    expect(await fileExists(first)).toBe(false);
    expect(await fileExists(orphan)).toBe(false);
  });
});
