import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = {
  tokenIdentifier: "iss|owner",
  email: "hubert@activecaregroup.com",
  name: "Hubert",
};
const STAFF = {
  tokenIdentifier: "iss|staff",
  email: "staff@example.com",
  name: "Sam",
};

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

async function setup({ approveStaff = true } = {}) {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  const staff = t.withIdentity(STAFF);
  await owner.mutation(api.users.updateCurrentUser, {});
  await staff.mutation(api.users.updateCurrentUser, {});
  if (approveStaff) {
    const [pending] = await owner.query(api.users.listByStatus, {
      status: "pending",
    });
    await owner.mutation(api.users.updateAccess, {
      userId: pending._id,
      role: "staff",
      status: "active",
    });
  }
  const drugRef = await owner.mutation(api.drugs.create, drug);
  const created = await owner.query(api.drugs.get, { id: drugRef });
  return { owner, staff, packageId: created!.packages[0]._id, drugRef };
}

const entry = { quantity: 4, notes: " Invoice 88 " };

describe("Stock In", () => {
  it("lets staff add stock and logs who did it", async () => {
    const { owner, staff, packageId, drugRef } = await setup();
    const result = await staff.mutation(api.stock.recordIn, {
      packageId,
      ...entry,
    });
    expect(result.stockAfter).toBe(7);

    const updated = await owner.query(api.drugs.get, { id: drugRef });
    expect(updated!.packages[0].stock).toBe(7);

    const log = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(log.page).toHaveLength(1);
    expect(log.page[0]).toMatchObject({
      quantity: 4,
      stockBefore: 3,
      stockAfter: 7,
      userName: "Sam",
      notes: "Invoice 88",
      drugName: "Paracetamol 500mg",
      // Package form is copied from the barcode, never entered by staff
      qtyPerUnit: 10,
      baseUnit: "Strip",
      unitCount: 10,
    });
  });

  it("blocks users who are not approved", async () => {
    const { staff, packageId } = await setup({ approveStaff: false });
    await expect(
      staff.mutation(api.stock.recordIn, { packageId, ...entry }),
    ).rejects.toThrow(/approval/);
  });

  it("rejects invalid quantities and leaves stock unchanged", async () => {
    const { owner, packageId, drugRef } = await setup();
    await expect(
      owner.mutation(api.stock.recordIn, { packageId, ...entry, quantity: 0 }),
    ).rejects.toThrow(/Quantity/);
    const updated = await owner.query(api.drugs.get, { id: drugRef });
    expect(updated!.packages[0].stock).toBe(3);
  });
});

describe("Stock Out", () => {
  const out = { ...entry, quantity: 2, reason: " Dispensed " };

  it("filters by user, reason and time period", async () => {
    const { owner, staff, packageId } = await setup();
    await staff.mutation(api.stock.recordOut, {
      packageId,
      ...out,
      quantity: 1,
    });
    await owner.mutation(api.stock.recordOut, {
      packageId,
      ...out,
      quantity: 1,
      reason: "Expired",
    });
    const page = { numItems: 10, cursor: null };
    const all = await owner.query(api.stock.listMovements, {
      kind: "out",
      paginationOpts: page,
    });
    expect(all.page).toHaveLength(2);
    const samId = all.page.find((m) => m.userName === "Sam")!.userRef;

    const bySam = await owner.query(api.stock.listMovements, {
      kind: "out",
      userId: samId,
      paginationOpts: page,
    });
    expect(bySam.page.map((m) => m.userName)).toEqual(["Sam"]);

    const expired = await owner.query(api.stock.listMovements, {
      kind: "out",
      reason: "Expired",
      paginationOpts: page,
    });
    expect(expired.page.map((m) => m.userName)).toEqual(["Hubert"]);

    const future = await owner.query(api.stock.listMovements, {
      kind: "out",
      since: new Date(Date.now() + 86_400_000).toISOString(),
      paginationOpts: page,
    });
    expect(future.page).toHaveLength(0);
    const past = await owner.query(api.stock.listMovements, {
      kind: "out",
      until: new Date(Date.now() - 86_400_000).toISOString(),
      paginationOpts: page,
    });
    expect(past.page).toHaveLength(0);
  });

  it("lets staff remove stock and logs the reason", async () => {
    const { owner, staff, packageId, drugRef } = await setup();
    const result = await staff.mutation(api.stock.recordOut, {
      packageId,
      ...out,
    });
    expect(result.stockAfter).toBe(1);
    const updated = await owner.query(api.drugs.get, { id: drugRef });
    expect(updated!.packages[0].stock).toBe(1);

    const log = await owner.query(api.stock.listMovements, {
      kind: "out",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(log.page[0]).toMatchObject({
      kind: "out",
      quantity: 2,
      stockBefore: 3,
      stockAfter: 1,
      reason: "Dispensed",
      userName: "Sam",
    });
    const inLog = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(inLog.page).toHaveLength(0);
  });

  it("allows taking stock to exactly zero", async () => {
    const { owner, packageId } = await setup();
    const result = await owner.mutation(api.stock.recordOut, {
      packageId,
      ...out,
      quantity: 3,
    });
    expect(result.stockAfter).toBe(0);
  });

  it("blocks taking out more than is in stock and logs nothing", async () => {
    const { owner, packageId, drugRef } = await setup();
    await expect(
      owner.mutation(api.stock.recordOut, { packageId, ...out, quantity: 4 }),
    ).rejects.toThrow(/only 3 on hand/);
    const updated = await owner.query(api.drugs.get, { id: drugRef });
    expect(updated!.packages[0].stock).toBe(3);
    const log = await owner.query(api.stock.listMovements, {
      kind: "out",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(log.page).toHaveLength(0);
  });

  it("requires a reason", async () => {
    const { owner, packageId } = await setup();
    await expect(
      owner.mutation(api.stock.recordOut, { packageId, ...out, reason: "  " }),
    ).rejects.toThrow(/Reason/);
  });

  it("blocks users who are not approved", async () => {
    const { staff, packageId } = await setup({ approveStaff: false });
    await expect(
      staff.mutation(api.stock.recordOut, { packageId, ...out }),
    ).rejects.toThrow(/approval/);
  });
});

describe("Undo", () => {
  const page = { numItems: 10, cursor: null };

  it("lets an admin undo a Stock In, restoring stock and keeping the entry", async () => {
    const { owner, staff, packageId, drugRef } = await setup();
    await staff.mutation(api.stock.recordIn, { packageId, ...entry });
    const [m] = (
      await owner.query(api.stock.listMovements, {
        kind: "in",
        paginationOpts: page,
      })
    ).page;
    const result = await owner.mutation(api.stock.undoMovement, {
      movementId: m._id,
      reason: " Scanned in error ",
    });
    expect(result.stockAfter).toBe(3);
    expect(
      (await owner.query(api.drugs.get, { id: drugRef }))!.packages[0].stock,
    ).toBe(3);
    const [after] = (
      await owner.query(api.stock.listMovements, {
        kind: "in",
        paginationOpts: page,
      })
    ).page;
    expect(after.undo).toMatchObject({
      reason: "Scanned in error",
      userName: "Hubert",
      stockBefore: 7,
      stockAfter: 3,
    });
  });

  it("adds stock back when undoing a Stock Out", async () => {
    const { owner, packageId } = await setup();
    await owner.mutation(api.stock.recordOut, {
      packageId,
      ...entry,
      quantity: 2,
      reason: "Dispensed",
    });
    const [m] = (
      await owner.query(api.stock.listMovements, {
        kind: "out",
        paginationOpts: page,
      })
    ).page;
    const result = await owner.mutation(api.stock.undoMovement, {
      movementId: m._id,
      reason: "Wrong drug",
    });
    expect(result.stockAfter).toBe(3);
  });

  it("blocks staff, double undo, missing reason, and stock going below zero", async () => {
    const { owner, staff, packageId } = await setup();
    await owner.mutation(api.stock.recordIn, { packageId, ...entry });
    const [m] = (
      await owner.query(api.stock.listMovements, {
        kind: "in",
        paginationOpts: page,
      })
    ).page;
    await expect(
      staff.mutation(api.stock.undoMovement, {
        movementId: m._id,
        reason: "x",
      }),
    ).rejects.toThrow(/admins/);
    await expect(
      owner.mutation(api.stock.undoMovement, {
        movementId: m._id,
        reason: " ",
      }),
    ).rejects.toThrow(/Reason/);

    // Stock was 3 + 4 = 7; take 5 out so undoing the +4 would go negative
    await owner.mutation(api.stock.recordOut, {
      packageId,
      ...entry,
      quantity: 5,
      reason: "Dispensed",
    });
    await expect(
      owner.mutation(api.stock.undoMovement, {
        movementId: m._id,
        reason: "x",
      }),
    ).rejects.toThrow(/only 2 on hand/);

    await owner.mutation(api.stock.recordIn, {
      packageId,
      ...entry,
      quantity: 10,
    });
    await owner.mutation(api.stock.undoMovement, {
      movementId: m._id,
      reason: "x",
    });
    await expect(
      owner.mutation(api.stock.undoMovement, {
        movementId: m._id,
        reason: "x",
      }),
    ).rejects.toThrow(/already/);
  });
});

describe("Filtered log", () => {
  it("narrows entries to one drug or one package form", async () => {
    const { owner, packageId, drugRef } = await setup();
    // A second package form on the same drug, and a different drug
    await owner.mutation(api.drugs.update, {
      id: drugRef,
      ...drug,
      packages: [
        { ...drug.packages[0], packageId },
        {
          barcode: "",
          qtyPerUnit: 20,
          baseUnit: "Box" as const,
          unitCount: 1,
          stock: 5,
          imageIds: [],
        },
      ],
    });
    const updated = await owner.query(api.drugs.get, { id: drugRef });
    const otherPkg = updated!.packages.find((p) => p._id !== packageId)!._id;
    const otherDrug = await owner.mutation(api.drugs.create, {
      ...drug,
      drugId: "IBU200",
      name: "Ibuprofen",
      packages: [{ ...drug.packages[0], barcode: "9300000000001" }],
    });
    const otherDrugPkg = (await owner.query(api.drugs.get, { id: otherDrug }))!
      .packages[0]._id;

    await owner.mutation(api.stock.recordIn, { packageId, ...entry });
    await owner.mutation(api.stock.recordIn, { packageId: otherPkg, ...entry });
    await owner.mutation(api.stock.recordIn, {
      packageId: otherDrugPkg,
      ...entry,
    });

    const page = { numItems: 10, cursor: null };
    const all = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: page,
    });
    expect(all.page).toHaveLength(3);
    const byDrug = await owner.query(api.stock.listMovements, {
      kind: "in",
      filter: { type: "drug", drugId: drugRef },
      paginationOpts: page,
    });
    expect(byDrug.page).toHaveLength(2);
    const byPkg = await owner.query(api.stock.listMovements, {
      kind: "in",
      filter: { type: "package", packageId: otherPkg },
      paginationOpts: page,
    });
    expect(byPkg.page.map((m) => m.packageRef)).toEqual([otherPkg]);
    const outByDrug = await owner.query(api.stock.listMovements, {
      kind: "out",
      filter: { type: "drug", drugId: drugRef },
      paginationOpts: page,
    });
    expect(outByDrug.page).toHaveLength(0);
  });

  it("returns Stock In and Stock Out together for one package form, newest first", async () => {
    const { owner, packageId } = await setup();
    await owner.mutation(api.stock.recordIn, { packageId, ...entry });
    await owner.mutation(api.stock.recordOut, {
      packageId,
      ...entry,
      reason: "Dispensed",
    });
    const page = { numItems: 10, cursor: null };
    const history = await owner.query(api.stock.listMovements, {
      filter: { type: "package", packageId },
      paginationOpts: page,
    });
    expect(history.page.map((m) => m.kind)).toEqual(["out", "in"]);
    // Mixed history is only allowed for a single package form
    await expect(
      owner.query(api.stock.listMovements, { paginationOpts: page }),
    ).rejects.toThrow();
  });
});

describe("Stock In labels (8 box and initials)", () => {
  async function addNoBarcodeForm() {
    const s = await setup();
    await s.owner.mutation(api.drugs.update, {
      id: s.drugRef,
      ...drug,
      packages: [
        { ...drug.packages[0], packageId: s.packageId },
        {
          barcode: "",
          qtyPerUnit: 100,
          baseUnit: "Box" as const,
          unitCount: 1,
          stock: 0,
          imageIds: [],
        },
      ],
    });
    const updated = await s.owner.query(api.drugs.get, { id: s.drugRef });
    const noBarcode = updated!.packages.find((p) => p._id !== s.packageId)!._id;
    return { ...s, noBarcode };
  }
  const page = { numItems: 10, cursor: null };

  it("keeps the 8 mark only for package forms without a barcode", async () => {
    const { owner, staff, packageId, noBarcode } = await addNoBarcodeForm();
    await staff.mutation(api.stock.recordIn, {
      packageId: noBarcode,
      ...entry,
      eight: true,
    });
    await staff.mutation(api.stock.recordIn, {
      packageId,
      ...entry,
      eight: true,
    });
    const log = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: page,
    });
    const byPkg = new Map(log.page.map((m) => [m.packageRef, m]));
    expect(byPkg.get(noBarcode)!.eight).toBe(true);
    expect(byPkg.get(packageId)!.eight).toBeUndefined();
    expect(byPkg.get(packageId)!.labels).toBeUndefined();
  });

  it("keeps labels and the 8 mark when labels are chosen for a barcoded form", async () => {
    const { owner, staff, packageId, noBarcode } = await addNoBarcodeForm();
    await staff.mutation(api.stock.recordIn, {
      packageId,
      ...entry,
      labels: true,
      eight: true,
    });
    // Barcode-less forms always get labels, so "labels" isn't saved for them
    await staff.mutation(api.stock.recordIn, {
      packageId: noBarcode,
      ...entry,
      labels: true,
    });
    const log = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: page,
    });
    const byPkg = new Map(log.page.map((m) => [m.packageRef, m]));
    expect(byPkg.get(packageId)!.labels).toBe(true);
    expect(byPkg.get(packageId)!.eight).toBe(true);
    expect(byPkg.get(noBarcode)!.labels).toBeUndefined();
  });

  it("keeps the Medicine Bag Label choice and its 8 mark on a barcoded form", async () => {
    const { owner, staff, packageId } = await addNoBarcodeForm();
    await staff.mutation(api.stock.recordIn, {
      packageId,
      ...entry,
      bagLabels: true,
      eight: true,
    });
    const log = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: page,
    });
    const m = log.page[0];
    expect(m.bagLabels).toBe(true);
    expect(m.labels).toBeUndefined();
    expect(m.eight).toBe(true);
  });

  it("saves the person's initials, using the admin-set ones when given", async () => {
    const { owner, staff, packageId } = await setup();
    await staff.mutation(api.stock.recordIn, { packageId, ...entry });
    const [pending] = await owner
      .query(api.users.listByStatus, { status: "active" })
      .then((u) => u.filter((x) => x.name === "Sam"));
    await owner.mutation(api.users.setInitials, {
      userId: pending._id,
      initials: " sk ",
    });
    await staff.mutation(api.stock.recordIn, { packageId, ...entry });
    const log = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: page,
    });
    expect(log.page.map((m) => m.userInitials)).toEqual(["SK", "SA"]);
  });

  it("only lets admins set initials, and checks them", async () => {
    const { owner, staff } = await setup();
    const [sam] = (
      await owner.query(api.users.listByStatus, { status: "active" })
    ).filter((x) => x.name === "Sam");
    await expect(
      staff.mutation(api.users.setInitials, {
        userId: sam._id,
        initials: "SK",
      }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.users.setInitials, {
        userId: sam._id,
        initials: "TOO LONG",
      }),
    ).rejects.toThrow(/Initials/);
    await owner.mutation(api.users.setInitials, {
      userId: sam._id,
      initials: "SK",
    });
    await owner.mutation(api.users.setInitials, {
      userId: sam._id,
      initials: "",
    });
    const [after] = (
      await owner.query(api.users.listByStatus, { status: "active" })
    ).filter((x) => x.name === "Sam");
    expect(after.initials).toBeUndefined();
  });
});
