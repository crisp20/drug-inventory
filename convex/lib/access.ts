import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { keycloakRolesFromClaims } from "./keycloakRoles";

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
    throw new ConvexError({ 
      code: "UNAUTHENTICATED", 
      message: "Please sign in"
    });
  }
  if (!keycloakRolesFromClaims(identity).includes("access")) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Your account does not have access rights. Contact your administrator to be granted the required Keycloak role."
    });
  }
  const user = await getSignedInUser(ctx);
  if (!user) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Your user profile is not available. Please sign in again.",
    });
  }
  return user;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireActiveUser(ctx);
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !keycloakRolesFromClaims(identity).includes("admin")) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Only admins can do this",
    });
  }
  return user;
}
