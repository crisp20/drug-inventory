import { defineTable } from "convex/server";
import { v } from "convex/values";

// App-wide settings. A single row; when missing, defaults from convex/lib/settings.ts apply.
export const settingsTable = defineTable({
  // Stock In / Stock Out amounts at or above this ask the user to confirm (guards against scan errors)
  largeQuantityThreshold: v.number(),
  // Canister features shown to everyone (otherwise only to people switched on)
  canisterForEveryone: v.optional(v.boolean()),
  // Canister stock expiring within this many months asks the user to confirm (0 = off)
  expiryWarningMonths: v.optional(v.number()),
  // After this many minutes without use, the app must be refreshed (0 or missing = off)
  idleTimeoutMinutes: v.optional(v.number()),
  updatedAt: v.string(),
  updatedByName: v.string(),
});
