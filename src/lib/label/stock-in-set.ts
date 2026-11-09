import {
  LABEL_SIZES,
  type LabelOrientation,
  type LabelSizeId,
} from "./label-sizes.ts";
import { orientCanvas } from "./print-label.ts";
import { renderBagLabels } from "./render-bag.ts";
import { renderStockInLabel } from "./render-stock-in.ts";
import { markPreprinted } from "./sheet.ts";
import type { BagRange } from "./bag-label.ts";
import type { StockInLabelData } from "./stock-in-label.ts";

// Which Stock In label types to print
export type StockInLabelChoice = { medicine: boolean; bag: boolean };

// The labels ready to print (turned for the direction), plus their previews
export type DrawnStockInLabels = {
  medicine: HTMLCanvasElement | null;
  bags: HTMLCanvasElement[];
  previews: { medicine: string | null; bags: string[] };
};

// Draws the Medicine Label and/or one Medicine Bag Label per number range
export async function drawStockInLabels(
  data: StockInLabelData,
  choice: StockInLabelChoice,
  ranges: BagRange[],
  sizeId: LabelSizeId,
  orientation: LabelOrientation,
): Promise<DrawnStockInLabels> {
  const size = LABEL_SIZES[sizeId];
  const [medicine, bags] = await Promise.all([
    choice.medicine ? renderStockInLabel(data, size) : Promise.resolve(null),
    choice.bag ? renderBagLabels(data, size, ranges) : Promise.resolve([]),
  ]);
  // The preview also outlines the pre-printed logo strip; the print never does
  const preview = (c: HTMLCanvasElement) =>
    orientCanvas(markPreprinted(c, size), orientation).toDataURL("image/png");
  return {
    medicine: medicine && orientCanvas(medicine, orientation),
    bags: bags.map((c) => orientCanvas(c, orientation)),
    previews: {
      medicine: medicine && preview(medicine),
      bags: bags.map(preview),
    },
  };
}
