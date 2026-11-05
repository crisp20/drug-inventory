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
    {
      barcode: "9312345678907",
      qtyPerUnit: 10,
      baseUnit: "Strip" as const,
      unitCount: 10,
      stock: 3,
      imageIds: [],
    },
  ],
};

const PAGE = { numItems: 100, cursor: null };

async function setup() {
  const t = convexTest(schema, modules);
  const { owner, staff } = await createTestUsers(t);
  const [pending] = await owner.query(api.users.listByStatus, {
    status: "pending",
  });
  await owner.mutation(api.users.updateAccess, {
    userId: pending._id,
    status: "active",
  });
  const drugRef = await owner.mutation(api.drugs.create, drug);
  const created = await owner.query(api.drugs.get, { id: drugRef });
  return {
    owner,
    staff,
    drugRef,
    packageId: created!.packages[0]._id,
    staffId: pending._id,
  };
}

describe("Activity log", () => {
  it("is only visible to admins", async () => {
    const { staff } = await setup();
    await expect(
      staff.query(api.activity.list, { paginationOpts: PAGE }),
    ).rejects.toThrow();
  });

  it("records added medicines and field edits with old and new values", async () => {
    const { owner, drugRef, packageId } = await setup();
    await owner.mutation(api.drugs.update, {
      id: drugRef,
      ...drug,
      name: "Paracetamol 650mg",
      packages: [{ ...drug.packages[0], packageId }],
    });
    const { page } = await owner.query(api.activity.list, {
      category: "medicine",
      paginationOpts: PAGE,
    });
    const edit = page.find((e) => e.changes?.some((c) => c.field === "Name"));
    expect(edit?.changes).toContainEqual({
      field: "Name",
      before: "Paracetamol 500mg",
      after: "Paracetamol 650mg",
    });
    expect(edit?.userName).toBe("Hubert");
    expect(page.some((e) => e.action.toLowerCase().includes("add"))).toBe(true);
  });

  it("records stock movements and undos, filterable by user and medicine", async () => {
    const { owner, staff, drugRef, packageId, staffId } = await setup();
    await staff.mutation(api.stock.recordIn, {
      packageId,
      quantity: 4,
      notes: "",
    });
    const movements = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: PAGE,
    });
    await owner.mutation(api.stock.undoMovement, {
      movementId: movements.page[0]._id,
      reason: "Wrong medicine",
    });

    const byStaff = await owner.query(api.activity.list, {
      userId: staffId,
      paginationOpts: PAGE,
    });
    expect(byStaff.page.map((e) => e.category)).toContain("stock_in");
    expect(byStaff.page.every((e) => e.userName === "Sam")).toBe(true);

    const undos = await owner.query(api.activity.list, {
      drugId: drugRef,
      category: "undo",
      paginationOpts: PAGE,
    });
    expect(undos.page).toHaveLength(1);
    expect(undos.page[0].userName).toBe("Hubert");
  });

  it("keeps the medicine name after the medicine is deleted", async () => {
    const { owner, drugRef } = await setup();
    await owner.mutation(api.drugs.remove, { id: drugRef });
    const { page } = await owner.query(api.activity.list, {
      category: "medicine",
      paginationOpts: PAGE,
    });
    expect(page[0].drugName).toBe("Paracetamol 500mg");
  });

  it("filters by time period", async () => {
    const { owner } = await setup();
    const { page } = await owner.query(api.activity.list, {
      until: "2000-01-01T00:00:00.000Z",
      paginationOpts: PAGE,
    });
    expect(page).toHaveLength(0);
  });
});
