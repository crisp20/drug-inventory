import { describe, expect, it } from "vitest";
import { ALL_TIME, periodRange } from "./movement-period.ts";

// Local noon on 15 Mar 2026
const NOW = new Date(2026, 2, 15, 12, 0, 0);

describe("periodRange", () => {
  it("has no limits for all time", () => {
    expect(periodRange(ALL_TIME, NOW)).toEqual({});
  });

  it("starts at local midnight for today and rolling periods", () => {
    expect(periodRange({ ...ALL_TIME, value: "today" }, NOW).since).toBe(
      new Date(2026, 2, 15).toISOString(),
    );
    // Last 7 days includes today
    expect(periodRange({ ...ALL_TIME, value: "7d" }, NOW).since).toBe(
      new Date(2026, 2, 9).toISOString(),
    );
    expect(periodRange({ ...ALL_TIME, value: "month" }, NOW).since).toBe(
      new Date(2026, 2, 1).toISOString(),
    );
  });

  it("covers whole local days for a custom range", () => {
    const range = periodRange(
      { value: "custom", from: "2026-03-01", to: "2026-03-03" },
      NOW,
    );
    expect(range.since).toBe(new Date(2026, 2, 1).toISOString());
    expect(range.until).toBe(
      new Date(2026, 2, 3, 23, 59, 59, 999).toISOString(),
    );
  });

  it("ignores blank custom dates", () => {
    expect(
      periodRange({ value: "custom", from: "", to: "2026-03-03" }, NOW).since,
    ).toBeUndefined();
  });
});
