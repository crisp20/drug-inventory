import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { getKeycloakClientRoles, KeycloakClientRole } from "./keycloakRoles";

/**
 * 
 * @returns the `User` document associated with the current authenticated account, or `null` if none are found
 */
export async function getUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

/**
 * Requires the account to have the `KeycloakClientRole.access` role.
 * @returns the `User` document associated with the current authenticated account
 */
export async function requireActiveAndHasAccess(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Please sign in"
    });
  }
  if (!getKeycloakClientRoles(identity).includes(KeycloakClientRole.access)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Your account does not have access rights. Contact your administrator to be granted the required Keycloak role."
    });
  }
  const user = await getUser(ctx);
  if (!user) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Your user profile is not available. Please sign in again.",
    });
  }
  return user;
}

/**
 * Requires the account to have the `role` role.
 * @param role the required role
 * @returns the `User` document associated with the current authenticated account
 */
export async function requireRole(ctx: QueryCtx, role: KeycloakClientRole): Promise<Doc<"users">> {
  const user = await getUser(ctx);
  if (!user) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Your user profile is not available. Please sign in again.",
    });
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !getKeycloakClientRoles(identity).includes(role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `The ${role} role is required for this action`,
    });
  }
  return user;
}
