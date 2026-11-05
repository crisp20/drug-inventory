// Everything printed on a canister label (60mm x 40mm roll, printed 40mm wide x 60mm long)
export type LabelData = {
  drugId: string;
  brandName: string;
  name: string;
  batch: string;
  // YYYY-MM-DD
  expiry: string;
  canisterType: number;
  // Initials of the person filling, e.g. "HS"
  filledBy: string;
  // YYMMDD, e.g. "261103"
  fillDate: string;
  // Drug ID for now; later a Canister ID from the canister server
  qrText: string;
  imageUrl: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  "1": "1",
  "0.5": "Half",
  "0.33": "Third",
  "0.25": "Quarter",
  "0.125": "Eighth",
};

export function canisterTypeLabel(type: number): string {
  return TYPE_LABELS[String(type)] ?? String(type);
}

// "Hubert Suen" -> "HS"; falls back to the first letters of an email
export function initialsOf(name: string | undefined): string {
  const words = (name ?? "")
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const letters =
    words.length === 1
      ? words[0].slice(0, 2)
      : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

// "2028-09-09" -> "2028/09/09"
export function formatLabelDate(day: string): string {
  return day.replaceAll("-", "/");
}

// Local date as YYMMDD, e.g. 3 Nov 2026 -> "261103"
export function fillDateCode(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}
