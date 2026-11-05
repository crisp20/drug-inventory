import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActiveUser, requireAdmin } from "./lib/access";
import { logMovement, logUndo } from "./lib/activity";
import {
  canUseCanister,
  cleanBatchExpiry,
  cleanCanisterInput,
  cleanMismatchedScan,
  type BatchExpiry,
  type CanisterInput,
} from "./lib/canister";
import { withinPeriod } from "./lib/period";
import {
  cleanMovementInput,
  cleanReason,
  nextStock,
  undoneStock,
  type MovementInput,
  type MovementKind,
} from "./lib/stock";
import { movementKind } from "./schema/stock";

const movementArgs = {
  packageId: v.id("drugPackages"),
  quantity: v.number(),
  notes: v.string(),
};

// Updates the package form's stock and appends a log entry in one transaction
async function recordMovement(
  ctx: MutationCtx,
  kind: MovementKind,
  packageId: Id<"drugPackages">,
  raw: MovementInput,
  reason?: string,
  canister?: CanisterInput,
  batchExpiry: BatchExpiry = {},
  mismatchedScan?: string,
) {
  const user = await requireActiveUser(ctx);
  const input = cleanMovementInput(raw);
  const pkg = await ctx.db.get("drugPackages", packageId);
  if (!pkg)
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "This package form no longer exists",
    });
  const drug = await ctx.db.get("drugs", pkg.drugRef);
  if (!drug)
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "This drug no longer exists",
    });

  const stockAfter = nextStock(pkg.stock, kind, input.quantity);
  await ctx.db.patch("drugPackages", pkg._id, { stock: stockAfter });
  const movementId = await ctx.db.insert("stockMovements", {
    kind,
    drugRef: drug._id,
    packageRef: pkg._id,
    drugCode: drug.drugId,
    drugName: drug.name,
    brandName: drug.brandName,
    pieceName: drug.pieceName,
    barcode: pkg.barcode,
    qtyPerUnit: pkg.qtyPerUnit,
    baseUnit: pkg.baseUnit,
    unitCount: pkg.unitCount,
    quantity: input.quantity,
    stockBefore: pkg.stock,
    stockAfter,
    notes: input.notes,
    reason,
    batch: batchExpiry.batch,
    expiry: batchExpiry.expiry,
    mismatchedScan,
    canister,
    userRef: user._id,
    userName: user.name ?? user.email ?? "Unknown user",
    occurredAt: new Date().toISOString(),
  });
  const movement = await ctx.db.get("stockMovements", movementId);
  if (movement) await logMovement(ctx, movement);
  return { stockAfter };
}

// Records stock received. Any approved user can do this.
export const recordIn = mutation({
  args: {
    ...movementArgs,
    batch: v.optional(v.string()),
    expiry: v.optional(v.string()),
    mismatchedScan: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { packageId, batch, expiry, mismatchedScan, ...rest },
  ) => {
    return await recordMovement(
      ctx,
      "in",
      packageId,
      rest,
      undefined,
      undefined,
      cleanBatchExpiry({ batch, expiry }),
      cleanMismatchedScan(mismatchedScan),
    );
  },
});

// Records stock leaving. Blocked if it would take stock below zero.
// Canister details are only accepted from people who can use canister features.
export const recordOut = mutation({
  args: {
    ...movementArgs,
    reason: v.string(),
    batch: v.optional(v.string()),
    expiry: v.optional(v.string()),
    mismatchedScan: v.optional(v.string()),
    canister: v.optional(
      v.object({
        batch: v.string(),
        expiry: v.string(),
        quantity: v.number(),
        type: v.number(),
      }),
    ),
  },
  handler: async (
    ctx,
    { packageId, reason, canister, batch, expiry, mismatchedScan, ...rest },
  ) => {
    let cleanedCanister: CanisterInput | undefined;
    if (canister) {
      const user = await requireActiveUser(ctx);
      const settings = await ctx.db.query("settings").first();
      if (!canUseCanister(user, settings?.canisterForEveryone ?? false)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Canister features are not switched on for you yet",
        });
      }
      cleanedCanister = cleanCanisterInput(canister);
    }
    // A canister always carries the batch and expiry of the stock taken
    const batchExpiry = cleanedCanister
      ? { batch: cleanedCanister.batch, expiry: cleanedCanister.expiry }
      : cleanBatchExpiry({ batch, expiry });
    return await recordMovement(
      ctx,
      "out",
      packageId,
      rest,
      cleanReason(reason),
      cleanedCanister,
      batchExpiry,
      cleanMismatchedScan(mismatchedScan),
    );
  },
});

// Admin-only: reverses an entry's stock change and marks it undone with a reason.
// The entry stays in the history so the audit trail is kept.
export const undoMovement = mutation({
  args: { movementId: v.id("stockMovements"), reason: v.string() },
  handler: async (ctx, { movementId, reason }) => {
    const admin = await requireAdmin(ctx);
    const cleaned = cleanReason(reason);
    const movement = await ctx.db.get("stockMovements", movementId);
    if (!movement)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "This entry no longer exists",
      });
    if (movement.undo)
      throw new ConvexError({
        code: "CONFLICT",
        message: "This entry has already been undone",
      });
    const pkg = await ctx.db.get("drugPackages", movement.packageRef);
    if (!pkg) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "This package form was deleted, so its stock can't be changed",
      });
    }
    const stockAfter = undoneStock(pkg.stock, movement.kind, movement.quantity);
    await ctx.db.patch("drugPackages", pkg._id, { stock: stockAfter });
    await ctx.db.patch("stockMovements", movement._id, {
      undo: {
        reason: cleaned,
        userRef: admin._id,
        userName: admin.name ?? admin.email ?? "Unknown user",
        stockBefore: pkg.stock,
        stockAfter,
        undoneAt: new Date().toISOString(),
      },
    });
    const undone = await ctx.db.get("stockMovements", movement._id);
    if (undone) await logUndo(ctx, undone);
    return { stockAfter };
  },
});

// Optional narrowing: one drug (all its package forms) or one package form (barcode)
const movementFilter = v.optional(
  v.union(
    v.object({ type: v.literal("drug"), drugId: v.id("drugs") }),
    v.object({ type: v.literal("package"), packageId: v.id("drugPackages") }),
  ),
);

// Newest first. Leaving out `kind` returns both Stock In and Stock Out,
// which is only supported for a single package form.
// Time period uses the index; user and reason are filtered before paginating.
export const listMovements = query({
  args: {
    kind: v.optional(movementKind),
    filter: movementFilter,
    since: v.optional(v.string()),
    until: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (
    ctx,
    { kind, filter, since, until, userId, reason, paginationOpts },
  ) => {
    await requireActiveUser(ctx);
    const table = ctx.db.query("stockMovements");
    let scoped;
    if (kind === undefined) {
      if (filter?.type !== "package") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Choose Stock In or Stock Out",
        });
      }
      scoped = table.withIndex("by_package_and_occurredAt", (q) =>
        withinPeriod(q.eq("packageRef", filter.packageId), since, until),
      );
    } else if (filter?.type === "drug") {
      scoped = table.withIndex("by_kind_and_drug_and_occurredAt", (q) =>
        withinPeriod(
          q.eq("kind", kind).eq("drugRef", filter.drugId),
          since,
          until,
        ),
      );
    } else if (filter?.type === "package") {
      scoped = table.withIndex("by_kind_and_package_and_occurredAt", (q) =>
        withinPeriod(
          q.eq("kind", kind).eq("packageRef", filter.packageId),
          since,
          until,
        ),
      );
    } else {
      scoped = table.withIndex("by_kind_and_occurredAt", (q) =>
        withinPeriod(q.eq("kind", kind), since, until),
      );
    }
    return await scoped
      .order("desc")
      .filter((q) =>
        q.and(
          userId ? q.eq(q.field("userRef"), userId) : true,
          reason ? q.eq(q.field("reason"), reason) : true,
        ),
      )
      .paginate(paginationOpts);
  },
});
