import {
  MAX_LABEL_COPIES,
  stockInTags,
  type StockInLabelData,
} from "./stock-in-label.ts";

// Numbered boxes on one Medicine Bag Label (5 across, 3 down)
export const BAG_COLUMNS = 5;
export const BAG_ROWS = 3;
export const BAG_SLOTS = BAG_COLUMNS * BAG_ROWS;

export type BagRange = { start: number; end: number };

// One Medicine Bag Label per 15 packages received, always numbered from 1:
// 16 gives 1-15 and 16. Capped like the other labels so a typo can't use up a roll.
export function bagLabelRanges(quantity: number): BagRange[] {
  const total = Math.max(1, Math.floor(quantity) || 1);
  const count = Math.min(MAX_LABEL_COPIES, Math.ceil(total / BAG_SLOTS));
  return Array.from({ length: count }, (_, i) => ({
    start: i * BAG_SLOTS + 1,
    end: Math.min(total, (i + 1) * BAG_SLOTS),
  }));
}

// "1–15" or "16", the numbers on one label
export function describeBagRange(r: BagRange): string {
  return r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`;
}

// "1–15, 16" for showing which numbers each label carries
export function describeBagRanges(ranges: BagRange[]): string {
  return ranges.map(describeBagRange).join(", ");
}

// "DDA,8" beside the package icon, like the sample's "DDA,OS"
export function bagTagText(
  data: Pick<StockInLabelData, "dangerousDrug" | "eight">,
): string {
  return stockInTags(data).join(",");
}

// QR text, following the old system's bag label:
// "<Drug ID>;<Resident ID>;<Start time>;<Package form>;<Resident ID>,<DDA>_<Initials><*>"
// e.g. old "12670;19794;2026/08/05;60/Box x1;19794,DDA,OS_HS".
// Resident ID and start time aren't in the app yet, so they are left blank;
// the * (8 box) follows the initials, as on the Medicine Label.
export function bagQrText(
  data: Pick<
    StockInLabelData,
    "drugId" | "packageForm" | "dangerousDrug" | "initials" | "eight"
  >,
): string {
  const residentId = "";
  const startTime = "";
  // Blank parts are skipped so there's no stray comma until Resident ID is added
  const marks = [residentId, data.dangerousDrug ? "DDA" : ""]
    .filter(Boolean)
    .join(",");
  return [
    data.drugId,
    residentId,
    startTime,
    data.packageForm,
    `${marks}_${data.initials}${data.eight ? "*" : ""}`,
  ].join(";");
}
