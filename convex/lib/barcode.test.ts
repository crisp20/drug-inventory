import { describe, expect, it } from "vitest";
import {
  barcodesMatch,
  extractGtin,
  formatPackageForm,
  normalizeBarcode,
  toHalfWidth,
  toStoredBarcode,
} from "./barcode";

describe("normalizeBarcode", () => {
  it("pads EAN-13 to GTIN-14 so it matches the GS1 form", () => {
    expect(normalizeBarcode("9312345678907")).toBe("09312345678907");
  });

  it("extracts GTIN from bracketed GS1 strings", () => {
    expect(normalizeBarcode("(01)09312345678907(17)261231(10)AB12")).toBe(
      "09312345678907",
    );
  });

  it("extracts GTIN from raw GS1 DataMatrix with symbology prefix and separators", () => {
    expect(extractGtin("]d201093123456789071726123110AB12\u001d21XYZ")).toBe(
      "09312345678907",
    );
  });

  it("keeps non-numeric codes, uppercased and trimmed", () => {
    expect(normalizeBarcode("  abc-123 ")).toBe("ABC-123");
  });

  it("reads wide digits and brackets typed by a Chinese keyboard", () => {
    expect(normalizeBarcode("（０１）０９３１２３４５６７８９０７")).toBe(
      "09312345678907",
    );
    expect(toHalfWidth("ＡＢ１２。")).toBe("AB12.");
  });
});

describe("barcodesMatch", () => {
  it("matches the plain barcode against its GS1 scan", () => {
    expect(barcodesMatch("9312345678907", "(01)09312345678907(17)261231")).toBe(
      true,
    );
  });

  it("rejects different codes and empty scans", () => {
    expect(barcodesMatch("9312345678907", "9312345678914")).toBe(false);
    expect(barcodesMatch("", "")).toBe(false);
  });
});

describe("toStoredBarcode", () => {
  it("stores the GTIN (as printed EAN-13) when a GS1 code is entered", () => {
    expect(toStoredBarcode("(01)09312345678907(17)261231(10)AB12")).toBe(
      "9312345678907",
    );
    expect(
      toStoredBarcode("]d201093123456789071726123110AB12\u001d21XYZ"),
    ).toBe("9312345678907");
    expect(toStoredBarcode("0109312345678907")).toBe("9312345678907");
  });

  it("keeps a full GTIN-14 that does not start with 0", () => {
    expect(toStoredBarcode("0119312345678904172612")).toBe("19312345678904");
  });

  it("leaves plain barcodes and non-GS1 strings untouched", () => {
    expect(toStoredBarcode(" 4897042582313 ")).toBe("4897042582313");
    expect(toStoredBarcode("1727043010LC82683")).toBe("1727043010LC82683");
  });
});

describe("formatPackageForm", () => {
  it("formats qty/unit x count", () => {
    expect(
      formatPackageForm({ qtyPerUnit: 10, baseUnit: "Strip", unitCount: 10 }),
    ).toBe("10/Strip x10");
  });
});
