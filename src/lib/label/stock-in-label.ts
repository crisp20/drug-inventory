import { formatPackageForm, type BaseUnit } from "@/convex/lib/barcode.ts";
import { initialsOf } from "@/convex/lib/initials.ts";

// Most labels sent in one go, so a mistyped count can't use up a roll
export const MAX_LABEL_COPIES = 100;

// Everything printed on a Stock In label (for package forms without a barcode)
export type StockInLabelData = {
  drugId: string;
  brandName: string;
  name: string;
  // e.g. "100/Box x1"
  packageForm: string;
  // Picks the package icon (Box, Bottle, Strip or Bag)
  baseUnit: BaseUnit;
  // From the medicine's DDA mark
  dangerousDrug: boolean;
  // The "8" box ticked at Stock In
  eight: boolean;
  // e.g. "HS"
  initials: string;
  // Printed only when entered at Stock In
  batch?: string;
  // YYYY-MM-DD
  expiry?: string;
  imageUrl: string | null;
};

// QR text, matching the ACP samples: "<Drug ID>;<Package form>;<DDA>_<Initials><*>"
// e.g. "13103;100/Box x1;DDA_HS" or "5467;28/Box x1;_HS*" (the * means the 8 box)
export function stockInQrText(
  data: Pick<
    StockInLabelData,
    "drugId" | "packageForm" | "dangerousDrug" | "initials" | "eight"
  >,
): string {
  const marks = `${data.dangerousDrug ? "DDA" : ""}_${data.initials}${data.eight ? "*" : ""}`;
  return [data.drugId, data.packageForm, marks].join(";");
}

// Boxes printed beside the QR code, top to bottom
export function stockInTags(
  data: Pick<StockInLabelData, "dangerousDrug" | "eight">,
): string[] {
  return [data.dangerousDrug && "DDA", data.eight && "8"].filter(
    (t): t is string => Boolean(t),
  );
}

// Labels to print by default: one per package received, up to the limit
export function defaultLabelCopies(quantity: number): number {
  return Math.min(MAX_LABEL_COPIES, Math.max(0, Math.floor(quantity)));
}

// The saved parts of a Stock In that a reprinted label needs
export type StockInReprintSource = {
  drugCode: string;
  brandName: string;
  drugName: string;
  qtyPerUnit: number;
  baseUnit: BaseUnit;
  unitCount: number;
  userName: string;
  userInitials?: string;
  eight?: boolean;
  batch?: string;
  expiry?: string;
};

type LabelledMovement = {
  kind: "in" | "out";
  barcode: string;
  canister?: unknown;
  labels?: boolean;
  bagLabels?: boolean;
  undo?: unknown;
};

// Stock Ins that got the Medicine Label: package forms without a barcode
// always do, others only when it was chosen
export function hadMedicineLabel(m: LabelledMovement): boolean {
  return (
    m.kind === "in" && !m.canister && (!m.barcode.trim() || m.labels === true)
  );
}

// Entries that have a label to reprint: canister Stock Outs, and Stock Ins
// that got the Medicine Label or the Medicine Bag Label
export function hasReprintableLabel(m: LabelledMovement): boolean {
  if (m.undo) return false;
  if (m.canister) return true;
  return hadMedicineLabel(m) || (m.kind === "in" && m.bagLabels === true);
}

// Rebuilds an earlier Stock In label with the original initials and 8 mark.
// `dangerousDrug` is the medicine's current DDA mark (it isn't saved on the entry).
export function stockInLabelFromMovement(
  m: StockInReprintSource,
  imageUrl: string | null,
  dangerousDrug: boolean,
): StockInLabelData {
  return {
    drugId: m.drugCode,
    brandName: m.brandName,
    name: m.drugName,
    packageForm: formatPackageForm(m),
    baseUnit: m.baseUnit,
    dangerousDrug,
    eight: m.eight === true,
    initials: m.userInitials || initialsOf(m.userName),
    batch: m.batch,
    expiry: m.expiry,
    imageUrl,
  };
}
