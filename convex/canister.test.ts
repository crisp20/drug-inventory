import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = {
  tokenIdentifier: "iss|owner",
  email: "hubert@activecaregroup.com",
  name: "Hubert",
  drug_inventory_roles: ["access", "admin"],
};
const STAFF = {
  tokenIdentifier: "iss|staff",
  email: "staff@example.com",
  name: "Sam",
  drug_inventory_roles: ["access"],
};

const drug = {
  drugId: "QTP25",
  name: "Quetiapine 25mg Tab",
  brandName: "Seroquel",
  manufacturer: "AZ",
  pieceName: "tablets",
  packages: [
    {
      barcode: "9312345678907",
      qtyPerUnit: 100,
      baseUnit: "Box" as const,
      unitCount: 1,
      stock: 5,
      imageIds: [],
    },
  ],
};

const canister = {
  batch: " 50803-3 ",
  expiry: "2028-09-09",
  quantity: 100,
  type: 1,
};

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  const staff = t.withIdentity(STAFF);
  await owner.mutation(api.users.updateCurrentUser, {});
  await staff.mutation(api.users.updateCurrentUser, {});
  const staffUser = (await owner.query(api.users.listAll, {})).find(
    (user) => user.name === STAFF.name,
  )!;
  const drugRef = await owner.mutation(api.drugs.create, drug);
  const created = await owner.query(api.drugs.get, { id: drugRef });
  return {
    owner,
    staff,
    staffId: staffUser._id,
    packageId: created!.packages[0]._id,
  };
}

const out = { quantity: 1, notes: "", reason: "Dispensed" };

describe("Batch and expiry on any Stock Out", () => {
  it("are optional and saved without canister access", async () => {
    const { owner, staff, packageId } = await setup();
    await staff.mutation(api.stock.recordOut, { packageId, ...out });
    await staff.mutation(api.stock.recordOut, {
      packageId,
      ...out,
      batch: " B77 ",
      expiry: "2029-01-31",
    });
    const { page } = await owner.query(api.stock.listMovements, {
      kind: "out",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0]).toMatchObject({ batch: "B77", expiry: "2029-01-31" });
    expect(page[0].canister).toBeUndefined();
    expect(page[1].batch).toBeUndefined();
    const log = await owner.query(api.activity.list, {
      category: "stock_out",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(log.page[0].detail).toContain("Batch B77 · Exp 2029-01-31");
  });

  it("refuse expired or invalid dates", async () => {
    const { staff, packageId } = await setup();
    await expect(
      staff.mutation(api.stock.recordOut, {
        packageId,
        ...out,
        expiry: "2020-05-01",
      }),
    ).rejects.toThrow(/expired/);
    await expect(
      staff.mutation(api.stock.recordOut, {
        packageId,
        ...out,
        expiry: "2029-02-30",
      }),
    ).rejects.toThrow(/valid expiry/);
  });

  it("save a mismatched scan readably in the history and Log", async () => {
    const { owner, staff, packageId } = await setup();
    await staff.mutation(api.stock.recordOut, {
      packageId,
      ...out,
      batch: "PW5322",
      mismatchedScan: "\u001d0103838957097319\u001d10PW5322\u001d",
    });
    const { page } = await owner.query(api.stock.listMovements, {
      kind: "out",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0].mismatchedScan).toBe("0103838957097319 | 10PW5322");
    const log = await owner.query(api.activity.list, {
      category: "stock_out",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(log.page[0].detail).toContain(
      "Scanned code did not match: 0103838957097319 | 10PW5322",
    );
  });

  it("can be saved on Stock In too, and are checked the same way", async () => {
    const { owner, staff, packageId } = await setup();
    await staff.mutation(api.stock.recordIn, {
      packageId,
      quantity: 2,
      notes: "",
      batch: " RC4304 ",
      expiry: "2099-11-30",
    });
    await staff.mutation(api.stock.recordIn, {
      packageId,
      quantity: 1,
      notes: "",
    });
    const { page } = await owner.query(api.stock.listMovements, {
      kind: "in",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0].batch).toBeUndefined();
    expect(page[1]).toMatchObject({ batch: "RC4304", expiry: "2099-11-30" });
    await expect(
      staff.mutation(api.stock.recordIn, {
        packageId,
        quantity: 1,
        notes: "",
        expiry: "2001-01-01",
      }),
    ).rejects.toThrow();
  });
});

describe("Canister details on Stock Out", () => {
  it("are refused while canister features are hidden for the person", async () => {
    const { staff, packageId } = await setup();
    await expect(
      staff.mutation(api.stock.recordOut, { packageId, ...out, canister }),
    ).rejects.toThrow(/not switched on/);
    // A normal Stock Out still works
    await staff.mutation(api.stock.recordOut, { packageId, ...out });
  });

  it("are saved once switched on for that person", async () => {
    const { owner, staff, staffId, packageId } = await setup();
    await owner.mutation(api.users.setCanisterAccess, {
      userId: staffId,
      enabled: true,
    });
    await staff.mutation(api.stock.recordOut, { packageId, ...out, canister });
    const { page } = await owner.query(api.stock.listMovements, {
      kind: "out",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0].canister).toEqual({ ...canister, batch: "50803-3" });
    const log = await owner.query(api.activity.list, {
      category: "stock_out",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(log.page[0].detail).toContain("Batch 50803-3");
  });

  it("work for everyone after the roll out, and only admins can roll out", async () => {
    const { owner, staff, packageId } = await setup();
    await expect(
      staff.mutation(api.settings.setCanisterRollout, {
        canisterForEveryone: true,
      }),
    ).rejects.toThrow();
    await owner.mutation(api.settings.setCanisterRollout, {
      canisterForEveryone: true,
    });
    await staff.mutation(api.stock.recordOut, { packageId, ...out, canister });
  });

  it("reject invalid details", async () => {
    const { owner, packageId } = await setup();
    await owner.mutation(api.settings.setCanisterRollout, {
      canisterForEveryone: true,
    });
    await expect(
      owner.mutation(api.stock.recordOut, {
        packageId,
        ...out,
        canister: { ...canister, expiry: "2020-01-01" },
      }),
    ).rejects.toThrow(/expired/);
  });

  it("reject invalid details (bad date)", async () => {
    const { owner, packageId } = await setup();
    await owner.mutation(api.settings.setCanisterRollout, {
      canisterForEveryone: true,
    });
    await expect(
      owner.mutation(api.stock.recordOut, {
        packageId,
        ...out,
        canister: { ...canister, expiry: "2028-13-01" },
      }),
    ).rejects.toThrow();
  });
});
