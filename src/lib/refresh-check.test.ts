import { describe, expect, it } from "vitest";
import {
  builtScripts,
  isNewVersion,
  refreshReasonAt,
  type RefreshCheckInput,
} from "./refresh-check.ts";

const NOW = 10_000_000;
const base: RefreshCheckInput = {
  now: NOW,
  lastTick: NOW - 5_000,
  lastActivity: NOW - 1_000,
  idleTimeoutMinutes: 0,
  disconnectedSince: null,
};

describe("refreshReasonAt", () => {
  it("asks nothing while in use and connected", () => {
    expect(refreshReasonAt(base)).toBeNull();
  });

  it("never times out when the idle setting is off", () => {
    expect(refreshReasonAt({ ...base, lastActivity: 0 })).toBeNull();
  });

  it("times out after the set idle minutes, not before", () => {
    const idle = { ...base, idleTimeoutMinutes: 30 };
    expect(
      refreshReasonAt({ ...idle, lastActivity: NOW - 29 * 60_000 }),
    ).toBeNull();
    expect(refreshReasonAt({ ...idle, lastActivity: NOW - 30 * 60_000 })).toBe(
      "idle",
    );
  });

  it("ignores short connection blips but not a lasting drop", () => {
    expect(
      refreshReasonAt({ ...base, disconnectedSince: NOW - 10_000 }),
    ).toBeNull();
    expect(refreshReasonAt({ ...base, disconnectedSince: NOW - 60_000 })).toBe(
      "connection",
    );
  });

  it("treats a long timer gap (device asleep) as a dropped connection", () => {
    expect(refreshReasonAt({ ...base, lastTick: NOW - 10 * 60_000 })).toBe(
      "connection",
    );
  });
});

describe("version check", () => {
  const page = (src: string) =>
    new DOMParser().parseFromString(
      `<html><head><script type="module" crossorigin src="${src}"></script></head></html>`,
      "text/html",
    );

  it("reads only built files", () => {
    expect(builtScripts(page("/assets/index-abc.js"))).toEqual([
      "/assets/index-abc.js",
    ]);
    expect(builtScripts(page("/src/main.tsx"))).toEqual([]);
  });

  it("spots a new publish and ignores the same or missing files", () => {
    expect(isNewVersion(["/assets/a.js"], ["/assets/b.js"])).toBe(true);
    expect(isNewVersion(["/assets/a.js"], ["/assets/a.js"])).toBe(false);
    expect(isNewVersion([], ["/assets/b.js"])).toBe(false);
    expect(isNewVersion(["/assets/a.js"], [])).toBe(false);
  });
});
