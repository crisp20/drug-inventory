import type { convexTest } from "convex-test";

type TestHarness = ReturnType<typeof convexTest>;

export async function createTestUsers(t: TestHarness) {
  const [adminId, staffId] = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Hubert",
      email: "admin@example.com",
      role: "admin",
      status: "active",
    });
    const staffId = await ctx.db.insert("users", {
      name: "Sam",
      email: "staff@example.com",
      role: "staff",
      status: "pending",
    });
    return [adminId, staffId] as const;
  });

  const owner = t.withIdentity({
    subject: adminId,
    tokenIdentifier: "issuer|admin",
    email: "admin@example.com",
    name: "Hubert",
  });
  const staff = t.withIdentity({
    subject: staffId,
    tokenIdentifier: "issuer|staff",
    email: "staff@example.com",
    name: "Sam",
  });
  return { owner, staff, adminId, staffId };
}
