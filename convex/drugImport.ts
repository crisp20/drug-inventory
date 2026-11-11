import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireRole } from "./lib/access";
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
  cleanNote,
  deleteDrug,
  getPackages,
  type PackageInput,
} from "./lib/drugs";
import { KeycloakClientRole } from "./lib/keycloakRoles";
import { clearLookAlikes, getLookAlikes } from "./lib/lasa";
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
  // Undefined = leave the saved text alone
  specifications: v.optional(v.string()),
  remarks: v.optional(v.string()),
  // Undefined = leave the saved Look Alike, Sound Alike mark alone
  lasa: v.optional(v.boolean()),
  // Undefined = leave the saved Dangerous Drug (DDA) mark alone
  dda: v.optional(v.boolean()),
  row: v.number(),
  packages: v.array(importPackageArg),
});

// create: new drug. update: bring details in line with the file.
// notes: only Specifications/Remarks and the Look Alike, Sound Alike mark.
const importAction = v.union(v.literal("create"), v.literal("update"), v.literal("notes"));
type ImportAction = "create" | "update" | "notes";

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

type BarcodeClash = {
  barcode: string;
  otherDrugId: string;
  otherName: string;
  otherBrand: string;
  otherManufacturer: string;
  otherPieceName: string;
  // The other drug's package form that owns this barcode, and its stock
  otherPackage: { qtyPerUnit: number; baseUnit: Doc<"drugPackages">["baseUnit"]; unitCount: number; stock: number };
  otherImageId: Id<"_storage"> | null;
};

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
    clashes.push({
      barcode: p.barcode,
      otherDrugId: otherDrug?.drugId ?? "?",
      otherName: otherDrug?.name ?? "Unknown",
      otherBrand: otherDrug?.brandName ?? "",
      otherManufacturer: otherDrug?.manufacturer ?? "",
      otherPieceName: otherDrug?.pieceName ?? "units",
      otherPackage: { qtyPerUnit: other.qtyPerUnit, baseUnit: other.baseUnit, unitCount: other.unitCount, stock: other.stock },
      otherImageId: otherDrug?.imageId ?? null,
    });
  }
  return clashes;
}

// Clashes as shown on the review screen, with the other drug's picture
async function describeClashes(ctx: QueryCtx, packages: ImportPackage[], ownRef: Id<"drugs"> | undefined) {
  const clashes = await findClashes(ctx, packages, ownRef);
  return await Promise.all(
    clashes.map(async ({ otherImageId, ...c }) => ({
      ...c,
      otherImageUrl: otherImageId ? await ctx.storage.getUrl(otherImageId) : null,
    })),
  );
}

function toExisting(drug: Doc<"drugs">, packages: Doc<"drugPackages">[]) {
  return {
    name: drug.name,
    brandName: drug.brandName,
    manufacturer: drug.manufacturer,
    pieceName: drug.pieceName,
    specifications: drug.specifications,
    remarks: drug.remarks,
    lasa: drug.lasa,
    dda: drug.dda,
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
    await requireRole(ctx, KeycloakClientRole.inventory_manage);
    assertBatch(args.drugs.length);
    return await Promise.all(
      args.drugs.map(async (d) => {
        const existing = await findDrug(ctx, d.drugId);
        const clashes = await describeClashes(ctx, d.packages, existing?._id);
        if (!existing) return { drugId: d.drugId, status: "new" as const, clashes, diff: null, imageUrl: null };
        const [packages, imageUrl] = await Promise.all([
          getPackages(ctx, existing._id),
          existing.imageId ? ctx.storage.getUrl(existing.imageId) : Promise.resolve(null),
        ]);
        const diff = diffDrug(d, toExisting(existing, packages));
        // conflict: needs a decision. fill: only blank Specifications/Remarks get the file's text.
        const status: "conflict" | "fill" | "same" = diff.needsReview ? "conflict" : diff.hasChanges ? "fill" : "same";
        // Saved picture, shown on the conflict card for easy reference
        return { drugId: d.drugId, status, clashes, diff, imageUrl };
      }),
    );
  },
});

// Checks a replacement barcode typed during the import review: who already has it, if anyone
export const barcodeOwner = query({
  args: { barcode: v.string(), drugId: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, KeycloakClientRole.inventory_manage);
    if (!args.barcode.trim()) return null;
    const own = await findDrug(ctx, args.drugId);
    const [clash] = await findClashes(ctx, [{ barcode: args.barcode, qtyPerUnit: 1, baseUnit: "Box", unitCount: 1 }], own?._id);
    return clash ? { drugId: clash.otherDrugId, name: clash.otherName } : null;
  },
});

// Every saved drug (one page at a time) so the import can find drugs missing from the file
export const listForImport = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireRole(ctx, KeycloakClientRole.inventory_manage);
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

// Every saved drug with its package forms, one page at a time, for the spreadsheet export
// (same columns the import reads, so the file can be edited and imported back)
export const listForExport = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireRole(ctx, KeycloakClientRole.inventory_manage);
    const result = await ctx.db.query("drugs").withIndex("by_drugId").paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (d) => ({
          drugId: d.drugId,
          name: d.name,
          brandName: d.brandName,
          manufacturer: d.manufacturer,
          pieceName: d.pieceName,
          specifications: d.specifications ?? "",
          remarks: d.remarks ?? "",
          lasa: !!d.lasa,
          dda: !!d.dda,
          packages: (await getPackages(ctx, d._id)).map((p) => ({
            barcode: p.barcode,
            qtyPerUnit: p.qtyPerUnit,
            baseUnit: p.baseUnit,
            unitCount: p.unitCount,
          })),
        })),
      ),
    };
  },
});

type ApplyResult = { failure: string | null; skippedBarcodes: string[] };

function failureMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data?.message === "string") return error.data.message;
  return "Could not be saved";
}

// Unmarking a drug also removes its look-alike links; returns them for the activity log
async function unlinkIfUnmarked(ctx: MutationCtx, existing: Doc<"drugs"> | null, lasa: boolean | undefined) {
  if (!existing?.lasa || lasa !== false) return undefined;
  const before = (await getLookAlikes(ctx, existing._id)).map((d) => `${d.name} (${d.drugId})`);
  await clearLookAlikes(ctx, existing._id);
  return { before, after: [] };
}

// A mark to save: the file's value when given, otherwise the saved one. false is stored as "not set".
function lasaToSave(fromFile: boolean | undefined, saved: boolean | undefined) {
  return (fromFile ?? saved) || undefined;
}

// Only Specifications/Remarks and the mark from the file (undefined ones are kept). Everything else is untouched.
async function applyNotes(ctx: MutationCtx, d: ImportDrug, actor: Actor): Promise<ApplyResult> {
  const existing = await findDrug(ctx, d.drugId);
  if (!existing) return { failure: "Drug no longer exists", skippedBarcodes: [] };
  try {
    const notes = {
      specifications: cleanNote(d.specifications ?? existing.specifications, "Specifications"),
      remarks: cleanNote(d.remarks ?? existing.remarks, "Remarks"),
      lasa: lasaToSave(d.lasa, existing.lasa),
      dda: lasaToSave(d.dda, existing.dda),
    };
    await ctx.db.patch("drugs", existing._id, { ...notes, updatedAt: new Date().toISOString() });
    const lookAlikes = await unlinkIfUnmarked(ctx, existing, d.lasa);
    const packages = await getPackages(ctx, existing._id);
    await logDrugImport(ctx, actor, {
      drug: existing,
      before: existing,
      beforePackages: packages,
      after: { ...existing, ...notes },
      afterPackages: packages.map((p) => ({ ...p, packageId: p._id })),
      lookAlikes,
    });
    return { failure: null, skippedBarcodes: [] };
  } catch (error) {
    return { failure: failureMessage(error), skippedBarcodes: [] };
  }
}

// Creates a new drug, or ("update") brings an existing drug in line with the file.
// Stock, pictures and package forms that only exist in the app are never touched.
async function applyDrug(
  ctx: MutationCtx,
  d: ImportDrug,
  action: ImportAction,
  actor: Actor,
): Promise<ApplyResult> {
  if (action === "notes") return await applyNotes(ctx, d, actor);
  const existing = await findDrug(ctx, d.drugId);
  if (action === "create" && existing) return { failure: "Drug ID already exists", skippedBarcodes: [] };
  if (action === "update" && !existing) return { failure: "Drug no longer exists", skippedBarcodes: [] };

  // A barcode that belongs to another drug is dropped, but its package form is still added without a barcode
  const clashes = new Set((await findClashes(ctx, d.packages, existing?._id)).map((c) => c.barcode));
  const usable = d.packages.map((p) => (clashes.has(p.barcode) ? { ...p, barcode: "" } : p));
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
  // Two clashing barcodes with the same form become one form without a barcode
  const added = new Set(currentByKey.keys());
  for (const p of usable) {
    const key = packageMatchKey(p);
    if (added.has(key) || merged.length >= MAX_PACKAGES_PER_DRUG) continue;
    added.add(key);
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
      specifications: d.specifications ?? existing?.specifications,
      remarks: d.remarks ?? existing?.remarks,
      lasa: lasaToSave(d.lasa, existing?.lasa),
      dda: lasaToSave(d.dda, existing?.dda),
      packages: merged,
    }, { allowNoPackages: true });
    const fields = {
      drugId: input.drugId,
      name: input.name,
      brandName: input.brandName,
      manufacturer: input.manufacturer,
      pieceName: input.pieceName,
      specifications: input.specifications,
      remarks: input.remarks,
      lasa: input.lasa,
      dda: input.dda,
      searchText: buildSearchText(input),
      updatedAt: new Date().toISOString(),
    };
    const drugRef = existing ? existing._id : await ctx.db.insert("drugs", fields);
    if (existing) await ctx.db.patch("drugs", existing._id, fields);
    const lookAlikes = await unlinkIfUnmarked(ctx, existing, d.lasa);
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
      lookAlikes,
    });
    return { failure: null, skippedBarcodes: [...clashes] };
  } catch (error) {
    return { failure: failureMessage(error), skippedBarcodes: [...clashes] };
  }
}

export const applyBatch = mutation({
  args: {
    items: v.array(
      v.object({ drug: importDrugArg, action: importAction }),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, KeycloakClientRole.inventory_manage);
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
    const admin = await requireRole(ctx, KeycloakClientRole.inventory_manage);
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
