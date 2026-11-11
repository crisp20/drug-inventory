import { defineTable } from "convex/server";
import { v } from "convex/values";

export const userRole = v.union(v.literal("admin"), v.literal("staff"));
export const userStatus = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("disabled"),
);

export const usersTable = defineTable({
  tokenIdentifier: v.string(),
  keycloakUserId: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  // Legacy fields retained for existing rows; authorization comes from Keycloak token roles.
  role: v.optional(userRole),
  status: v.optional(userStatus),
  // Early access to canister features before they are rolled out to everyone
  canisterAccess: v.optional(v.boolean()),
  // Printed on Stock In labels (e.g. "HS"); set by an admin, else taken from the name
  initials: v.optional(v.string()),
})
  .index("by_token", ["tokenIdentifier"])
  .index("by_status", ["status"]);
