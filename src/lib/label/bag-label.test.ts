import { describe, expect, it } from "vitest";
import {
  bagLabelRanges,
  bagQrText,
  bagTagText,
  describeBagRanges,
} from "./bag-label.ts";
import { hadMedicineLabel, hasReprintableLabel } from "./stock-in-label.ts";

describe("Medicine Bag Label", () => {
  it("puts 15 numbers on each label, starting at 1", () => {
    expect(bagLabelRanges(16)).toEqual([
      { start: 1, end: 15 },
      { start: 16, end: 16 },
    ]);
    expect(bagLabelRanges(15)).toEqual([{ start: 1, end: 15 }]);
    expect(bagLabelRanges(2)).toEqual([{ start: 1, end: 2 }]);
    expect(bagLabelRanges(31).map((r) => r.end)).toEqual([15, 30, 31]);
  });

  it("always prints at least one label and caps a mistyped quantity", () => {
    expect(bagLabelRanges(0)).toEqual([{ start: 1, end: 1 }]);
    expect(bagLabelRanges(100000)).toHaveLength(100);
  });

  it("describes the numbers on each label", () => {
    expect(describeBagRanges(bagLabelRanges(16))).toBe("1–15, 16");
  });

  it("writes the tags like the sample's DDA,OS", () => {
    expect(bagTagText({ dangerousDrug: true, eight: true })).toBe("DDA,8");
    expect(bagTagText({ dangerousDrug: false, eight: false })).toBe("");
  });

  it("writes the QR text like the old system, with Resident ID and start time blank", () => {
    const base = {
      drugId: "12670",
      packageForm: "60/Box x1",
      initials: "HS",
    };
    expect(bagQrText({ ...base, dangerousDrug: true, eight: false })).toBe(
      "12670;;;60/Box x1;DDA_HS",
    );
    expect(bagQrText({ ...base, dangerousDrug: false, eight: true })).toBe(
      "12670;;;60/Box x1;_HS*",
    );
  });

  it("can reprint a barcoded Stock In that only had bag labels", () => {
    const m = {
      kind: "in" as const,
      barcode: "9312345678907",
      bagLabels: true,
    };
    expect(hasReprintableLabel(m)).toBe(true);
    expect(hadMedicineLabel(m)).toBe(false);
    expect(hadMedicineLabel({ kind: "in", barcode: "" })).toBe(true);
  });
});
