import { describe, expect, it } from "vitest";
import {
  boostContrast,
  buildCpclJob,
  ditherToMono,
  packRows,
} from "./bitmap.ts";
import {
  canisterTypeLabel,
  fillDateCode,
  formatLabelDate,
  initialsOf,
  labelFromMovement,
} from "./label-data.ts";
import {
  isLabelOrientation,
  isLabelSizeId,
  LABEL_SIZES,
  labelDots,
  labelScale,
  loadLabelOrientation,
  saveLabelOrientation,
  sheetOffset,
} from "./label-sizes.ts";
import {
  canisterQrText,
  isLabelDesignId,
  loadLabelDesign,
  saveLabelDesign,
} from "./label-designs.ts";
import { markerSweep } from "./render-compact.ts";

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

  it("rebuilds a reprint from the saved fill, keeping the original initials and date", () => {
    const occurredAt = new Date(2026, 10, 3, 14, 30).toISOString();
    const label = labelFromMovement(
      {
        drugCode: "32",
        brandName: "Abilify",
        drugName: "Aripiprazole 5mg",
        userName: "Hubert Suen",
        occurredAt,
        canister: {
          batch: "PW5322",
          expiry: "2028-09-09",
          quantity: 100,
          type: 0.5,
        },
      },
      null,
      true,
    );
    expect(label).toEqual({
      drugId: "32",
      brandName: "Abilify",
      name: "Aripiprazole 5mg",
      batch: "PW5322",
      expiry: "2028-09-09",
      canisterType: 0.5,
      canisterQty: 100,
      dangerousDrug: true,
      filledBy: "HS",
      fillDate: "261103",
      qrText: "32",
      imageUrl: null,
    });
  });
});

describe("Canister QR design", () => {
  it("writes the QR text exactly like the ACP samples", () => {
    const base = { batch: "345397", expiry: "2027-11-30" };
    expect(
      canisterQrText({
        ...base,
        drugId: "8223",
        canisterQty: 720,
        canisterType: 1,
      }),
    ).toBe(";8223;345397;2027/11/30;720;1");
    expect(
      canisterQrText({
        drugId: "620",
        batch: "43979",
        expiry: "2027-11-30",
        canisterQty: 40,
        canisterType: 0.5,
      }),
    ).toBe(";620;43979;2027/11/30;40;0.5");
  });

  it("draws a full circle for type 1 and a matching slice for the others", () => {
    const turn = Math.PI * 2;
    expect(markerSweep(1)).toBeCloseTo(turn);
    expect(markerSweep(0.5)).toBeCloseTo(turn / 2);
    expect(markerSweep(0.33)).toBeCloseTo(turn / 3);
    expect(markerSweep(0.25)).toBeCloseTo(turn / 4);
    expect(markerSweep(0.125)).toBeCloseTo(turn / 8);
  });

  it("starts 40x60 on Canister QR and 52x110 on the full label, remembering each size", () => {
    localStorage.clear();
    expect(loadLabelDesign("40x60")).toBe("compact");
    expect(loadLabelDesign("52x110")).toBe("full");
    saveLabelDesign("52x110", "compact");
    expect(loadLabelDesign("52x110")).toBe("compact");
    expect(loadLabelDesign("40x60")).toBe("compact");
    localStorage.setItem("acp-label-design-40x60", "fancy");
    expect(loadLabelDesign("40x60")).toBe("compact");
    expect(isLabelDesignId("full")).toBe(true);
    localStorage.clear();
  });
});

describe("label sizes", () => {
  it("prints each size at 8 dots per mm, scaled from the 40mm design", () => {
    expect(labelDots(LABEL_SIZES["40x60"])).toEqual({
      width: 320,
      height: 480,
    });
    expect(labelDots(LABEL_SIZES["52x110"])).toEqual({
      width: 416,
      height: 880,
    });
    expect(labelScale(LABEL_SIZES["40x60"])).toEqual({ scale: 1, length: 480 });
    expect(labelScale(LABEL_SIZES["52x110"]).scale).toBeCloseTo(1.3);
  });

  it("places the 40 x 60 design 14 mm from the left, centred, on 54 x 70", () => {
    const size = LABEL_SIZES["54x70"];
    expect(labelDots(size)).toEqual({ width: 432, height: 560 });
    // 13 mm across; (70 - 60) / 2 = 5 mm down
    expect(sheetOffset(size)).toEqual({ x: 104, y: 40 });
    // The design (320 dots wide) leaves 1 mm (8 dots) clear of the far edge
    expect(104 + 320).toBe(432 - 8);
    expect(sheetOffset(LABEL_SIZES["40x60"])).toBeNull();
  });

  it("keeps every section inside the label", () => {
    for (const size of Object.values(LABEL_SIZES)) {
      const { length } = labelScale(size);
      expect(size.topEnd).toBeLessThan(size.middleEnd);
      expect(size.middleEnd).toBeLessThan(length);
    }
  });

  it("only accepts known sizes", () => {
    expect(isLabelSizeId("54x70")).toBe(true);
    expect(isLabelSizeId("52x110")).toBe(true);
    expect(isLabelSizeId("99x99")).toBe(false);
    expect(isLabelSizeId(null)).toBe(false);
  });

  it("starts 40x60 on landscape and 52x110 on portrait, remembering each size", () => {
    localStorage.clear();
    expect(loadLabelOrientation("40x60")).toBe("landscape");
    expect(loadLabelOrientation("52x110")).toBe("portrait");
    saveLabelOrientation("40x60", "portrait");
    expect(loadLabelOrientation("40x60")).toBe("portrait");
    expect(loadLabelOrientation("52x110")).toBe("portrait");
    localStorage.setItem("acp-label-orientation-52x110", "sideways");
    expect(loadLabelOrientation("52x110")).toBe("portrait");
    expect(isLabelOrientation("landscape")).toBe(true);
    expect(isLabelOrientation("upside")).toBe(false);
    localStorage.clear();
  });
});

describe("printer image", () => {
  it("stretches a pale photo so the background is white and the tablet shows", () => {
    // Pale purple background (230) with a pink tablet (200) and a dark mark (90)
    const gray = Float32Array.from([
      ...Array<number>(60).fill(230),
      ...Array<number>(35).fill(200),
      ...Array<number>(5).fill(90),
    ]);
    const out = boostContrast(gray);
    expect(out[0]).toBe(255);
    expect(out[99]).toBe(0);
    // The tablet becomes a clear mid shade, so it dithers into visible dots
    expect(out[70]).toBeGreaterThan(80);
    expect(out[70]).toBeLessThan(180);
    expect(boostContrast(Float32Array.from([120, 120]))[0]).toBe(255);
  });
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
