import { defineTable } from "convex/server";
import { v } from "convex/values";
import { baseUnit } from "./drugs";

export const movementKind = v.union(v.literal("in"), v.literal("out"));

// Append-only log of every stock change. Drug, barcode and user details are
// copied in so the history still reads correctly after a drug is edited or deleted.
export const stockMovementsTable = defineTable({
  kind: movementKind,
  drugRef: v.id("drugs"),
  packageRef: v.id("drugPackages"),
  drugCode: v.string(),
  drugName: v.string(),
  brandName: v.string(),
  pieceName: v.string(),
  barcode: v.string(),
  // Package form at the time of the movement (copied from the barcode's saved form)
  qtyPerUnit: v.number(),
  baseUnit: baseUnit,
  unitCount: v.number(),
  // Legacy: set on early entries when the form could be edited during a transaction
  formChanged: v.optional(v.boolean()),
  // Number of package forms moved
  quantity: v.number(),
  stockBefore: v.number(),
  stockAfter: v.number(),
  notes: v.string(),
  // Stock Out only (e.g. "Dispensed")
  reason: v.optional(v.string()),
  // Stock Out: batch and expiry (calendar day YYYY-MM-DD) of the stock taken, if entered
  batch: v.optional(v.string()),
  expiry: v.optional(v.string()),
  // Stock Out: GS1 code scanned for batch/expiry whose product code didn't match
  // this package form, kept because the user chose to continue anyway
  mismatchedScan: v.optional(v.string()),
  // Stock Out into a canister (only when "Fill canister" was switched on)
  canister: v.optional(
    v.object({
      batch: v.string(),
      // Calendar day YYYY-MM-DD
      expiry: v.string(),
      // Tablets/capsules put in the canister
      quantity: v.number(),
      // Fraction of a tablet per slot (1, 0.5, 0.33, 0.25, 0.125)
      type: v.number(),
    }),
  ),
  userRef: v.id("users"),
  userName: v.string(),
  occurredAt: v.string(),
  // Set when an admin reverses this entry; its stock change has been put back
  undo: v.optional(
    v.object({
      reason: v.string(),
      userRef: v.id("users"),
      userName: v.string(),
      stockBefore: v.number(),
      stockAfter: v.number(),
      undoneAt: v.string(),
    }),
  ),
})
  .index("by_kind_and_occurredAt", ["kind", "occurredAt"])
  .index("by_kind_and_drug_and_occurredAt", ["kind", "drugRef", "occurredAt"])
  .index("by_kind_and_package_and_occurredAt", [
    "kind",
    "packageRef",
    "occurredAt",
  ])
  // Full In + Out history of one package form (Inventory detail view)
  .index("by_package_and_occurredAt", ["packageRef", "occurredAt"]);
