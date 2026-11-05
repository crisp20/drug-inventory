import type { ImportDrug, NoteKey } from "@/convex/lib/drugImport.ts";
import type { ReviewItem } from "../_hooks/use-drug-import.ts";

export type Choice = "keep" | "file";

// Per drug: one choice for the main details, and one per Specifications/Remarks conflict
export type DrugChoices = { details: Choice; notes: Partial<Record<NoteKey, Choice>> };

export const DEFAULT_CHOICES: DrugChoices = { details: "keep", notes: {} };

export type ImportItem = { drug: ImportDrug; action: "create" | "update" | "notes" };

// Turns a reviewed existing drug into what is sent to the import, or null when nothing changes.
// Blank notes in the app are always filled from the file; other note conflicts follow the choice.
export function itemFor(item: ReviewItem, choices: DrugChoices): ImportItem | null {
  const diff = item.check.diff;
  if (!diff) return null;
  const drug: ImportDrug = { ...item.drug, specifications: undefined, remarks: undefined };
  let notesChanged = false;
  for (const n of diff.notes) {
    if (n.auto || (choices.notes[n.key] ?? "keep") === "file") {
      drug[n.key] = n.file;
      notesChanged = true;
    }
  }
  if (diff.detailChanges && choices.details === "file") return { drug, action: "update" };
  return notesChanged ? { drug, action: "notes" } : null;
}

export function allChoices(item: ReviewItem, c: Choice): DrugChoices {
  const notes = Object.fromEntries((item.check.diff?.notes ?? []).filter((n) => !n.auto).map((n) => [n.key, c]));
  return { details: c, notes };
}

// True when at least one thing in this drug will take the file's value
export function usesFile(item: ReviewItem, choices: DrugChoices): boolean {
  const diff = item.check.diff;
  if (!diff) return false;
  return (
    (diff.detailChanges && choices.details === "file") ||
    diff.notes.some((n) => !n.auto && choices.notes[n.key] === "file")
  );
}
