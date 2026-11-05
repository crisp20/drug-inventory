import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { normalizeBarcode, type BaseUnit } from "./barcode";

export const MAX_PACKAGING_IMAGES = 10;
export const MAX_PACKAGES_PER_DRUG = 20;

export type PackageInput = {
  packageId?: Id<"drugPackages">;
  barcode: string;
  qtyPerUnit: number;
  baseUnit: BaseUnit;
  unitCount: number;
  stock: number;
  imageIds: Id<"_storage">[];
};

export type DrugInput = {
  drugId: string;
  name: string;
  brandName: string;
  manufacturer: string;
  pieceName: string;
  imageId?: Id<"_storage">;
  // Free text; undefined or blank means none
  specifications?: string;
  remarks?: string;
  packages: PackageInput[];
};

export const MAX_NOTE_LENGTH = 2000;

// Trims free text; blank becomes undefined so nothing empty is stored
export function cleanNote(raw: string | undefined, label: string): string | undefined {
  const text = raw?.trim() ?? "";
  if (text.length > MAX_NOTE_LENGTH) bad(`${label} must be ${MAX_NOTE_LENGTH} characters or fewer`);
  return text || undefined;
}

function bad(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

function isPositiveInt(n: number) {
  return Number.isInteger(n) && n > 0;
}

// Validates and trims user input. Returns cleaned values.
// The import may save drugs with no package form when the admin chose to (allowNoPackages).
export function cleanDrugInput(input: DrugInput, opts: { allowNoPackages?: boolean } = {}): DrugInput {
  const drugId = input.drugId.trim();
  const name = input.name.trim();
  if (!drugId) bad("Drug ID is required");
  if (drugId.length > 64) bad("Drug ID must be 64 characters or fewer");
  if (!name) bad("Drug name is required");
  if (input.packages.length === 0 && !opts.allowNoPackages) bad("Add at least one barcode and package form");
  if (input.packages.length > MAX_PACKAGES_PER_DRUG) {
    bad(`A drug can have up to ${MAX_PACKAGES_PER_DRUG} barcodes`);
  }

  const seen = new Set<string>();
  const packages = input.packages.map((p) => {
    // An empty barcode means the medicine has no barcode (confirmed by the user)
    const barcode = p.barcode.trim();
    if (barcode) {
      const key = normalizeBarcode(barcode);
      if (seen.has(key)) bad(`Barcode ${barcode} is listed twice`);
      seen.add(key);
    }
    if (!isPositiveInt(p.qtyPerUnit)) bad("Quantity per base unit must be a whole number above 0");
    if (!isPositiveInt(p.unitCount)) bad("Number of base units must be a whole number above 0");
    if (!Number.isInteger(p.stock) || p.stock < 0) bad("Stock amount must be a whole number, 0 or more");
    if (p.imageIds.length > MAX_PACKAGING_IMAGES) {
      bad(`Each package form can have up to ${MAX_PACKAGING_IMAGES} packaging pictures`);
    }
    return { ...p, barcode };
  });

  return {
    ...input,
    drugId,
    name,
    brandName: input.brandName.trim(),
    manufacturer: input.manufacturer.trim(),
    pieceName: input.pieceName.trim() || "units",
    specifications: cleanNote(input.specifications, "Specifications"),
    remarks: cleanNote(input.remarks, "Remarks"),
    packages,
  };
}

export function buildSearchText(d: Pick<DrugInput, "drugId" | "name" | "brandName">) {
  return [d.drugId, d.name, d.brandName].join(" ");
}

// Splits text into lowercase words, treating punctuation ("10mg/tab", "(Abilify)") as breaks
export function searchWords(text: string) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// True when every typed word starts one of the drug's words, so "abil 10" finds "Abilify 10mg"
export function matchesAllWords(searchText: string, term: string) {
  const tokens = searchWords(searchText);
  return searchWords(term).every((w) => tokens.some((t) => t.startsWith(w)));
}

export async function assertDrugIdFree(ctx: QueryCtx, drugId: string, exceptId?: Id<"drugs">) {
  const existing = await ctx.db
    .query("drugs")
    .withIndex("by_drugId", (q) => q.eq("drugId", drugId))
    .first();
  if (existing && existing._id !== exceptId) {
    throw new ConvexError({ code: "CONFLICT", message: `Drug ID ${drugId} already exists` });
  }
}

export async function assertBarcodesFree(
  ctx: QueryCtx,
  packages: PackageInput[],
  drugRef?: Id<"drugs">,
) {
  for (const p of packages) {
    if (!p.barcode) continue;
    const existing = await ctx.db
      .query("drugPackages")
      .withIndex("by_barcodeKey", (q) => q.eq("barcodeKey", normalizeBarcode(p.barcode)))
      .first();
    if (existing && existing.drugRef !== drugRef) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Barcode ${p.barcode} already belongs to another drug`,
      });
    }
  }
}

export async function getPackages(ctx: QueryCtx, drugRef: Id<"drugs">) {
  return await ctx.db
    .query("drugPackages")
    .withIndex("by_drug", (q) => q.eq("drugRef", drugRef))
    .take(MAX_PACKAGES_PER_DRUG);
}

// Every stored file a drug owns: its picture plus each package form's pictures
export function filesOf(drug: Doc<"drugs">, packages: Pick<PackageInput, "imageIds">[]) {
  return [...(drug.imageId ? [drug.imageId] : []), ...packages.flatMap((p) => p.imageIds)];
}

async function resolveImages(ctx: QueryCtx, ids: Id<"_storage">[]) {
  return await Promise.all(ids.map(async (id) => ({ id, url: await ctx.storage.getUrl(id) })));
}

// Adds image URLs and package forms (each with its packaging pictures) for display
export async function withDetails(ctx: QueryCtx, drug: Doc<"drugs">) {
  const [imageUrl, rawPackages] = await Promise.all([
    drug.imageId ? ctx.storage.getUrl(drug.imageId) : Promise.resolve(null),
    getPackages(ctx, drug._id),
  ]);
  const packages = await Promise.all(
    rawPackages.map(async (p) => ({ ...p, images: await resolveImages(ctx, p.imageIds) })),
  );
  return { ...drug, imageUrl, packages };
}

// Puts drugs that have package forms first; the original order is kept within each group
export function packagesFirst<T extends { packages: unknown[] }>(drugs: T[]): T[] {
  return [...drugs.filter((d) => d.packages.length > 0), ...drugs.filter((d) => d.packages.length === 0)];
}

// Removes a drug with its package forms and pictures. The stock log keeps its copied details.
export async function deleteDrug(ctx: MutationCtx, drug: Doc<"drugs">) {
  const packages = await getPackages(ctx, drug._id);
  for (const p of packages) await ctx.db.delete("drugPackages", p._id);
  await deleteFiles(ctx, filesOf(drug, packages));
  await ctx.db.delete("drugs", drug._id);
}

export async function deleteFiles(ctx: MutationCtx, ids: Id<"_storage">[]) {
  for (const id of ids) {
    const meta = await ctx.db.system.get("_storage", id);
    if (meta) await ctx.storage.delete(id);
  }
}
