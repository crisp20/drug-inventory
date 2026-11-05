import { defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const userRole = v.union(
  v.literal("director"),
  v.literal("staff"),
  // Keep old rows schema-valid while existing accounts switch to password auth.
  v.literal("admin"),
);
export const userStatus = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("disabled"),
);

export const usersTable = defineTable({
  ...authTables.users.validator.fields,
  tokenIdentifier: v.optional(v.string()),
  role: v.optional(userRole),
  status: v.optional(userStatus),
  canisterAccess: v.optional(v.boolean()),
})
  .index("email", ["email"])
  .index("phone", ["phone"])
  .index("by_token", ["tokenIdentifier"])
  .index("by_status", ["status"]);
