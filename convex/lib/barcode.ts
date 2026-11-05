// Shared by backend and frontend: turns any scanned/typed code into a lookup key.
// GS1 strings (e.g. "(01)09312345678907(17)261231" or "0109312345678907...")
// are reduced to their GTIN; numeric GTIN-8/12/13/14 are padded to 14 digits
// so the same product matches regardless of which format was scanned.

const SYMBOLOGY_PREFIX = /^\][A-Za-z]\d/;
// GS1 group separator (ASCII 29) inserted between variable-length fields
const GS1_SEPARATOR = new RegExp(String.fromCharCode(29), "g");

// Chinese input methods type wide digits/brackets (０１２（）) and "。" for ".";
// turn them back into normal keyboard characters.
export function toHalfWidth(text: string): string {
  return text
    .replace(/[\uFF01-\uFF5E]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/\u3000/g, " ")
    .replace(/\u3002/g, ".");
}

function cleanCode(raw: string): string {
  return toHalfWidth(raw)
    .trim()
    .replace(SYMBOLOGY_PREFIX, "")
    .replace(GS1_SEPARATOR, "");
}

export function extractGtin(raw: string): string | null {
  const code = cleanCode(raw);
  const bracketed = code.match(/\(01\)\s*(\d{14})/);
  if (bracketed) return bracketed[1];
  if (/^01\d{14}/.test(code) && code.length > 14) return code.slice(2, 16);
  if (/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code))
    return code.padStart(14, "0");
  return null;
}

export function normalizeBarcode(raw: string): string {
  return extractGtin(raw) ?? toHalfWidth(raw).trim().toUpperCase();
}

// True for GS1 element strings that carry extra data (expiry, batch...) after the GTIN
export function isGs1String(raw: string): boolean {
  const code = cleanCode(raw);
  return (
    /\(01\)\s*\d{14}/.test(code) ||
    (/^01\d{14}/.test(code) && code.length >= 16)
  );
}

// What we save as the package form's barcode. GS1 codes are reduced to their GTIN,
// shown as the 13-digit EAN printed on the box when the GTIN-14 starts with 0.
// Plain barcodes are kept exactly as scanned.
export function toStoredBarcode(raw: string): string {
  const trimmed = toHalfWidth(raw).trim();
  if (!isGs1String(trimmed)) return trimmed;
  const gtin = extractGtin(trimmed);
  if (!gtin) return trimmed;
  return gtin.startsWith("0") ? gtin.slice(1) : gtin;
}

// True when two scans refer to the same product (e.g. plain barcode vs GS1 code)
export function barcodesMatch(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  return normalizeBarcode(a) === normalizeBarcode(b);
}

export const BASE_UNITS = ["Strip", "Box", "Bottle", "Bag"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

// Usual number of base units per package: strips come in 10s, others are single (e.g. 20/Box x1)
export function defaultUnitCount(unit: BaseUnit): number {
  return unit === "Strip" ? 10 : 1;
}

export function formatPackageForm(p: {
  qtyPerUnit: number;
  baseUnit: BaseUnit;
  unitCount: number;
}): string {
  return `${p.qtyPerUnit}/${p.baseUnit} x${p.unitCount}`;
}
