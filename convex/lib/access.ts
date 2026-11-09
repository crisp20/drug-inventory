import { ConvexError } from "convex/values";
import { env, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// Splits the OWNER_EMAILS secret (commas, semicolons or spaces) into lower-case emails
export function parseOwnerEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

// Owners come from the OWNER_EMAILS secret and are always active admins.
// Read on every call so a changed secret applies without a code change.
export function isOwnerEmail(email: string | undefined): boolean {
  if (!email) return false;
  return parseOwnerEmails(env.OWNER_EMAILS).includes(email.trim().toLowerCase());
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
