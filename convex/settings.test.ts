import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { needsLargeQuantityConfirm } from "./lib/settings";
import schema from "./schema";
import { modules } from "./test.setup";
import { createTestUsers } from "./testUsers";

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
  return { owner, staff };
}

describe("Large quantity setting", () => {
  it("defaults to 100 and lets an admin change it", async () => {
    const { owner, staff } = await setup();
    expect(
      (await staff.query(api.settings.get, {})).largeQuantityThreshold,
    ).toBe(100);
    await owner.mutation(api.settings.update, { largeQuantityThreshold: 50 });
    await owner.mutation(api.settings.update, { largeQuantityThreshold: 60 });
    const after = await staff.query(api.settings.get, {});
    expect(after).toMatchObject({
      largeQuantityThreshold: 60,
      updatedByName: "Hubert",
    });
  });

  it("blocks staff and invalid amounts", async () => {
    const { owner, staff } = await setup();
    await expect(
      staff.mutation(api.settings.update, { largeQuantityThreshold: 50 }),
    ).rejects.toThrow(/Director/);
    for (const bad of [0, -5, 2.5, 100_001]) {
      await expect(
        owner.mutation(api.settings.update, { largeQuantityThreshold: bad }),
      ).rejects.toThrow(/whole number/);
    }
  });

  it("asks to confirm at or above the amount, not below", () => {
    expect(needsLargeQuantityConfirm(99, 100)).toBe(false);
    expect(needsLargeQuantityConfirm(100, 100)).toBe(true);
    expect(needsLargeQuantityConfirm(85742, 100)).toBe(true);
  });
});

describe("Idle refresh setting", () => {
  it("is off by default and only admins can set it", async () => {
    const { owner, staff } = await setup();
    expect((await staff.query(api.settings.get, {})).idleTimeoutMinutes).toBe(
      0,
    );
    await expect(
      staff.mutation(api.settings.setIdleTimeout, { idleTimeoutMinutes: 30 }),
    ).rejects.toThrow(/admins/);
    await owner.mutation(api.settings.setIdleTimeout, {
      idleTimeoutMinutes: 30,
    });
    expect((await staff.query(api.settings.get, {})).idleTimeoutMinutes).toBe(
      30,
    );
    for (const bad of [-1, 2.5, 24 * 60 + 1]) {
      await expect(
        owner.mutation(api.settings.setIdleTimeout, {
          idleTimeoutMinutes: bad,
        }),
      ).rejects.toThrow(/minutes/);
    }
  });
});

describe("Expiry warning setting", () => {
  it("defaults to 1 month and only admins can change it", async () => {
    const { owner, staff } = await setup();
    expect((await staff.query(api.settings.get, {})).expiryWarningMonths).toBe(
      1,
    );
    await expect(
      staff.mutation(api.settings.setExpiryWarning, { expiryWarningMonths: 3 }),
    ).rejects.toThrow(/Director/);
    await owner.mutation(api.settings.setExpiryWarning, {
      expiryWarningMonths: 3,
    });
    expect((await staff.query(api.settings.get, {})).expiryWarningMonths).toBe(
      3,
    );
    await expect(
      owner.mutation(api.settings.setExpiryWarning, {
        expiryWarningMonths: 99,
      }),
    ).rejects.toThrow(/months/);
  });
});
