import type { LabelOrientation, LabelSizeId } from "./label-sizes.ts";

// Preview boxes keep each label's shape in either direction
export const PREVIEW_CLASS: Record<
  LabelSizeId,
  Record<LabelOrientation, string>
> = {
  "40x60": {
    portrait: "h-[300px] w-[200px]",
    landscape: "h-[200px] w-[300px]",
  },
  "52x110": {
    portrait: "h-[330px] w-[156px]",
    landscape: "h-[156px] w-[330px]",
  },
  "54x70": {
    portrait: "h-[300px] w-[231px]",
    landscape: "h-[231px] w-[300px]",
  },
};

export const TOGGLE_ITEM_CLASS =
  "cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";
