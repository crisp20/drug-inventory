import { ConvexError } from "convex/values";
import { MAX_MOVEMENT_QUANTITY } from "./stock";

export const DEFAULT_LARGE_QUANTITY_THRESHOLD = 100;

// Validates the admin-chosen "ask to confirm at or above" amount
export function cleanLargeQuantityThreshold(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_MOVEMENT_QUANTITY) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Enter a whole number from 1 to ${MAX_MOVEMENT_QUANTITY.toLocaleString()}`,
    });
  }
  return value;
}

// Minutes without use before the app asks for a refresh. 0 = off (only a dropped
// connection or a new version asks then).
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 0;
export const MAX_IDLE_TIMEOUT_MINUTES = 24 * 60;

export function cleanIdleTimeoutMinutes(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_IDLE_TIMEOUT_MINUTES
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Enter a whole number of minutes from 0 to ${MAX_IDLE_TIMEOUT_MINUTES}`,
    });
  }
  return value;
}

// True when a Stock In / Stock Out quantity needs a second confirmation
export function needsLargeQuantityConfirm(
  quantity: number,
  threshold: number,
): boolean {
  return quantity >= threshold;
}
