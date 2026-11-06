// Everything printed on a canister label (sizes are in label-sizes.ts)
export type LabelData = {
  drugId: string;
  brandName: string;
  name: string;
  batch: string;
  // YYYY-MM-DD
  expiry: string;
  canisterType: number;
  // Tablets/capsules put in the canister
  canisterQty: number;
  // Not collected yet; the Canister QR label leaves room and prints them when given
  residentName?: string;
  ownStock?: boolean;
  // From the medicine's DDA mark
  dangerousDrug?: boolean;
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

// The saved parts of a canister Stock Out that a reprinted label needs
export type ReprintSource = {
  drugCode: string;
  brandName: string;
  drugName: string;
  userName: string;
  // ISO time of the original Stock Out
  occurredAt: string;
  canister: { batch: string; expiry: string; quantity: number; type: number };
};

// Rebuilds the label of an earlier fill: initials and fill date are the original ones.
// `dangerousDrug` is the medicine's current DDA mark (it isn't saved on the entry).
export function labelFromMovement(
  m: ReprintSource,
  imageUrl: string | null,
  dangerousDrug = false,
): LabelData {
  return {
    drugId: m.drugCode,
    brandName: m.brandName,
    name: m.drugName,
    batch: m.canister.batch,
    expiry: m.canister.expiry,
    canisterType: m.canister.type,
    canisterQty: m.canister.quantity,
    filledBy: initialsOf(m.userName),
    fillDate: fillDateCode(new Date(m.occurredAt)),
    qrText: m.drugCode,
    imageUrl,
    dangerousDrug,
  };
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
