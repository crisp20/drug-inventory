// Reads batch/lot and expiry out of a GS1 code printed on medicine boxes,
// e.g. "(01)09312345678907(17)280909(10)50803-3" or the raw DataMatrix form
// "0109312345678907172809091050803-3".

const GS = String.fromCharCode(29);

// Application identifiers with a fixed data length (digits after the AI)
const FIXED: Record<string, number> = {
  "00": 18,
  "01": 14,
  "02": 14,
  "11": 6,
  "12": 6,
  "13": 6,
  "15": 6,
  "16": 6,
  "17": 6,
  "20": 2,
};
// Variable-length AIs that can appear on pharma packs (ended by GS or end of code),
// with their maximum data length
const VARIABLE: Record<string, number> = {
  "10": 20,
  "21": 20,
  "22": 20,
  "30": 8,
  "37": 8,
  "90": 30,
  "91": 90,
  "92": 90,
  "240": 30,
  "241": 30,
  "242": 6,
  "710": 20,
  "711": 20,
  "712": 20,
  "713": 20,
  "714": 20,
};
const DATE_AIS = new Set(["11", "12", "13", "15", "16", "17"]);
// Fields that usually follow one another on medicine boxes
const COMMON = new Set(["01", "10", "11", "17", "21"]);
// The separator's Alt code, as some scanners type it on a Mac
const TYPED_GS = "029";

export type Gs1Data = { gtin?: string; batch?: string; expiry?: string };

function toHalfWidth(text: string): string {
  return text.replace(/[\uFF01-\uFF5E]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

// GS1 YYMMDD (DD may be 00 = end of month) → YYYY-MM-DD
export function gs1DateToDay(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const year = 2000 + Number(yymmdd.slice(0, 2));
  const month = Number(yymmdd.slice(2, 4));
  let day = Number(yymmdd.slice(4, 6));
  if (month < 1 || month > 12) return undefined;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day === 0) day = lastDay;
  if (day > lastDay) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseBracketed(code: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const m of code.matchAll(/\((\d{2,4})\)([^(]*)/g)) {
    fields[m[1]] = m[2].replace(new RegExp(GS, "g"), "").trim();
  }
  return fields;
}

function validFixed(ai: string, value: string): boolean {
  if (value.length !== FIXED[ai] || !/^\d+$/.test(value)) return false;
  return !DATE_AIS.has(ai) || gs1DateToDay(value) !== undefined;
}

// Many keyboard-mode scanners drop the invisible GS separator, so a variable
// field (like the serial number) has no marked end. When that happens we try
// each possible end and keep the one that lets the rest of the code read cleanly.
function parseRaw(code: string): Record<string, string> {
  const failed = new Set<number>();

  // Some scanners type the separator as the digits "029" (its Alt code)
  // instead of the invisible character. Only treat it as one before a known field.
  const typedSeparatorAt = (i: number) =>
    code.startsWith(TYPED_GS, i) &&
    COMMON.has(code.slice(i + TYPED_GS.length, i + TYPED_GS.length + 2));

  // Try ends marked by a typed "029" first, then the end of the code and ends
  // followed by a common medicine-box field, then everything else
  const candidateEnds = (start: number, limit: number): number[] => {
    const all = Array.from({ length: limit - start }, (_, k) => start + 1 + k);
    const marked = all.filter(typedSeparatorAt);
    const likely = all.filter(
      (end) =>
        !marked.includes(end) &&
        (end === code.length || COMMON.has(code.slice(end, end + 2))),
    );
    const first = [...marked, ...likely];
    return [...first, ...all.filter((end) => !first.includes(end))];
  };

  const solve = (i: number): Record<string, string> | null => {
    if (i >= code.length) return {};
    if (failed.has(i)) return null;
    if (code[i] === GS) return solve(i + 1);
    const result =
      (typedSeparatorAt(i) ? solve(i + TYPED_GS.length) : null) ??
      solveField(i);
    if (!result) failed.add(i);
    return result;
  };

  const solveField = (i: number): Record<string, string> | null => {
    const ai2 = code.slice(i, i + 2);
    if (FIXED[ai2] !== undefined) {
      const value = code.slice(i + 2, i + 2 + FIXED[ai2]);
      if (!validFixed(ai2, value)) return null;
      const rest = solve(i + 2 + FIXED[ai2]);
      return rest && { ...rest, [ai2]: value };
    }
    const ai =
      VARIABLE[ai2] !== undefined
        ? ai2
        : VARIABLE[code.slice(i, i + 3)] !== undefined
          ? code.slice(i, i + 3)
          : null;
    if (!ai) return null; // Unknown data
    const start = i + ai.length;
    const limit = Math.min(start + VARIABLE[ai], code.length);
    const gs = code.indexOf(GS, start);
    // A separator in range marks the end for sure
    if (gs !== -1 && gs <= limit) {
      if (gs === start) return null;
      const rest = solve(gs + 1);
      return rest && { ...rest, [ai]: code.slice(start, gs) };
    }
    for (const end of candidateEnds(start, limit)) {
      const rest = solve(end);
      if (rest) return { ...rest, [ai]: code.slice(start, end) };
    }
    return null;
  };

  return solve(0) ?? {};
}

export function parseGs1(raw: string): Gs1Data | null {
  const code = toHalfWidth(raw)
    .trim()
    .replace(/^\][A-Za-z]\d/, "");
  const bracketed = code.includes("(");
  if (!(bracketed ? /\(01\)\d{14}/.test(code) : /^01\d{14}./.test(code)))
    return null;
  const fields = bracketed ? parseBracketed(code) : parseRaw(code);
  const batch = fields["10"]?.trim();
  return {
    gtin: fields["01"],
    batch: batch || undefined,
    expiry: fields["17"] ? gs1DateToDay(fields["17"]) : undefined,
  };
}
