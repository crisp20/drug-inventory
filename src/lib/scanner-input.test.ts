import { describe, expect, it } from "vitest";
import {
  addKey,
  hasNonAscii,
  keyFromCode,
  scanResult,
  type Burst,
} from "./scanner-input.ts";

const plain = { shift: false, ctrl: false, capsLock: false };
const shifted = { ...plain, shift: true };

// Feeds physical key codes as a scanner would (fast) and returns the burst
function typeCodes(
  codes: Array<[string, typeof plain]>,
  gapMs: number,
  start: Burst | null = null,
  value = "",
) {
  return codes.reduce<Burst | null>(
    (burst, [code, mods], i) =>
      addKey(burst, keyFromCode(code, mods), 1000 + i * gapMs, value),
    start,
  );
}

describe("keyFromCode", () => {
  it("rebuilds US keys from the physical key, whatever language is on", () => {
    expect(keyFromCode("Digit0", plain)).toBe("0");
    expect(keyFromCode("KeyA", plain)).toBe("a");
    expect(keyFromCode("KeyA", shifted)).toBe("A");
    expect(keyFromCode("Digit9", shifted)).toBe("(");
    expect(keyFromCode("Digit0", shifted)).toBe(")");
    expect(keyFromCode("Numpad7", plain)).toBe("7");
  });

  it("treats Ctrl+] as the GS1 separator and ignores other shortcuts", () => {
    expect(keyFromCode("BracketRight", { ...plain, ctrl: true })).toBe(
      String.fromCharCode(29),
    );
    expect(keyFromCode("KeyC", { ...plain, ctrl: true })).toBeNull();
  });

  it("returns null for editing keys", () => {
    expect(keyFromCode("Backspace", plain)).toBeNull();
    expect(keyFromCode("ArrowLeft", plain)).toBeNull();
  });
});

describe("scan bursts", () => {
  const gs1: Array<[string, typeof plain]> = [
    ["Digit9", shifted],
    ["Digit0", plain],
    ["Digit1", plain],
    ["Digit0", shifted],
    ["Digit0", plain],
    ["Digit9", plain],
    ["Digit3", plain],
    ["KeyL", shifted],
    ["KeyC", shifted],
  ];

  it("rebuilds a fast scan exactly, including letters a Chinese keyboard would swallow", () => {
    expect(scanResult(typeCodes(gs1, 5))).toEqual({
      text: "(01)093LC",
      incomplete: false,
    });
  });

  it("ignores normal-speed typing", () => {
    expect(scanResult(typeCodes(gs1, 150))).toBeNull();
  });

  it("ignores short bursts", () => {
    expect(scanResult(typeCodes(gs1.slice(0, 3), 5))).toBeNull();
  });

  it("keeps text that was already in the box before the scan", () => {
    expect(scanResult(typeCodes(gs1, 5, null, "abc"))?.text).toBe(
      "abc(01)093LC",
    );
  });

  it("keeps one scan together across a mid-code pause (e.g. at the GS1 separator)", () => {
    const first = typeCodes(gs1, 5);
    // 200ms pause, then the rest of the code arrives fast
    const rest = gs1
      .slice(0, 6)
      .reduce<Burst | null>(
        (b, [code, mods], i) =>
          addKey(b, keyFromCode(code, mods), 1240 + i * 5, "ignored"),
        first,
      );
    expect(scanResult(rest)?.text).toBe("(01)093LC(01)09");
  });

  it("still starts fresh after a pause in normal typing", () => {
    const short = typeCodes(gs1.slice(0, 3), 5);
    const next = addKey(short, "7", 1300, "abc");
    expect(next.prefix).toBe("abc");
    expect(next.chars).toEqual(["7"]);
  });

  it("flags keys the browser could not identify", () => {
    const burst = typeCodes(gs1, 5);
    const withUnknown = addKey(burst, null, 1000 + gs1.length * 5, "");
    expect(scanResult(withUnknown)?.incomplete).toBe(true);
  });
});

describe("hasNonAscii", () => {
  it("spots Chinese or wide characters but allows the GS1 separator", () => {
    expect(hasNonAscii("0109312345678907")).toBe(false);
    expect(hasNonAscii(`0109312345678907${String.fromCharCode(29)}21X`)).toBe(
      false,
    );
    expect(hasNonAscii("01093日月")).toBe(true);
    expect(hasNonAscii("０１")).toBe(true);
  });
});
