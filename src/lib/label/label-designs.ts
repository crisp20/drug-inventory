import type { LabelData } from "./label-data.ts";
import type { LabelSizeId } from "./label-sizes.ts";

// "full": fill record, canister face and tag (the original ACP label)
// "compact": one panel with the canister QR code (Drug ID, batch, expiry, quantity, type)
export type LabelDesignId = "full" | "compact";

export const LABEL_DESIGNS: { id: LabelDesignId; name: string }[] = [
  { id: "compact", name: "Canister QR" },
  { id: "full", name: "Full label" },
];

export const DEFAULT_DESIGN: Record<LabelSizeId, LabelDesignId> = {
  "40x60": "compact",
  "52x110": "full",
};

export function isLabelDesignId(value: unknown): value is LabelDesignId {
  return value === "full" || value === "compact";
}

const designKey = (id: LabelSizeId) => `acp-label-design-${id}`;

// Remembered per size on this device
export function loadLabelDesign(id: LabelSizeId): LabelDesignId {
  try {
    const saved = localStorage.getItem(designKey(id));
    return isLabelDesignId(saved) ? saved : DEFAULT_DESIGN[id];
  } catch {
    return DEFAULT_DESIGN[id];
  }
}

export function saveLabelDesign(id: LabelSizeId, design: LabelDesignId): void {
  try {
    localStorage.setItem(designKey(id), design);
  } catch {
    // Private mode: the choice just isn't remembered
  }
}

// Canister machine QR text, matching the ACP samples:
// ";<Drug ID>;<Batch>;<Expiry YYYY/MM/DD>;<Quantity>;<Type>", e.g. ";8223;345397;2027/11/30;720;1"
export function canisterQrText(
  data: Pick<
    LabelData,
    "drugId" | "batch" | "expiry" | "canisterQty" | "canisterType"
  >,
): string {
  return [
    "",
    data.drugId,
    data.batch,
    data.expiry.replaceAll("-", "/"),
    String(data.canisterQty),
    String(data.canisterType),
  ].join(";");
}
