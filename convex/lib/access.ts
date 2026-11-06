import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export async function getSignedInUser(
  ctx: QueryCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId ? await ctx.db.get("users", userId) : null;
}

export async function requireActiveUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in" });
  }
  const user = await getSignedInUser(ctx);
  if (!user || user.status !== "active") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Your account is waiting for Director approval",
    });
  }
  return user;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireActiveUser(ctx);
  if (user.role !== "director") {
    throw new ConvexError({ code: "FORBIDDEN", message: "Only the Director can do this" });
  }
  return user;
}
