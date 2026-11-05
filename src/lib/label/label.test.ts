import { describe, expect, it } from "vitest";
import { buildCpclJob, ditherToMono, packRows } from "./bitmap.ts";
import {
  canisterTypeLabel,
  fillDateCode,
  formatLabelDate,
  initialsOf,
} from "./label-data.ts";

describe("label text", () => {
  it("turns names into initials", () => {
    expect(initialsOf("Hubert Suen")).toBe("HS");
    expect(initialsOf("Mary Ann Lee")).toBe("ML");
    expect(initialsOf("hubert@activecaregroup.com")).toBe("HU");
    expect(initialsOf(undefined)).toBe("");
  });

  it("writes the fill date as YYMMDD in local time", () => {
    expect(fillDateCode(new Date(2026, 10, 3))).toBe("261103");
    expect(fillDateCode(new Date(2030, 0, 9))).toBe("300109");
  });

  it("names canister types and formats dates", () => {
    expect(canisterTypeLabel(1)).toBe("1");
    expect(canisterTypeLabel(0.5)).toBe("Half");
    expect(canisterTypeLabel(0.33)).toBe("Third");
    expect(canisterTypeLabel(0.25)).toBe("Quarter");
    expect(formatLabelDate("2028-09-09")).toBe("2028/09/09");
  });
});

describe("printer image", () => {
  it("prints dark pixels black and light pixels white", () => {
    const mono = ditherToMono(Float32Array.from([0, 255, 10, 250]), 2, 2);
    expect([...mono]).toEqual([1, 0, 1, 0]);
  });

  it("packs 8 pixels per byte, left pixel first, padding the row", () => {
    const mono = new Uint8Array(10);
    mono[0] = 1;
    mono[9] = 1;
    const { bytesPerRow, data } = packRows(mono, 10, 1);
    expect(bytesPerRow).toBe(2);
    expect([...data]).toEqual([0x80, 0x40]);
  });

  it("wraps the picture in a one-label CPCL job", () => {
    const job = buildCpclJob(new Uint8Array(16 * 2), 16, 2);
    const text = new TextDecoder().decode(job);
    expect(text.startsWith("! 0 200 200 2 1\r\n")).toBe(true);
    expect(text).toContain("CG 2 2 0 0 ");
    expect(text.endsWith("FORM\r\nPRINT\r\n")).toBe(true);
  });
});
