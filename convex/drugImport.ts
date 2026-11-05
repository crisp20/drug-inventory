import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/access";
import { SYSTEM_ACTOR, actorOf, logDrugDelete, logDrugImport, type Actor } from "./lib/activity";
import { normalizeBarcode } from "./lib/barcode";
import {
  MAX_IMPORT_BATCH,
  diffDrug,
  packageMatchKey,
  type ImportDrug,
  type ImportPackage,
} from "./lib/drugImport";
import {
  MAX_PACKAGES_PER_DRUG,
  buildSearchText,
  cleanDrugInput,
  deleteDrug,
  getPackages,
  type PackageInput,
} from "./lib/drugs";
import { baseUnit } from "./schema/drugs";

const importPackageArg = v.object({
  barcode: v.string(),
  qtyPerUnit: v.number(),
  baseUnit: baseUnit,
  unitCount: v.number(),
});

const importDrugArg = v.object({
  drugId: v.string(),
  name: v.string(),
  brandName: v.string(),
  manufacturer: v.string(),
  pieceName: v.string(),
  dosageForm: v.string(),
  row: v.number(),
  packages: v.array(importPackageArg),
});

function assertBatch(size: number) {
  if (size > MAX_IMPORT_BATCH) {
    throw new ConvexError({ code: "BAD_REQUEST", message: `Send at most ${MAX_IMPORT_BATCH} drugs at a time` });
  }
}

async function findDrug(ctx: QueryCtx, drugId: string) {
  return await ctx.db
    .query("drugs")
    .withIndex("by_drugId", (q) => q.eq("drugId", drugId.trim()))
    .first();
}

type BarcodeClash = { barcode: string; otherDrugId: string; otherName: string };

// Barcodes in the file that are already saved on a different drug
async function findClashes(ctx: QueryCtx, packages: ImportPackage[], ownRef: Id<"drugs"> | undefined) {
  const clashes: BarcodeClash[] = [];
  for (const p of packages) {
    if (!p.barcode.trim()) continue;
    const other = await ctx.db
      .query("drugPackages")
      .withIndex("by_barcodeKey", (q) => q.eq("barcodeKey", normalizeBarcode(p.barcode)))
      .first();
    if (!other || other.drugRef === ownRef) continue;
    const otherDrug = await ctx.db.get("drugs", other.drugRef);
    clashes.push({ barcode: p.barcode, otherDrugId: otherDrug?.drugId ?? "?", otherName: otherDrug?.name ?? "Unknown" });
  }
  return clashes;
}

function toExisting(drug: Doc<"drugs">, packages: Doc<"drugPackages">[]) {
  return {
    name: drug.name,
    brandName: drug.brandName,
    manufacturer: drug.manufacturer,
    pieceName: drug.pieceName,
    packages: packages.map((p) => ({
      barcode: p.barcode,
      qtyPerUnit: p.qtyPerUnit,
      baseUnit: p.baseUnit,
      unitCount: p.unitCount,
    })),
  };
}

// Compares a batch of file drugs to the saved inventory
export const checkBatch = query({
  args: { drugs: v.array(importDrugArg) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertBatch(args.drugs.length);
    return await Promise.all(
      args.drugs.map(async (d) => {
        const existing = await findDrug(ctx, d.drugId);
        const clashes = await findClashes(ctx, d.packages, existing?._id);
        if (!existing) return { drugId: d.drugId, status: "new" as const, clashes, diff: null };
        const packages = await getPackages(ctx, existing._id);
        const diff = diffDrug(d, toExisting(existing, packages));
        return {
          drugId: d.drugId,
          status: diff.hasChanges ? ("conflict" as const) : ("same" as const),
          clashes,
          diff,
        };
      }),
    );
  },
});

// Every saved drug (one page at a time) so the import can find drugs missing from the file
export const listForImport = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await ctx.db.query("drugs").withIndex("by_drugId").paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (d) => {
          const packages = await getPackages(ctx, d._id);
          return {
            _id: d._id,
            drugId: d.drugId,
            name: d.name,
            brandName: d.brandName,
            stock: packages.reduce((sum, p) => sum + p.stock, 0),
          };
        }),
      ),
    };
  },
});

type ApplyResult = { failure: string | null; skippedBarcodes: string[] };

function failureMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data?.message === "string") return error.data.message;
  return "Could not be saved";
}

// Creates a new drug, or ("update") brings an existing drug in line with the file.
// Stock, pictures and package forms that only exist in the app are never touched.
async function applyDrug(
  ctx: MutationCtx,
  d: ImportDrug,
  action: "create" | "update",
  actor: Actor,
): Promise<ApplyResult> {
  const existing = await findDrug(ctx, d.drugId);
  if (action === "create" && existing) return { failure: "Drug ID already exists", skippedBarcodes: [] };
  if (action === "update" && !existing) return { failure: "Drug no longer exists", skippedBarcodes: [] };

  const clashes = new Set((await findClashes(ctx, d.packages, existing?._id)).map((c) => c.barcode));
  const usable = d.packages.filter((p) => !clashes.has(p.barcode));
  const current = existing ? await getPackages(ctx, existing._id) : [];
  const currentByKey = new Map(current.map((p) => [packageMatchKey(p), p]));

  // Final list of package forms: everything already saved (forms refreshed from the file) plus new ones
  const fileByKey = new Map(usable.map((p) => [packageMatchKey(p), p]));
  const merged: PackageInput[] = current.map((p) => {
    const fromFile = fileByKey.get(packageMatchKey(p));
    return {
      packageId: p._id,
      barcode: p.barcode,
      qtyPerUnit: fromFile?.qtyPerUnit ?? p.qtyPerUnit,
      baseUnit: fromFile?.baseUnit ?? p.baseUnit,
      unitCount: fromFile?.unitCount ?? p.unitCount,
      stock: p.stock,
      imageIds: p.imageIds,
    };
  });
  for (const p of usable) {
    if (currentByKey.has(packageMatchKey(p)) || merged.length >= MAX_PACKAGES_PER_DRUG) continue;
    merged.push({ ...p, stock: 0, imageIds: [] });
  }

  try {
    const input = cleanDrugInput({
      drugId: d.drugId,
      name: d.name,
      brandName: d.brandName,
      manufacturer: d.manufacturer,
      pieceName: d.pieceName,
      imageId: existing?.imageId,
      packages: merged,
    });
    const fields = {
      drugId: input.drugId,
      name: input.name,
      brandName: input.brandName,
      manufacturer: input.manufacturer,
      pieceName: input.pieceName,
      searchText: buildSearchText(input),
      updatedAt: new Date().toISOString(),
    };
    const drugRef = existing ? existing._id : await ctx.db.insert("drugs", fields);
    if (existing) await ctx.db.patch("drugs", existing._id, fields);
    const saved: PackageInput[] = [];
    for (const p of input.packages) {
      const form = { qtyPerUnit: p.qtyPerUnit, baseUnit: p.baseUnit, unitCount: p.unitCount };
      if (p.packageId) {
        await ctx.db.patch("drugPackages", p.packageId, form);
        saved.push(p);
      } else {
        await ctx.db.insert("drugPackages", {
          drugRef,
          barcode: p.barcode,
          barcodeKey: p.barcode ? normalizeBarcode(p.barcode) : "",
          ...form,
          stock: 0,
          imageIds: [],
        });
        saved.push({ ...p, stock: 0, imageIds: [] });
      }
    }
    await logDrugImport(ctx, actor, {
      drug: { _id: drugRef, drugId: input.drugId, name: input.name },
      before: existing,
      beforePackages: current,
      after: input,
      afterPackages: saved,
    });
    return { failure: null, skippedBarcodes: [...clashes] };
  } catch (error) {
    return { failure: failureMessage(error), skippedBarcodes: [...clashes] };
  }
}

export const applyBatch = mutation({
  args: {
    items: v.array(
      v.object({ drug: importDrugArg, action: v.union(v.literal("create"), v.literal("update")) }),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBatch(args.items.length);
    let applied = 0;
    const failures: { drugId: string; name: string; message: string }[] = [];
    const skipped: { drugId: string; name: string; barcodes: string[] }[] = [];
    for (const { drug, action } of args.items) {
      const result = await applyDrug(ctx, drug, action, actorOf(admin));
      if (result.failure) failures.push({ drugId: drug.drugId, name: drug.name, message: result.failure });
      else applied += 1;
      if (result.skippedBarcodes.length > 0) {
        skipped.push({ drugId: drug.drugId, name: drug.name, barcodes: result.skippedBarcodes });
      }
    }
    return { applied, failures, skipped };
  },
});

export const removeBatch = mutation({
  args: { ids: v.array(v.id("drugs")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBatch(args.ids.length);
    let removed = 0;
    for (const id of args.ids) {
      const drug = await ctx.db.get("drugs", id);
      if (!drug) continue;
      await logDrugDelete(ctx, actorOf(admin), drug, await getPackages(ctx, drug._id), "import");
      await deleteDrug(ctx, drug);
      removed += 1;
    }
    return removed;
  },
});

// One-off population from a prepared file: adds drugs that are not saved yet, leaves existing ones alone
export const seedNewDrugs = internalMutation({
  args: { drugs: v.array(importDrugArg) },
  handler: async (ctx, args) => {
    let created = 0;
    let existing = 0;
    const failures: string[] = [];
    for (const d of args.drugs) {
      if (await findDrug(ctx, d.drugId)) {
        existing += 1;
        continue;
      }
      const result = await applyDrug(ctx, d, "create", SYSTEM_ACTOR);
      if (result.failure) failures.push(`${d.drugId}: ${result.failure}`);
      else created += 1;
    }
    return { created, existing, failures };
  },
});
