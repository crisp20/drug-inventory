// Barcode scanners act like a very fast keyboard. When a Chinese input method
// (Pinyin, Cangjie, Sucheng...) is on, it swallows or changes those keystrokes.
// KeyboardEvent.code always reports the physical key, so we rebuild what the
// scanner actually typed (US layout, which is what scanners emulate).

// Keys from a scanner arrive a few ms apart; people type ~100ms+ apart
export const SCAN_MAX_GAP_MS = 50;
// Shortest real barcode (EAN-8) is 8 characters; 6 keeps a safety margin
export const SCAN_MIN_KEYS = 6;
// Silence after the last key that means the scan is finished. Generous because
// scanners can pause mid-code (e.g. at the GS1 separator), especially with a
// Chinese keyboard on; ending early sends half a code and the rest spills elsewhere.
export const SCAN_END_MS = 300;

const DIGIT_SHIFTED = ")!@#$%^&*(";
const SYMBOLS: Record<string, [string, string]> = {
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
  Backquote: ["`", "~"],
  Space: [" ", " "],
};
const NUMPAD: Record<string, string> = {
  NumpadDecimal: ".",
  NumpadSubtract: "-",
  NumpadAdd: "+",
  NumpadMultiply: "*",
  NumpadDivide: "/",
};
const MODIFIERS = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
]);
// GS1 group separator; many scanners send it as Ctrl+]
const GS1_SEPARATOR = String.fromCharCode(29);

export function isModifierCode(code: string): boolean {
  return MODIFIERS.has(code);
}

type Mods = { shift: boolean; ctrl: boolean; capsLock: boolean };

// Character a US keyboard would type for this physical key, or null if it's not a typing key
export function keyFromCode(
  code: string,
  { shift, ctrl, capsLock }: Mods,
): string | null {
  if (ctrl) return code === "BracketRight" ? GS1_SEPARATOR : null;
  const letter = code.match(/^Key([A-Z])$/);
  if (letter) return shift !== capsLock ? letter[1] : letter[1].toLowerCase();
  const digit = code.match(/^Digit(\d)$/);
  if (digit) return shift ? DIGIT_SHIFTED[Number(digit[1])] : digit[1];
  const pad = code.match(/^Numpad(\d)$/);
  if (pad) return pad[1];
  if (code in NUMPAD) return NUMPAD[code];
  const sym = SYMBOLS[code];
  return sym ? sym[shift ? 1 : 0] : null;
}

export type Burst = {
  // Text in the box before the burst started
  prefix: string;
  chars: string[];
  lastAt: number;
  // A key arrived whose physical position the browser didn't report
  incomplete: boolean;
};

// Adds one keystroke; a long pause starts a new burst
export function addKey(
  burst: Burst | null,
  char: string | null,
  now: number,
  value: string,
): Burst {
  // Once a burst is clearly a scanner, a mid-code pause doesn't split it
  const maxGap =
    burst && burst.chars.length >= SCAN_MIN_KEYS
      ? SCAN_END_MS
      : SCAN_MAX_GAP_MS;
  const current =
    burst && now - burst.lastAt <= maxGap
      ? burst
      : { prefix: value, chars: [], lastAt: now, incomplete: false };
  return char === null
    ? { ...current, lastAt: now, incomplete: true }
    : { ...current, chars: [...current.chars, char], lastAt: now };
}

// The rebuilt text if the burst was fast and long enough to be a scanner
export function scanResult(
  burst: Burst | null,
): { text: string; incomplete: boolean } | null {
  if (!burst || burst.chars.length < SCAN_MIN_KEYS) return null;
  return {
    text: burst.prefix + burst.chars.join(""),
    incomplete: burst.incomplete,
  };
}

// Chinese, wide or other non-keyboard characters left in a barcode mean the scan went wrong
export function hasNonAscii(text: string): boolean {
  // Allow printable keyboard characters plus the GS1 separator (code 29)
  return [...text].some((c) => {
    const n = c.charCodeAt(0);
    return n !== 29 && (n < 0x20 || n > 0x7e);
  });
}
