import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireActiveUser, requireRole, RoleCatelog } from "./lib/access";
import { actorOf, logDrugDelete, logDrugSave } from "./lib/activity";
import { normalizeBarcode, toStoredBarcode } from "./lib/barcode";
import {
  assertBarcodesFree,
  assertDrugIdFree,
  buildSearchText,
  cleanDrugInput,
  deleteDrug,
  deleteFiles,
  filesOf,
  getPackages,
  matchesAllWords,
  packagesFirst,
  searchWords,
  withDetails,
  type PackageInput,
} from "./lib/drugs";
import { baseUnit } from "./schema/drugs";
import { getLookAlikes, setLookAlikes } from "./lib/lasa";

const MAX_SEARCH_WORDS = 5;
const SEARCH_POOL = 150;
const MAX_TEXT_RESULTS = 30;

const packageArg = v.object({
  packageId: v.optional(v.id("drugPackages")),
  barcode: v.string(),
  qtyPerUnit: v.number(),
  baseUnit: baseUnit,
  unitCount: v.number(),
  stock: v.number(),
  imageIds: v.array(v.id("_storage")),
});

const drugArgs = {
  drugId: v.string(),
  name: v.string(),
  brandName: v.string(),
  manufacturer: v.string(),
  pieceName: v.string(),
  imageId: v.optional(v.id("_storage")),
  specifications: v.optional(v.string()),
  remarks: v.optional(v.string()),
  lasa: v.optional(v.boolean()),
  // Drugs this one looks or sounds like; ignored when lasa is off
  lookAlikeIds: v.optional(v.array(v.id("drugs"))),
  // Dangerous Drug (DDA)
  dda: v.optional(v.boolean()),
  packages: v.array(packageArg),
};

function packageFields(p: PackageInput) {
  return {
    barcode: toStoredBarcode(p.barcode),
    barcodeKey: p.barcode ? normalizeBarcode(p.barcode) : "",
    qtyPerUnit: p.qtyPerUnit,
    baseUnit: p.baseUnit,
    unitCount: p.unitCount,
    stock: p.stock,
    imageIds: p.imageIds,
  };
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, RoleCatelog.inventory_manage);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const result = await ctx.db
      .query("drugs")
      .withIndex("by_name")
      .order("asc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((d) => withDetails(ctx, d))),
    };
  },
});

// Only drugs marked Look Alike, Sound Alike, by name
export const listLasa = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const result = await ctx.db
      .query("drugs")
      .withIndex("by_lasa_and_name", (q) => q.eq("lasa", true))
      .order("asc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((d) => withDetails(ctx, d))),
    };
  },
});

// Only drugs marked Dangerous Drug (DDA), by name
export const listDda = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const result = await ctx.db
      .query("drugs")
      .withIndex("by_dda_and_name", (q) => q.eq("dda", true))
      .order("asc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((d) => withDetails(ctx, d))),
    };
  },
});

// Finds drugs by barcode/GS1 code (exact) or by Drug ID, name, or brand (text)
export const search = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const term = args.term.trim();
    if (!term) return [];

    const found = new Map<Id<"drugs">, Doc<"drugs">>();
    const pkg = await ctx.db
      .query("drugPackages")
      .withIndex("by_barcodeKey", (q) => q.eq("barcodeKey", normalizeBarcode(term)))
      .first();
    if (pkg) {
      const drug = await ctx.db.get("drugs", pkg.drugRef);
      if (drug) found.set(drug._id, drug);
    }
    const byId = await ctx.db
      .query("drugs")
      .withIndex("by_drugId", (q) => q.eq("drugId", term))
      .first();
    if (byId) found.set(byId._id, byId);

    // The search index matches ANY word, so gather candidates for the full term and
    // each word, then keep only drugs where EVERY typed word matches
    const words = searchWords(term).slice(0, MAX_SEARCH_WORDS);
    const queries = [term, ...words.filter((w) => w !== term.toLowerCase())];
    const candidates = await Promise.all(
      queries.map((q) =>
        ctx.db
          .query("drugs")
          .withSearchIndex("search_text", (s) => s.search("searchText", q))
          .take(SEARCH_POOL),
      ),
    );
    let textCount = 0;
    for (const d of candidates.flat()) {
      if (textCount >= MAX_TEXT_RESULTS) break;
      if (found.has(d._id) || !matchesAllWords(d.searchText, term)) continue;
      found.set(d._id, d);
      textCount++;
    }

    const detailed = await Promise.all([...found.values()].map((d) => withDetails(ctx, d)));
    return packagesFirst(detailed);
  },
});

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const id = ctx.db.normalizeId("drugs", args.id);
    if (!id) return null;
    const drug = await ctx.db.get("drugs", id);
    return drug ? await withDetails(ctx, drug) : null;
  },
});

// A Look Alike, Sound Alike drug and its linked drugs in full (pictures, package forms, notes)
// so staff can compare them side by side before continuing
export const lasaCompare = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const id = ctx.db.normalizeId("drugs", args.id);
    const drug = id ? await ctx.db.get("drugs", id) : null;
    if (!drug) return null;
    const links = drug.lasa ? await getLookAlikes(ctx, drug._id) : [];
    const others = await Promise.all(links.map((l) => ctx.db.get("drugs", l._id)));
    const [selected, ...lookAlikes] = await Promise.all(
      [drug, ...others.filter((d): d is Doc<"drugs"> => d !== null)].map((d) => withDetails(ctx, d, false)),
    );
    return { selected, lookAlikes };
  },
});

export const create = mutation({
  args: drugArgs,
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, RoleCatelog.inventory_manage);
    const input = cleanDrugInput(args);
    await assertDrugIdFree(ctx, input.drugId);
    await assertBarcodesFree(ctx, input.packages);

    const drugRef = await ctx.db.insert("drugs", {
      drugId: input.drugId,
      name: input.name,
      brandName: input.brandName,
      manufacturer: input.manufacturer,
      pieceName: input.pieceName,
      imageId: input.imageId,
      specifications: input.specifications,
      remarks: input.remarks,
      lasa: input.lasa || undefined,
      dda: input.dda || undefined,
      searchText: buildSearchText(input),
      updatedAt: new Date().toISOString(),
    });
    for (const p of input.packages) {
      await ctx.db.insert("drugPackages", { drugRef, ...packageFields(p) });
    }
    const lookAlikes = await setLookAlikes(ctx, drugRef, input.lasa ? (args.lookAlikeIds ?? []) : []);
    await logDrugSave(ctx, actorOf(admin), {
      drug: { _id: drugRef, drugId: input.drugId, name: input.name },
      before: null,
      beforePackages: [],
      after: input,
      afterPackages: input.packages.map((p) => ({ ...p, barcode: toStoredBarcode(p.barcode) })),
      lookAlikes,
    });
    return drugRef;
  },
});

export const update = mutation({
  args: { id: v.id("drugs"), ...drugArgs },
  handler: async (ctx, { id, lookAlikeIds, ...rest }) => {
    const admin = await requireRole(ctx, RoleCatelog.inventory_manage);
    const drug = await ctx.db.get("drugs", id);
    if (!drug) throw new ConvexError({ code: "NOT_FOUND", message: "Drug not found" });
    const input = cleanDrugInput(rest);
    await assertDrugIdFree(ctx, input.drugId, id);
    await assertBarcodesFree(ctx, input.packages, id);
    const existing = await getPackages(ctx, id);

    // Remove pictures that were replaced or taken out
    const kept = new Set<Id<"_storage">>(filesOf({ ...drug, imageId: input.imageId }, input.packages));
    await deleteFiles(ctx, filesOf(drug, existing).filter((f) => !kept.has(f)));

    await ctx.db.patch("drugs", id, {
      drugId: input.drugId,
      name: input.name,
      brandName: input.brandName,
      manufacturer: input.manufacturer,
      pieceName: input.pieceName,
      imageId: input.imageId,
      // undefined clears the field
      specifications: input.specifications,
      remarks: input.remarks,
      lasa: input.lasa || undefined,
      dda: input.dda || undefined,
      searchText: buildSearchText(input),
      updatedAt: new Date().toISOString(),
    });
    const lookAlikes = await setLookAlikes(ctx, id, input.lasa ? (lookAlikeIds ?? []) : []);

    const incomingIds = new Set(input.packages.map((p) => p.packageId).filter(Boolean));
    for (const old of existing) {
      if (!incomingIds.has(old._id)) await ctx.db.delete("drugPackages", old._id);
    }
    for (const p of input.packages) {
      const fields = packageFields(p);
      const match = existing.find((e) => e._id === p.packageId);
      if (match) await ctx.db.patch("drugPackages", match._id, fields);
      else await ctx.db.insert("drugPackages", { drugRef: id, ...fields });
    }
    await logDrugSave(ctx, actorOf(admin), {
      drug: { _id: id, drugId: input.drugId, name: input.name },
      before: drug,
      beforePackages: existing,
      after: input,
      // Normalized barcodes so a re-saved package isn't reported as changed
      afterPackages: input.packages.map((p) => ({ ...p, barcode: toStoredBarcode(p.barcode) })),
      lookAlikes,
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("drugs") },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, RoleCatelog.inventory_manage);
    const drug = await ctx.db.get("drugs", args.id);
    if (!drug) throw new ConvexError({ code: "NOT_FOUND", message: "Drug not found" });
    await logDrugDelete(ctx, actorOf(admin), drug, await getPackages(ctx, drug._id), "form");
    await deleteDrug(ctx, drug);
    return null;
  },
});
