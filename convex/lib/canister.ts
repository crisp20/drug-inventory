import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { isExpiredOnServer } from "./expiry";

// Fraction of a tablet per canister slot, like the canister machine's own list
export const CANISTER_TYPES = [1, 0.5, 0.33, 0.25, 0.125] as const;
export const DEFAULT_CANISTER_TYPE = 1;
export const MAX_BATCH_LENGTH = 40;
export const MAX_CANISTER_QTY = 1_000_000;

export type CanisterInput = {
  batch: string;
  expiry: string;
  quantity: number;
  type: number;
};

// Hidden until rolled out: on for everyone, or for people switched on individually
export function canUseCanister(
  user: Pick<Doc<"users">, "canisterAccess"> | null | undefined,
  canisterForEveryone: boolean,
): boolean {
  return canisterForEveryone || user?.canisterAccess === true;
}

// Tablets/capsules going into the canister for this many package forms (e.g. 1 x 100/Box x1 = 100)
export function canisterQtyFor(
  quantity: number,
  pkg: { qtyPerUnit: number; unitCount: number },
): number {
  return quantity * pkg.qtyPerUnit * pkg.unitCount;
}

export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function bad(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

export function cleanCanisterInput(raw: CanisterInput): CanisterInput {
  const batch = raw.batch.trim();
  if (!batch) bad("Enter the batch number");
  if (batch.length > MAX_BATCH_LENGTH)
    bad(`Batch can be at most ${MAX_BATCH_LENGTH} characters`);
  if (!isCalendarDay(raw.expiry)) bad("Enter a valid expiry date");
  if (isExpiredOnServer(raw.expiry, new Date()))
    bad("This stock has expired. Expired stock cannot go into a canister.");
  if (
    !Number.isInteger(raw.quantity) ||
    raw.quantity < 1 ||
    raw.quantity > MAX_CANISTER_QTY
  )
    bad(
      `Canister QTY must be a whole number from 1 to ${MAX_CANISTER_QTY.toLocaleString()}`,
    );
  if (!CANISTER_TYPES.some((t) => t === raw.type))
    bad("Choose a canister type");
  return { batch, expiry: raw.expiry, quantity: raw.quantity, type: raw.type };
}

export function formatCanister(c: CanisterInput): string {
  return `Canister: Batch ${c.batch} · Exp ${c.expiry} · Qty ${c.quantity} · Type ${c.type}`;
}

export type BatchExpiry = { batch?: string; expiry?: string };

// Optional Batch / Expiry on any Stock Out: blanks are dropped, given values are checked
export function cleanBatchExpiry(raw: BatchExpiry): BatchExpiry {
  const batch = raw.batch?.trim() || undefined;
  const expiry = raw.expiry?.trim() || undefined;
  if (batch && batch.length > MAX_BATCH_LENGTH)
    bad(`Batch can be at most ${MAX_BATCH_LENGTH} characters`);
  if (expiry) {
    if (!isCalendarDay(expiry)) bad("Enter a valid expiry date");
    if (isExpiredOnServer(expiry, new Date()))
      bad("This stock has expired and cannot be used.");
  }
  return { batch, expiry };
}

export const MAX_SCANNED_CODE_LENGTH = 200;

// A GS1 code whose product didn't match the package form but was used anyway.
// Hidden separators become " | " so the saved text is readable in the Log and CSV.
export function cleanMismatchedScan(raw?: string): string | undefined {
  const readable = [...(raw ?? "")]
    .map((c) => (c.charCodeAt(0) < 0x20 ? " | " : c))
    .join("");
  const code = readable
    .trim()
    .replace(/^\|\s*|\s*\|$/g, "")
    .replace(/(\s*\|\s*)+/g, " | ");
  if (!code) return undefined;
  if (code.length > MAX_SCANNED_CODE_LENGTH)
    bad(`Scanned code can be at most ${MAX_SCANNED_CODE_LENGTH} characters`);
  return code;
}

export function formatMismatchedScan(code?: string): string {
  return code ? `Scanned code did not match: ${code}` : "";
}

// "Batch X · Exp Y" for entries without a canister (canister text already has both)
export function formatBatchExpiry(m: BatchExpiry): string {
  return [m.batch && `Batch ${m.batch}`, m.expiry && `Exp ${m.expiry}`]
    .filter(Boolean)
    .join(" · ");
}
