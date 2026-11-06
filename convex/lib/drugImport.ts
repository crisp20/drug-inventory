// Shared by backend and frontend: turns spreadsheet rows (same columns as the
// pharmacy system export) into drugs with package forms, and compares them to
// what is already saved.
import { BASE_UNITS, normalizeBarcode, toStoredBarcode, type BaseUnit } from "./barcode";
import { MAX_PACKAGES_PER_DRUG } from "./drugs";

export const MAX_IMPORT_BATCH = 50;

export type ImportPackage = {
  barcode: string;
  qtyPerUnit: number;
  baseUnit: BaseUnit;
  unitCount: number;
};

export type ImportDrug = {
  drugId: string;
  name: string;
  brandName: string;
  manufacturer: string;
  pieceName: string;
  dosageForm: string;
  // Free text from the file. Undefined means "leave the saved text alone"
  // (column not in the file, or the admin chose to keep the saved text).
  specifications?: string;
  remarks?: string;
  // Look Alike, Sound Alike mark from the file. Undefined = leave the saved mark alone.
  lasa?: boolean;
  // Dangerous Drug (DDA) mark from the file. Undefined = leave the saved mark alone.
  dda?: boolean;
  // First spreadsheet row of this drug (1 = header row)
  row: number;
  packages: ImportPackage[];
};

export type NoteKey = "specifications" | "remarks";

export const NOTE_FIELDS: ReadonlyArray<{ key: NoteKey; label: string; aliases: string[] }> = [
  { key: "specifications", label: "Specifications", aliases: ["specifications", "specification", "specs", "spec"] },
  { key: "remarks", label: "Remarks", aliases: ["remarks", "remark", "notes", "note", "comments", "comment"] },
];

// Optional Yes/No column for the Look Alike, Sound Alike mark
export const LASA_COLUMN = "lasa";
const LASA_ALIASES = ["lasa", "lookalikesoundalike", "lookalike", "soundalike", "lookalikesoundalikelasa"];

// Optional Yes/No column for the Dangerous Drug (DDA) mark
export const DDA_COLUMN = "dda";
const DDA_ALIASES = ["dda", "dangerousdrug", "dangerousdrugs", "dangerousdrugdda"];

const OPTIONAL_COLUMNS: ReadonlyArray<{ key: string; aliases: string[] }> = [
  ...NOTE_FIELDS,
  { key: LASA_COLUMN, aliases: LASA_ALIASES },
  { key: DDA_COLUMN, aliases: DDA_ALIASES },
];

export type ImportProblem = { row: number; drugId: string; name: string; message: string };

export type SheetRecord = { row: number; values: Record<string, string> };

// Header names after normalizing (lower case, no spaces/underscores)
export const COLUMNS = {
  drugId: "drugid",
  name: "printoutname",
  brandName: "brandname",
  manufacturer: "manufacturer",
  dosageForm: "dosageform",
  barcode: "barcode",
  form: "form",
  per: "per",
  amount: "amount",
} as const;

const REQUIRED = Object.values(COLUMNS);

// Drops spaces and punctuation so "Look Alike, Sound Alike" and "look_alike" both match
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
}

// First row is the header. When a header appears twice, the first column wins.
export function sheetToRecords(rows: unknown[][]): { records: SheetRecord[]; missingColumns: string[] } {
  const [header = [], ...body] = rows;
  const columnIndex = new Map<string, number>();
  header.forEach((h, i) => {
    const key = normalizeHeader(cellText(h));
    if (key && !columnIndex.has(key)) columnIndex.set(key, i);
  });
  // Optional columns: accept common header variations, stored under the canonical key
  for (const col of OPTIONAL_COLUMNS) {
    const found = col.aliases.find((a) => columnIndex.has(a));
    if (found !== undefined && !columnIndex.has(col.key)) columnIndex.set(col.key, columnIndex.get(found) ?? 0);
  }
  const missingColumns = REQUIRED.filter((c) => !columnIndex.has(c));
  const records: SheetRecord[] = [];
  body.forEach((cells, i) => {
    if (cells.every((c) => cellText(c) === "")) return;
    const values: Record<string, string> = {};
    for (const [key, idx] of columnIndex) values[key] = cellText(cells[idx]);
    records.push({ row: i + 2, values });
  });
  return { records, missingColumns };
}

function dosageFormOf(r: SheetRecord): string {
  return r.values[COLUMNS.dosageForm].toUpperCase();
}

// Each dosage form in the file with how many distinct drugs use it
export function listDosageForms(records: SheetRecord[]): { form: string; drugs: number }[] {
  const byForm = new Map<string, Set<string>>();
  for (const r of records) {
    const form = dosageFormOf(r) || "(BLANK)";
    const ids = byForm.get(form) ?? new Set<string>();
    ids.add(r.values[COLUMNS.drugId]);
    byForm.set(form, ids);
  }
  return [...byForm.entries()]
    .map(([form, ids]) => ({ form, drugs: ids.size }))
    .sort((a, b) => b.drugs - a.drugs);
}

export function toBaseUnit(raw: string): BaseUnit | null {
  const v = raw.trim().toLowerCase();
  if (v === "bot" || v === "btl") return "Bottle";
  return BASE_UNITS.find((u) => u.toLowerCase() === v) ?? null;
}

function positiveInt(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Identifies "the same package form" across file and app: barcode if present, else the form itself
export function packageMatchKey(p: ImportPackage): string {
  return p.barcode.trim()
    ? `bc:${normalizeBarcode(p.barcode)}`
    : `form:${p.qtyPerUnit}/${p.baseUnit}x${p.unitCount}`;
}

function sameForm(a: ImportPackage, b: ImportPackage) {
  return a.qtyPerUnit === b.qtyPerUnit && a.baseUnit === b.baseUnit && a.unitCount === b.unitCount;
}

function cleanManufacturer(raw: string) {
  return /^-+$/.test(raw) ? "" : raw;
}

// First non-blank value across a drug's rows; "" when the column exists but is empty, undefined when absent
function noteOf(rows: SheetRecord[], key: NoteKey): string | undefined {
  if (!(key in rows[0].values)) return undefined;
  return rows.map((r) => r.values[key] ?? "").find((v) => v !== "") ?? "";
}

// "Yes"/"No" and common variations. null = not readable.
export function parseYesNo(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (["yes", "y", "true", "1", "x"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return null;
}

// First non-blank Yes/No cell of a mark column across a drug's rows. Blank or absent = leave alone.
function markOf(
  rows: SheetRecord[],
  column: string,
  label: string,
  report: (row: number, message: string) => void,
): boolean | undefined {
  const r = rows.find((x) => (x.values[column] ?? "") !== "");
  if (!r) return undefined;
  const value = parseYesNo(r.values[column]);
  if (value === null) {
    report(r.row, `${label} value "${r.values[column]}" is not Yes or No, mark left unchanged`);
    return undefined;
  }
  return value;
}

// Which drugs to import: with at least one barcode/package form, without any, or both
export type PackageFilter = "with" | "without" | "both";

export const PACKAGE_FILTERS: ReadonlyArray<{ value: PackageFilter; label: string }> = [
  { value: "with", label: "With barcode or package form" },
  { value: "without", label: "Without barcode or package form" },
  { value: "both", label: "Both" },
];

function keepDrug(filter: PackageFilter, hasPackages: boolean) {
  return filter === "both" || (filter === "with") === hasPackages;
}

// Groups rows by Drug ID, keeps only the chosen dosage forms and the chosen package filter.
// `leftOut` counts drugs dropped by the package filter.
export function buildImportDrugs(records: SheetRecord[], forms: string[], filter: PackageFilter = "with") {
  const wanted = new Set(forms.map((f) => f.toUpperCase()));
  const problems: ImportProblem[] = [];
  const grouped = new Map<string, SheetRecord[]>();
  for (const r of records) {
    if (!wanted.has(dosageFormOf(r) || "(BLANK)")) continue;
    const id = r.values[COLUMNS.drugId];
    if (!id) {
      problems.push({ row: r.row, drugId: "", name: r.values[COLUMNS.name], message: "Missing Drug ID, row skipped" });
      continue;
    }
    const list = grouped.get(id) ?? [];
    list.push(r);
    grouped.set(id, list);
  }

  const drugs: ImportDrug[] = [];
  let leftOut = 0;
  for (const [drugId, rows] of grouped) {
    const first = rows[0];
    const name = first.values[COLUMNS.name];
    const report = (row: number, message: string) => problems.push({ row, drugId, name, message });
    if (!name) {
      report(first.row, "Missing drug name, drug skipped");
      continue;
    }
    const packages = new Map<string, ImportPackage>();
    for (const r of rows) {
      const formRaw = r.values[COLUMNS.form];
      const rawBarcode = r.values[COLUMNS.barcode];
      if (!formRaw && !rawBarcode) continue; // Drug row with no package form
      const baseUnit = toBaseUnit(formRaw);
      const qtyPerUnit = positiveInt(r.values[COLUMNS.per]);
      const unitCount = positiveInt(r.values[COLUMNS.amount]);
      if (!baseUnit || !qtyPerUnit || !unitCount) {
        report(r.row, `Package form "${r.values[COLUMNS.per]}/${formRaw} x${r.values[COLUMNS.amount]}" could not be read, skipped`);
        continue;
      }
      const pkg: ImportPackage = { barcode: toStoredBarcode(rawBarcode), qtyPerUnit, baseUnit, unitCount };
      const key = packageMatchKey(pkg);
      const seen = packages.get(key);
      if (seen) {
        // GS1 and plain versions of the same barcode collapse into one package form
        if (!sameForm(seen, pkg)) report(r.row, `Barcode ${pkg.barcode} is listed with two different package forms, first one kept`);
        continue;
      }
      if (packages.size >= MAX_PACKAGES_PER_DRUG) {
        report(r.row, `More than ${MAX_PACKAGES_PER_DRUG} package forms, extra ones skipped`);
        continue;
      }
      packages.set(key, pkg);
    }
    if (!keepDrug(filter, packages.size > 0)) {
      leftOut += 1;
      continue;
    }
    drugs.push({
      drugId,
      name,
      brandName: first.values[COLUMNS.brandName],
      manufacturer: cleanManufacturer(first.values[COLUMNS.manufacturer]),
      pieceName: dosageFormOf(first) || "PIECE",
      dosageForm: dosageFormOf(first),
      specifications: noteOf(rows, "specifications"),
      remarks: noteOf(rows, "remarks"),
      lasa: markOf(rows, LASA_COLUMN, "Look Alike, Sound Alike", report),
      dda: markOf(rows, DDA_COLUMN, "Dangerous Drug (DDA)", report),
      row: first.row,
      packages: [...packages.values()],
    });
  }
  return { drugs, problems, leftOut };
}

// How many drugs in the chosen forms have / lack a package form, for the choice on the import screen
export function countPackageKinds(records: SheetRecord[], forms: string[]) {
  const { drugs } = buildImportDrugs(records, forms, "both");
  const withPackages = drugs.filter((d) => d.packages.length > 0).length;
  return { with: withPackages, without: drugs.length - withPackages };
}

export type ExistingDrug = {
  name: string;
  brandName: string;
  manufacturer: string;
  pieceName: string;
  specifications?: string;
  remarks?: string;
  lasa?: boolean;
  dda?: boolean;
  packages: ImportPackage[];
};

export const DIFF_FIELDS = [
  { key: "name", label: "Drug name" },
  { key: "brandName", label: "Brand name" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "pieceName", label: "Pieces are called" },
] as const;

export type FieldChange = { label: string; current: string; file: string };

// A Specifications/Remarks difference. `auto` = nothing saved yet, so the file's text is filled in without asking.
export type NoteChange = FieldChange & { key: NoteKey; auto: boolean };

function diffNotes(file: ImportDrug, current: ExistingDrug): NoteChange[] {
  const changes: NoteChange[] = [];
  for (const { key, label } of NOTE_FIELDS) {
    const fromFile = file[key];
    if (fromFile === undefined) continue; // Column not in the file
    const saved = (current[key] ?? "").trim();
    const incoming = fromFile.trim();
    if (saved === incoming) continue;
    changes.push({ key, label, current: saved, file: incoming, auto: saved === "" });
  }
  return changes;
}

// A Look Alike, Sound Alike difference. Marking (file says Yes) only adds a safety warning, so it is
// applied without asking (`auto`). Unmarking also removes the drug's look-alike links, so it is asked.
export type LasaChange = { current: boolean; file: boolean; auto: boolean };

function diffLasaMark(file: ImportDrug, current: ExistingDrug): LasaChange | null {
  if (file.lasa === undefined || file.lasa === !!current.lasa) return null;
  return { current: !!current.lasa, file: file.lasa, auto: file.lasa };
}

// A Dangerous Drug (DDA) difference. Marking is applied without asking; unmarking is asked,
// because it takes the DDA warning off the drug.
export type DdaChange = LasaChange;

function diffDdaMark(file: ImportDrug, current: ExistingDrug): DdaChange | null {
  if (file.dda === undefined || file.dda === !!current.dda) return null;
  return { current: !!current.dda, file: file.dda, auto: file.dda };
}

// What "Use file" would change. Package forms only in the app are always kept.
export function diffDrug(file: ImportDrug, current: ExistingDrug) {
  const fields: FieldChange[] = DIFF_FIELDS.filter(
    (f) => file[f.key].trim() !== current[f.key].trim(),
  ).map((f) => ({ label: f.label, current: current[f.key], file: file[f.key] }));
  const notes = diffNotes(file, current);
  const byKey = new Map(current.packages.map((p) => [packageMatchKey(p), p]));
  const added: ImportPackage[] = [];
  const changed: { current: ImportPackage; file: ImportPackage }[] = [];
  for (const p of file.packages) {
    const match = byKey.get(packageMatchKey(p));
    if (!match) added.push(p);
    else if (!sameForm(match, p)) changed.push({ current: match, file: p });
  }
  const detailChanges = fields.length + added.length + changed.length > 0;
  const lasa = diffLasaMark(file, current);
  const dda = diffDdaMark(file, current);
  const askMark = (m: LasaChange | null) => m !== null && !m.auto;
  return {
    fields,
    added,
    changed,
    notes,
    lasa,
    dda,
    // Name/brand/manufacturer/pieces or package forms differ (decided with "Keep current"/"Use file")
    detailChanges,
    // Anything the admin must decide on; auto-filled notes and new marks need no decision
    needsReview: detailChanges || notes.some((n) => !n.auto) || askMark(lasa) || askMark(dda),
    hasChanges: detailChanges || notes.length > 0 || lasa !== null || dda !== null,
  };
}
