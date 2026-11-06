// Label sizes the HPRT D35BT can print. Width is across the roll, height is along it.
// Layout numbers are in "base" units: the 40mm design is 320 units wide, and bigger
// labels are drawn at a scale so the same 320-unit design fills their width.

export type LabelSizeId = "40x60" | "52x110";

export type LabelSize = {
  id: LabelSizeId;
  name: string;
  widthMm: number;
  heightMm: number;
  // Where the fill record ends and the canister face ends, in base units
  topEnd: number;
  middleEnd: number;
  // Photo box on the canister face, in base units
  photoW: number;
  photoH: number;
  photoAcross: number;
  // QR code sizes on the canister face and the small tag
  faceQr: number;
  tagQr: number;
};

export const DOTS_PER_MM = 8;
export const BASE_WIDTH = 320;

export const LABEL_SIZES: Record<LabelSizeId, LabelSize> = {
  "40x60": {
    id: "40x60",
    name: "40 × 60 mm",
    widthMm: 40,
    heightMm: 60,
    topEnd: 125,
    middleEnd: 365,
    photoW: 100,
    photoH: 80,
    photoAcross: 58,
    faceQr: 78,
    tagQr: 72,
  },
  "52x110": {
    id: "52x110",
    name: "52 × 110 mm",
    widthMm: 52,
    heightMm: 110,
    topEnd: 160,
    middleEnd: 520,
    photoW: 170,
    photoH: 120,
    photoAcross: 20,
    faceQr: 110,
    tagQr: 105,
  },
};

export const DEFAULT_LABEL_SIZE: LabelSizeId = "40x60";

export function isLabelSizeId(value: unknown): value is LabelSizeId {
  return typeof value === "string" && value in LABEL_SIZES;
}

// Printer dots for a size (8 dots per mm at 203 dpi)
export function labelDots(size: LabelSize): { width: number; height: number } {
  return {
    width: size.widthMm * DOTS_PER_MM,
    height: size.heightMm * DOTS_PER_MM,
  };
}

// Scale from base units to printer dots, and the label length in base units
export function labelScale(size: LabelSize): { scale: number; length: number } {
  const { width, height } = labelDots(size);
  const scale = width / BASE_WIDTH;
  return { scale, length: height / scale };
}

const STORAGE_KEY = "acp-label-size";

// The chosen size is remembered on this device, since each printer has its own roll
export function loadLabelSize(): LabelSizeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLabelSizeId(saved) ? saved : DEFAULT_LABEL_SIZE;
  } catch {
    return DEFAULT_LABEL_SIZE;
  }
}

export function saveLabelSize(id: LabelSizeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode: the choice just isn't remembered
  }
}

// Portrait prints the label as designed; landscape turns it a quarter turn clockwise
export type LabelOrientation = "portrait" | "landscape";

export const LABEL_ORIENTATIONS: { id: LabelOrientation; name: string }[] = [
  { id: "portrait", name: "Portrait" },
  { id: "landscape", name: "Landscape" },
];

// The 40x60 roll feeds sideways on the HPRT, so it starts on landscape
export const DEFAULT_ORIENTATION: Record<LabelSizeId, LabelOrientation> = {
  "40x60": "landscape",
  "52x110": "portrait",
};

export function isLabelOrientation(value: unknown): value is LabelOrientation {
  return value === "portrait" || value === "landscape";
}

const orientationKey = (id: LabelSizeId) => `acp-label-orientation-${id}`;

// Remembered per size on this device
export function loadLabelOrientation(id: LabelSizeId): LabelOrientation {
  try {
    const saved = localStorage.getItem(orientationKey(id));
    return isLabelOrientation(saved) ? saved : DEFAULT_ORIENTATION[id];
  } catch {
    return DEFAULT_ORIENTATION[id];
  }
}

export function saveLabelOrientation(
  id: LabelSizeId,
  orientation: LabelOrientation,
): void {
  try {
    localStorage.setItem(orientationKey(id), orientation);
  } catch {
    // Private mode: the choice just isn't remembered
  }
}
