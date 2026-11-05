import { z } from "zod";
import { BASE_UNITS, defaultUnitCount } from "@/convex/lib/barcode.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const wholeNumber = (min: number, label: string) =>
  z.coerce.number<string | number>().int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`);

export const packageSchema = z.object({
  packageId: z.custom<Id<"drugPackages">>().optional(),
  // Empty when the medicine has no barcode (user confirmed via prompt)
  barcode: z.string().trim(),
  qtyPerUnit: wholeNumber(1, "Quantity"),
  baseUnit: z.enum(BASE_UNITS),
  unitCount: wholeNumber(1, "Units"),
  stock: wholeNumber(0, "Stock"),
  // Packaging pictures for this package form (e.g. blister)
  images: z.array(z.object({ id: z.custom<Id<"_storage">>(), url: z.string().nullable() })),
});

export const drugFormSchema = z.object({
  drugId: z.string().trim().min(1, "Drug ID is required").max(64),
  name: z.string().trim().min(1, "Drug name is required"),
  brandName: z.string().trim(),
  manufacturer: z.string().trim(),
  pieceName: z.string().trim().min(1, "Choose what the pieces are called"),
  packages: z.array(packageSchema).min(1, "Add at least one package form"),
});

export type DrugFormInput = z.input<typeof drugFormSchema>;
export type DrugFormValues = z.output<typeof drugFormSchema>;

export function newPackage(barcode: string): DrugFormInput["packages"][number] {
  return { barcode, qtyPerUnit: 10, baseUnit: "Strip", unitCount: defaultUnitCount("Strip"), stock: 0, images: [] };
}
