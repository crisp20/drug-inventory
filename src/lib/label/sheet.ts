import { FONT } from "./draw.ts";
import {
  LABEL_SIZES,
  labelDots,
  sheetOffset,
  type LabelSize,
} from "./label-sizes.ts";

function blankCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  return { canvas, ctx };
}

// Draws the label upright (portrait). Sheet labels (54 x 70) get the smaller
// design placed beside the pre-printed strip, which is left blank.
export async function renderOnSheet(
  size: LabelSize,
  render: (size: LabelSize) => Promise<HTMLCanvasElement>,
): Promise<HTMLCanvasElement> {
  const offset = sheetOffset(size);
  if (!size.sheet || !offset) return render(size);
  const inner = await render(LABEL_SIZES[size.sheet.content]);
  const dots = labelDots(size);
  const { canvas, ctx } = blankCanvas(dots.width, dots.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(inner, offset.x, offset.y);
  return canvas;
}

// Preview only: a copy with a dashed outline where the pre-printed ACP strip is,
// so staff can see how the label lines up. Never sent to the printer.
export function markPreprinted(
  canvas: HTMLCanvasElement,
  size: LabelSize,
): HTMLCanvasElement {
  const offset = sheetOffset(size);
  if (!offset) return canvas;
  const { canvas: out, ctx } = blankCanvas(canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);
  const pad = 6;
  ctx.strokeStyle = "#a3a3a3";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(pad, pad, offset.x - pad * 2, out.height - pad * 2);
  // Reads bottom to top, like the strip on the real label
  ctx.save();
  ctx.translate(offset.x / 2, out.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#a3a3a3";
  ctx.font = `20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ACP logo (pre-printed)", 0, 0);
  ctx.restore();
  return out;
}
