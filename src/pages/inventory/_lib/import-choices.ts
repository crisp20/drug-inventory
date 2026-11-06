import { toStoredBarcode } from "@/convex/lib/barcode.ts";
import type { ImportDrug, NoteKey } from "@/convex/lib/drugImport.ts";
import type { ReviewItem } from "../_hooks/use-drug-import.ts";

export type Choice = "keep" | "file";

// Per drug: one choice for the main details, one per Specifications/Remarks conflict,
// and one each for unmarking Look Alike, Sound Alike and Dangerous Drug (DDA)
export type DrugChoices = {
  details: Choice;
  notes: Partial<Record<NoteKey, Choice>>;
  lasa?: Choice;
  dda?: Choice;
};

export const DEFAULT_CHOICES: DrugChoices = { details: "keep", notes: {} };

export type ImportItem = {
  drug: ImportDrug;
  action: "create" | "update" | "notes";
};

type MarkKey = "lasa" | "dda";
const MARK_KEYS: readonly MarkKey[] = ["lasa", "dda"];

// Turns a reviewed existing drug into what is sent to the import, or null when nothing changes.
// Blank notes in the app and new marks are always taken from the file; other conflicts follow the choice.
export function itemFor(
  item: ReviewItem,
  choices: DrugChoices,
): ImportItem | null {
  const diff = item.check.diff;
  if (!diff) return null;
  const drug: ImportDrug = {
    ...item.drug,
    specifications: undefined,
    remarks: undefined,
    lasa: undefined,
    dda: undefined,
  };
  let notesChanged = false;
  for (const n of diff.notes) {
    if (n.auto || (choices.notes[n.key] ?? "keep") === "file") {
      drug[n.key] = n.file;
      notesChanged = true;
    }
  }
  for (const key of MARK_KEYS) {
    const mark = diff[key];
    if (mark && (mark.auto || choices[key] === "file")) {
      drug[key] = mark.file;
      notesChanged = true;
    }
  }
  if (diff.detailChanges && choices.details === "file")
    return { drug, action: "update" };
  return notesChanged ? { drug, action: "notes" } : null;
}

// Per drug: clashing barcode -> replacement typed by the admin. Missing or blank = add without a barcode.
export type BarcodeFixes = Record<string, string>;

// Swaps clashing barcodes for the admin's replacements. Unfixed clashes are dropped by the server,
// which still adds the package form without a barcode.
export function withBarcodeFixes(
  drug: ImportDrug,
  fixes: BarcodeFixes | undefined,
): ImportDrug {
  if (!fixes) return drug;
  return {
    ...drug,
    packages: drug.packages.map((p) => {
      const fix = fixes[p.barcode]?.trim();
      return fix ? { ...p, barcode: toStoredBarcode(fix) } : p;
    }),
  };
}

export function allChoices(item: ReviewItem, c: Choice): DrugChoices {
  const diff = item.check.diff;
  const notes = Object.fromEntries(
    (diff?.notes ?? []).filter((n) => !n.auto).map((n) => [n.key, c]),
  );
  return {
    details: c,
    notes,
    lasa: diff?.lasa && !diff.lasa.auto ? c : undefined,
    dda: diff?.dda && !diff.dda.auto ? c : undefined,
  };
}

// True when at least one thing in this drug will take the file's value
export function usesFile(item: ReviewItem, choices: DrugChoices): boolean {
  const diff = item.check.diff;
  if (!diff) return false;
  return (
    (diff.detailChanges && choices.details === "file") ||
    diff.notes.some((n) => !n.auto && choices.notes[n.key] === "file") ||
    MARK_KEYS.some((k) => !!diff[k] && !diff[k].auto && choices[k] === "file")
  );
}
