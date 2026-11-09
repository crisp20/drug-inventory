import { describe, expect, it } from "vitest";
import { CHANGE_ENTRIES, hasDiff, loadDiff, parseDiff } from "./changes.ts";

describe("change log", () => {
  it("reads every version, newest first, without the generated file lists", () => {
    expect(CHANGE_ENTRIES[0].version).toBe("v82");
    expect(CHANGE_ENTRIES.at(-1)?.version).toBe("v1");
    expect(CHANGE_ENTRIES.some((e) => e.body.includes("<!-- files"))).toBe(
      false,
    );
  });

  it("splits a saved diff into files with highlighted lines", async () => {
    expect(hasDiff("v50")).toBe(true);
    const files = parseDiff(await loadDiff("v50"));
    const settings = files.find((f) => f.path === "convex/schema/settings.ts");
    expect(settings).toMatchObject({ status: "changed", added: 2, removed: 0 });
    expect(
      settings?.lines.some(
        (l) => l.kind === "add" && l.text.includes("idleTimeoutMinutes"),
      ),
    ).toBe(true);
    expect(
      files.find((f) => f.path === "src/lib/refresh-check.ts")?.status,
    ).toBe("new");
  });
});
