import { formatLabelDate } from "./label-data.ts";
import {
  drawPhotoInBox,
  drawQr,
  fitText,
  FONT,
  loadPhoto,
  tagBox,
  wrapLines,
  type Ctx,
} from "./draw.ts";
import { drawLandscape } from "./render-compact.ts";
import { loadPackageIcon } from "./package-icons.ts";
import { renderOnSheet } from "./sheet.ts";
import type { LabelSize } from "./label-sizes.ts";
import {
  stockInQrText,
  stockInTags,
  type StockInLabelData,
} from "./stock-in-label.ts";

// Laid out on the same 480 x 320 landscape grid as the Canister QR label (60 x 40 mm),
// matching the ACP Stock In samples
const LEFT = 10;
const W = 480;

// A medicine box with a capsule on it, like the samples' package icon
function drawPackageIcon(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const lid = h * 0.28;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000";
  ctx.lineJoin = "round";
  ctx.beginPath();
  // Lid, slightly wider at the bottom
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + w - 6, y);
  ctx.lineTo(x + w, y + lid);
  ctx.lineTo(x, y + lid);
  ctx.closePath();
  ctx.rect(x + 2, y + lid, w - 4, h - lid);
  ctx.stroke();
  // Capsule turned at 45 degrees
  const cx = x + w / 2;
  const cy = y + lid + (h - lid) / 2;
  const len = w * 0.42;
  const r = h * 0.12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.arc(-len / 2 + r, 0, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.arc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(len / 2 - r, -r);
  ctx.arc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, r);
  ctx.closePath();
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
}

// Brand name over up to two lines, then the drug name in bold (shared by the
// Medicine Label and the Medicine Bag Label)
export function drawNames(
  ctx: Ctx,
  data: Pick<StockInLabelData, "brandName" | "name">,
) {
  const textW = W - LEFT * 2;
  ctx.font = `26px ${FONT}`;
  const brand = wrapLines(ctx, data.brandName || data.name, textW, 2);
  brand.forEach((line, i) =>
    fitText(ctx, line, LEFT, 36 + i * 34, textW, 26, false, 14),
  );
  const nameY = brand.length > 1 ? 112 : 78;
  fitText(ctx, data.name, LEFT, nameY, textW, 26, true, 14);
}

// Package icon and package form, above the QR code. Uses the chosen form's
// icon; the drawn box is kept for when it can't load
export function drawPackageRow(
  ctx: Ctx,
  data: Pick<StockInLabelData, "packageForm">,
  icon: HTMLCanvasElement | null,
) {
  if (icon) drawPhotoInBox(ctx, icon, 256, 132, 54, 50);
  else drawPackageIcon(ctx, 254, 136, 54, 44);
  fitText(ctx, data.packageForm, 320, 162, W - 320 - 6, 28, true, 14);
}

function drawStockIn(
  ctx: Ctx,
  scale: number,
  data: StockInLabelData,
  photo: HTMLCanvasElement | null,
  icon: HTMLCanvasElement | null,
) {
  drawNames(ctx, data);

  // Batch and expiry, only when entered
  const extras = [
    data.batch && `B:${data.batch}`,
    data.expiry && `E:${formatLabelDate(data.expiry)}`,
  ].filter((t): t is string => Boolean(t));
  extras.forEach((t, i) =>
    fitText(ctx, t, LEFT, 146 + i * 26, 230, 20, true, 11),
  );

  drawPackageRow(ctx, data, icon);

  // Tablet photo
  if (photo) drawPhotoInBox(ctx, photo, 12, 190, 220, 120);

  // DDA and 8 boxes, stacked beside the QR code
  stockInTags(data).forEach((t, i) =>
    tagBox(ctx, t, 254, 194 + i * 46, 60, 40, 28),
  );

  drawQr(ctx, scale, stockInQrText(data), 324, 192, 116);
}

// Draws the Stock In label and returns it upright (portrait), like every design
export async function renderStockInLabel(
  data: StockInLabelData,
  size: LabelSize,
): Promise<HTMLCanvasElement> {
  const [photo, icon] = await Promise.all([
    data.imageUrl ? loadPhoto(data.imageUrl) : Promise.resolve(null),
    loadPackageIcon(data.baseUnit),
  ]);
  return renderOnSheet(size, async (s) =>
    drawLandscape(s, (ctx, scale) =>
      drawStockIn(ctx, scale, data, photo, icon),
    ),
  );
}
