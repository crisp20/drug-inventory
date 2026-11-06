import {
  canisterTypeLabel,
  formatLabelDate,
  type LabelData,
} from "./label-data.ts";
import {
  boxedText,
  drawPhotoInBox,
  drawQr,
  fitText,
  loadPhoto,
  toPrintedDots,
  type Ctx,
} from "./draw.ts";
import { renderCompactLabel } from "./render-compact.ts";
import type { LabelDesignId } from "./label-designs.ts";
import {
  BASE_WIDTH,
  labelDots,
  labelScale,
  type LabelSize,
} from "./label-sizes.ts";

// The full design is laid out in base units (the 40mm label is 320 wide) and scaled up
// for bigger labels, so both sizes share one design.
const MARGIN = 14;

type Layout = {
  size: LabelSize;
  scale: number;
  // Label length in base units
  length: number;
};

// Draws a section turned a quarter turn, so its text runs up the label.
// Inside `draw`, (0,0) is the reading top-left and the area is `length` wide.
function rotatedSection(
  ctx: Ctx,
  start: number,
  end: number,
  draw: (length: number) => void,
) {
  ctx.save();
  ctx.translate(0, end);
  ctx.rotate(-Math.PI / 2);
  draw(end - start);
  ctx.restore();
}

function drawFillRecord(ctx: Ctx, layout: Layout, data: LabelData) {
  const { topEnd } = layout.size;
  rotatedSection(ctx, 0, topEnd, (length) => {
    const left = 10;
    const width = length - 20;
    fitText(ctx, `B:${data.batch}`, left, 24, width, 22, true);
    fitText(
      ctx,
      `E:${formatLabelDate(data.expiry)}`,
      left,
      54,
      width,
      22,
      true,
    );
    // Fill | initials | date, then Chk with a space for the checker
    const top = 74;
    const rowH = 22;
    const cols = [left, left + 34, left + 64, left + width];
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
    ctx.strokeRect(left, top, width, rowH * 2);
    ctx.beginPath();
    ctx.moveTo(left, top + rowH);
    ctx.lineTo(left + width, top + rowH);
    ctx.moveTo(cols[1], top);
    ctx.lineTo(cols[1], top + rowH * 2);
    ctx.moveTo(cols[2], top);
    ctx.lineTo(cols[2], top + rowH);
    ctx.stroke();
    const cell = (text: string, from: number, to: number, row: number) =>
      fitText(
        ctx,
        text,
        from + 3,
        top + rowH * row + rowH / 2 + 1,
        to - from - 6,
        15,
        false,
        9,
      );
    cell("Fill", cols[0], cols[1], 0);
    cell(data.filledBy, cols[1], cols[2], 0);
    cell(data.fillDate, cols[2], cols[3], 0);
    cell("Chk", cols[0], cols[1], 1);
  });
  const qr = Math.min(120, topEnd - 30);
  drawQr(ctx, layout.scale, data.qrText, 296 - qr, (topEnd - qr) / 2, qr);
}

function drawCanisterFace(
  ctx: Ctx,
  layout: Layout,
  data: LabelData,
  photo: HTMLCanvasElement | null,
) {
  const { topEnd, middleEnd, photoW, photoH, photoAcross, faceQr } =
    layout.size;
  rotatedSection(ctx, topEnd, middleEnd, (length) => {
    const left = 8;
    const width = length - 16;
    // Photo at the far end; the QR code is drawn upright after this section
    if (photo) {
      drawPhotoInBox(
        ctx,
        photo,
        length - 8 - photoW,
        photoAcross,
        photoW,
        photoH,
      );
    }
    fitText(ctx, data.brandName || data.name, left, 160, width, 22, true);
    fitText(ctx, data.name, left, 188, width, 19);
    boxedText(ctx, data.drugId, left, 216, 26, 19);
    // Canister type dot, printed grey so it dithers like the sample
    ctx.fillStyle = "#9a9a9a";
    ctx.beginPath();
    ctx.arc(150, 216, 13, 0, Math.PI * 2);
    ctx.fill();
    fitText(
      ctx,
      canisterTypeLabel(data.canisterType),
      170,
      216,
      length - 178,
      19,
      true,
    );
    fitText(ctx, `B:${data.batch}`, left, 256, width / 2 - 6, 19, true);
    fitText(
      ctx,
      `E:${formatLabelDate(data.expiry)}`,
      length / 2,
      256,
      width / 2,
      19,
      true,
    );
  });
  drawQr(
    ctx,
    layout.scale,
    data.qrText,
    photoAcross,
    middleEnd - faceQr - 4,
    faceQr,
  );
}

function drawTag(ctx: Ctx, layout: Layout, data: LabelData) {
  const { middleEnd, tagQr } = layout.size;
  const mid = (middleEnd + layout.length) / 2;
  const qrX = BASE_WIDTH - MARGIN - tagQr;
  const textW = qrX - MARGIN - 8;
  fitText(ctx, data.name, MARGIN, mid - 20, textW, 19);
  const boxW = boxedText(ctx, data.drugId, MARGIN, mid + 16, 26, 18);
  fitText(
    ctx,
    formatLabelDate(data.expiry),
    MARGIN + boxW + 6,
    mid + 16,
    textW - boxW - 6,
    18,
    true,
    11,
  );
  drawQr(ctx, layout.scale, data.qrText, qrX, mid - tagQr / 2, tagQr);
}

function divider(ctx: Ctx, y: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(MARGIN, y - 1, BASE_WIDTH - MARGIN * 2, 2);
}

// The full ACP canister label: fill record, canister face and tag
async function renderFullLabel(
  data: LabelData,
  size: LabelSize,
): Promise<HTMLCanvasElement> {
  const dots = labelDots(size);
  const canvas = document.createElement("canvas");
  canvas.width = dots.width;
  canvas.height = dots.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  const photo = data.imageUrl ? await loadPhoto(data.imageUrl) : null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, dots.width, dots.height);
  const layout: Layout = { size, ...labelScale(size) };
  ctx.scale(layout.scale, layout.scale);
  drawFillRecord(ctx, layout, data);
  divider(ctx, size.topEnd);
  drawCanisterFace(ctx, layout, data, photo);
  divider(ctx, size.middleEnd);
  drawTag(ctx, layout, data);
  toPrintedDots(ctx, dots.width, dots.height);
  return canvas;
}

// Draws the label at printer resolution in its upright (portrait) form;
// orientCanvas turns it for landscape printing
export async function renderLabel(
  data: LabelData,
  size: LabelSize,
  design: LabelDesignId = "full",
): Promise<HTMLCanvasElement> {
  return design === "compact"
    ? renderCompactLabel(data, size)
    : renderFullLabel(data, size);
}
