import { addMonths, format, parseISO, subDays } from "date-fns";
import { ConvexError } from "convex/values";

// Canister stock expiring within this many months asks the user to confirm
export const DEFAULT_EXPIRY_WARNING_MONTHS = 1;
export const MAX_EXPIRY_WARNING_MONTHS = 24;

export type ExpiryStatus = "expired" | "soon" | "ok";

const DAY_FORMAT = "yyyy-MM-dd";

// Today's calendar day (YYYY-MM-DD) in the given date's local time zone
export function toCalendarDay(date: Date): string {
  return format(date, DAY_FORMAT);
}

// Last calendar day still counted as "expiring soon"
export function warningUntil(today: string, months: number): string {
  return toCalendarDay(addMonths(parseISO(today), months));
}

// Days are YYYY-MM-DD, so plain string comparison orders them correctly.
// Stock is still usable on its expiry day itself.
export function expiryStatus(
  expiry: string,
  today: string,
  months: number,
): ExpiryStatus {
  if (expiry < today) return "expired";
  if (months > 0 && expiry <= warningUntil(today, months)) return "soon";
  return "ok";
}

export function cleanExpiryWarningMonths(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_EXPIRY_WARNING_MONTHS
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Enter a whole number of months from 0 to ${MAX_EXPIRY_WARNING_MONTHS}`,
    });
  }
  return value;
}

// The server only knows UTC, while the user picks dates in their own time zone
// (up to a day ahead of UTC), so it allows yesterday's UTC date as well.
export function isExpiredOnServer(expiry: string, now: Date): boolean {
  const earliest = subDays(now, 1).toISOString().slice(0, 10);
  return expiry < earliest;
}
