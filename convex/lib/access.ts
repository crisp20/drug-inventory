import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// The owner's account is always an active admin
export const OWNER_EMAILS = ["hubert@activecaregroup.com"];

export function isOwnerEmail(email: string | undefined): boolean {
  return !!email && OWNER_EMAILS.includes(email.trim().toLowerCase());
}

export async function getSignedInUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
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
      message: "Your account is waiting for admin approval",
    });
  }
  return user;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireActiveUser(ctx);
  if (user.role !== "admin") {
    throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can do this" });
  }
  return user;
}
