import { describe, expect, it } from "vitest";
import { gs1DateToDay, parseGs1 } from "./gs1";
import { canisterQtyFor, canUseCanister, cleanCanisterInput } from "./canister";

describe("parseGs1", () => {
  it("reads batch and expiry from bracketed codes", () => {
    expect(parseGs1("(01)09312345678907(17)280909(10)50803-3")).toEqual({
      gtin: "09312345678907",
      batch: "50803-3",
      expiry: "2028-09-09",
    });
  });

  it("reads raw DataMatrix codes with group separators", () => {
    expect(
      parseGs1("]d20109312345678907172809091050803-3\u001d21SERIAL1"),
    ).toEqual({
      gtin: "09312345678907",
      batch: "50803-3",
      expiry: "2028-09-09",
    });
  });

  it("handles batch before expiry", () => {
    expect(parseGs1("010931234567890710AB12\u001d17261231")).toMatchObject({
      batch: "AB12",
      expiry: "2026-12-31",
    });
  });

  it("reads codes typed with a Chinese keyboard (full-width)", () => {
    expect(parseGs1("（01）09312345678907（17）280909（10）X1")).toMatchObject({
      batch: "X1",
      expiry: "2028-09-09",
    });
  });

  it("returns null for plain barcodes", () => {
    expect(parseGs1("9312345678907")).toBeNull();
  });

  // Keyboard-mode scanners often drop the invisible separator after the serial
  it("reads serial, batch and expiry when the scanner drops separators", () => {
    expect(
      parseGs1(
        "0104897133761542" + "2110304962804256" + "10RC4304" + "17281130",
      ),
    ).toEqual({
      gtin: "04897133761542",
      batch: "RC4304",
      expiry: "2028-11-30",
    });
  });

  it("treats a typed 029 before a known field as the separator", () => {
    expect(
      parseGs1("0104897133761542211030496280425602910RC430402917281130"),
    ).toEqual({
      gtin: "04897133761542",
      batch: "RC4304",
      expiry: "2028-11-30",
    });
  });

  it("keeps 029 that is really part of the batch", () => {
    expect(parseGs1("010489713376154217281130" + "10AB029")).toMatchObject({
      batch: "AB029",
      expiry: "2028-11-30",
    });
  });

  it("still uses separators when they are sent", () => {
    expect(
      parseGs1(
        "0104897133761542\u001d2110304962804256\u001d10RC4304\u001d17281100",
      ),
    ).toEqual({
      gtin: "04897133761542",
      batch: "RC4304",
      expiry: "2028-11-30",
    });
  });
});

describe("gs1DateToDay", () => {
  it("treats day 00 as the last day of the month", () => {
    expect(gs1DateToDay("280200")).toBe("2028-02-29");
  });
  it("rejects impossible dates", () => {
    expect(gs1DateToDay("281301")).toBeUndefined();
  });
});

describe("canister rules", () => {
  it("calculates tablets from package forms taken out", () => {
    expect(canisterQtyFor(1, { qtyPerUnit: 100, unitCount: 1 })).toBe(100);
    expect(canisterQtyFor(2, { qtyPerUnit: 10, unitCount: 10 })).toBe(200);
  });

  it("is hidden unless rolled out or switched on for the person", () => {
    expect(canUseCanister({}, false)).toBe(false);
    expect(canUseCanister({ canisterAccess: true }, false)).toBe(true);
    expect(canUseCanister({ canisterAccess: false }, true)).toBe(true);
  });

  it("requires batch, valid expiry, qty and a listed type", () => {
    const ok = {
      batch: " B1 ",
      expiry: "2028-09-09",
      quantity: 100,
      type: 0.5,
    };
    expect(cleanCanisterInput(ok).batch).toBe("B1");
    expect(() => cleanCanisterInput({ ...ok, batch: " " })).toThrow();
    expect(() => cleanCanisterInput({ ...ok, expiry: "2028-02-30" })).toThrow();
    expect(() => cleanCanisterInput({ ...ok, quantity: 0 })).toThrow();
    expect(() => cleanCanisterInput({ ...ok, type: 0.4 })).toThrow();
  });
});
