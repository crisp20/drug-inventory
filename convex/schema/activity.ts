import { defineTable } from "convex/server";
import { v } from "convex/values";

// Keep in sync with ACTIVITY_CATEGORIES in convex/lib/activity.ts
export const activityCategory = v.union(
  v.literal("medicine"),
  v.literal("package"),
  v.literal("photo"),
  v.literal("import"),
  v.literal("stock_in"),
  v.literal("stock_out"),
  v.literal("undo"),
  v.literal("user"),
  v.literal("settings"),
);

// Append-only admin audit trail. Names are copied in so entries still read
// correctly after a drug or user is edited or deleted.
export const activityLogTable = defineTable({
  category: activityCategory,
  // Short verb shown as a badge, e.g. "Added", "Edited", "Stock In"
  action: v.string(),
  summary: v.string(),
  drugRef: v.optional(v.id("drugs")),
  drugCode: v.optional(v.string()),
  drugName: v.optional(v.string()),
  detail: v.optional(v.string()),
  // Bounded list of old → new values (capped at MAX_CHANGES)
  changes: v.optional(
    v.array(
      v.object({ field: v.string(), before: v.string(), after: v.string() }),
    ),
  ),
  // Links Stock In / Stock Out / Undo entries to their stock entry
  movementRef: v.optional(v.id("stockMovements")),
  // Empty for system actions (e.g. one-off data loads)
  userRef: v.optional(v.id("users")),
  userName: v.string(),
  occurredAt: v.string(),
})
  .index("by_occurredAt", ["occurredAt"])
  .index("by_category_and_occurredAt", ["category", "occurredAt"])
  .index("by_drug_and_occurredAt", ["drugRef", "occurredAt"])
  .index("by_movement", ["movementRef"]);
