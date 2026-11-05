import { describe, expect, it } from "vitest";
import {
  cleanExpiryWarningMonths,
  expiryStatus,
  isExpiredOnServer,
  warningUntil,
} from "./expiry";
import { cleanCanisterInput } from "./canister";

describe("expiryStatus", () => {
  const today = "2026-11-03";
  it("treats dates before today as expired", () => {
    expect(expiryStatus("2026-11-02", today, 1)).toBe("expired");
    expect(expiryStatus("2025-12-04", today, 1)).toBe("expired");
  });
  it("lets stock be used on its expiry day, with a warning", () => {
    expect(expiryStatus("2026-11-03", today, 1)).toBe("soon");
  });
  it("warns within the chosen months, inclusive", () => {
    expect(expiryStatus("2026-12-03", today, 1)).toBe("soon");
    expect(expiryStatus("2026-12-04", today, 1)).toBe("ok");
    expect(expiryStatus("2027-02-01", today, 3)).toBe("soon");
  });
  it("never warns when set to 0, but still blocks expired", () => {
    expect(expiryStatus("2026-11-04", today, 0)).toBe("ok");
    expect(expiryStatus("2026-11-02", today, 0)).toBe("expired");
  });
  it("handles month ends", () => {
    expect(warningUntil("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("expiry rules on the server", () => {
  const now = new Date("2026-11-03T02:00:00Z");
  it("allows a one-day grace for time zones ahead of UTC", () => {
    expect(isExpiredOnServer("2026-11-02", now)).toBe(false);
    expect(isExpiredOnServer("2026-11-01", now)).toBe(true);
  });
  it("refuses expired canister stock", () => {
    expect(() =>
      cleanCanisterInput({
        batch: "B1",
        expiry: "2020-01-01",
        quantity: 10,
        type: 1,
      }),
    ).toThrow(/expired/);
  });
  it("validates the warning months", () => {
    expect(cleanExpiryWarningMonths(0)).toBe(0);
    expect(cleanExpiryWarningMonths(6)).toBe(6);
    for (const bad of [-1, 1.5, 25]) {
      expect(() => cleanExpiryWarningMonths(bad)).toThrow();
    }
  });
});
