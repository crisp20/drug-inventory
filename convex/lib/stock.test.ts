import { describe, expect, it } from "vitest";
import { cleanMovementInput, cleanReason, nextStock } from "./stock";

describe("cleanReason", () => {
  it("trims and requires a reason", () => {
    expect(cleanReason(" Expired ")).toBe("Expired");
    expect(() => cleanReason("   ")).toThrow(/required/);
    expect(() => cleanReason("x".repeat(61))).toThrow(/at most/);
  });
});

describe("nextStock", () => {
  it("adds on Stock In", () => {
    expect(nextStock(3, "in", 5)).toBe(8);
  });
  it("subtracts on Stock Out and allows reaching zero", () => {
    expect(nextStock(5, "out", 5)).toBe(0);
  });
  it("refuses to go below zero", () => {
    expect(() => nextStock(2, "out", 3)).toThrow(/only 2 on hand/);
  });
});

describe("cleanMovementInput", () => {
  it("trims notes", () => {
    expect(cleanMovementInput({ quantity: 2, notes: "  inv 12 " }).notes).toBe("inv 12");
  });
  it.each([0, -1, 1.5, 100_001])("rejects quantity %s", (quantity) => {
    expect(() => cleanMovementInput({ quantity, notes: "" })).toThrow(/Quantity/);
  });
  it("rejects very long notes", () => {
    expect(() => cleanMovementInput({ quantity: 1, notes: "x".repeat(501) })).toThrow(/Notes/);
  });
});
