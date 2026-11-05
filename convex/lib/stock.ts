import { ConvexError } from "convex/values";

export const MAX_MOVEMENT_QUANTITY = 100_000;
export const MAX_NOTES_LENGTH = 500;
export const MAX_REASON_LENGTH = 60;

// Suggested Stock Out reasons; staff can also type their own
export const STOCK_OUT_REASONS = [
  "Dispensed",
  "Expired",
  "Damaged",
  "Returned to supplier",
  "Transferred",
] as const;
export const DEFAULT_STOCK_OUT_REASON = STOCK_OUT_REASONS[0];

export type MovementKind = "in" | "out";

// Package form always comes from the saved barcode; staff only enter these
export type MovementInput = { quantity: number; notes: string };

function bad(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

// Validates a stock movement entered by a user. Returns trimmed values.
export function cleanMovementInput(input: MovementInput): MovementInput {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0)
    bad("Quantity must be a whole number above 0");
  if (input.quantity > MAX_MOVEMENT_QUANTITY) {
    bad(`Quantity can be at most ${MAX_MOVEMENT_QUANTITY.toLocaleString()}`);
  }
  const notes = input.notes.trim();
  if (notes.length > MAX_NOTES_LENGTH)
    bad(`Notes can be at most ${MAX_NOTES_LENGTH} characters`);
  return { ...input, notes };
}

export function cleanReason(reason: string): string {
  const cleaned = reason.trim();
  if (!cleaned) bad("Reason is required");
  if (cleaned.length > MAX_REASON_LENGTH)
    bad(`Reason can be at most ${MAX_REASON_LENGTH} characters`);
  return cleaned;
}

// Suggested reasons when an admin undoes an entry; they can also type their own
export const UNDO_REASONS = [
  "Scanned in error",
  "Wrong quantity",
  "Wrong drug",
  "Duplicate entry",
] as const;

// Stock amount after reversing a movement. Undoing a Stock In cannot take stock below 0.
export function undoneStock(
  current: number,
  kind: MovementKind,
  quantity: number,
): number {
  if (kind === "out") return current + quantity;
  if (quantity > current) {
    bad(
      `Can't undo: only ${current} on hand now, but this entry added ${quantity}`,
    );
  }
  return current - quantity;
}

// New stock amount (in package forms) after a movement. Stock can never go below 0.
export function nextStock(
  current: number,
  kind: MovementKind,
  quantity: number,
): number {
  if (kind === "in") return current + quantity;
  if (quantity > current) {
    bad(`Not enough stock: only ${current} on hand`);
  }
  return current - quantity;
}
