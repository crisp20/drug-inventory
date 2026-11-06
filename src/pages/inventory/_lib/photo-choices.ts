import type { PhotoMatch } from "../_hooks/use-photo-import.ts";

// Splits matched photos into new pictures and replacements of a current picture
export function splitMatches(matched: PhotoMatch[]) {
  return {
    adding: matched.filter((m) => !m.hasPhoto),
    replacing: matched.filter((m) => m.hasPhoto),
  };
}

// Photos to upload: every new picture, plus replacements the admin did not choose to keep
export function photosToUpload(matched: PhotoMatch[], keep: ReadonlySet<string>): PhotoMatch[] {
  return matched.filter((m) => !m.hasPhoto || !keep.has(m.drugId));
}

// Bulk choice: keep or replace the ticked Drug IDs, or every replacement when none are ticked
export function applyKeepChoice(
  keep: ReadonlySet<string>,
  replacing: PhotoMatch[],
  selected: ReadonlySet<string>,
  choice: "keep" | "file",
): Set<string> {
  const targets = selected.size > 0 ? replacing.filter((m) => selected.has(m.drugId)) : replacing;
  const next = new Set(keep);
  for (const m of targets) {
    if (choice === "keep") next.add(m.drugId);
    else next.delete(m.drugId);
  }
  return next;
}
