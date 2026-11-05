import type { convexTest } from "convex-test";

type TestHarness = ReturnType<typeof convexTest>;

export async function createTestUsers(t: TestHarness) {
  const [directorId, staffId] = await t.run(async (ctx) => {
    const directorId = await ctx.db.insert("users", {
      name: "Hubert",
      email: "director@example.com",
      role: "director",
      status: "active",
    });
    const staffId = await ctx.db.insert("users", {
      name: "Sam",
      email: "staff@example.com",
      role: "staff",
      status: "pending",
    });
    return [directorId, staffId] as const;
  });

  const owner = t.withIdentity({
    subject: directorId,
    tokenIdentifier: "issuer|director",
    email: "director@example.com",
    name: "Hubert",
  });
  const staff = t.withIdentity({
    subject: staffId,
    tokenIdentifier: "issuer|staff",
    email: "staff@example.com",
    name: "Sam",
  });
  return { owner, staff, directorId, staffId };
}
