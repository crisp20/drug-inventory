import QRCode from "qrcode";
import {
  canisterTypeLabel,
  formatLabelDate,
  type LabelData,
} from "./label-data.ts";

// 203 dpi thermal printer = 8 dots per mm. The label is 40mm across the roll and 60mm long.
export const DOTS_PER_MM = 8;
export const LABEL_WIDTH = 40 * DOTS_PER_MM;
export const LABEL_HEIGHT = 60 * DOTS_PER_MM;

const FONT = "Arial, Helvetica, sans-serif";
// Sections along the label: fill record, canister face, small tag
const TOP_END = 125;
const MIDDLE_END = 365;
const MARGIN = 14;

type Ctx = CanvasRenderingContext2D;

// Loads the photo as a local copy, so the canvas can still be read for printing.
// A photo that can't be loaded is left off rather than stopping the label.
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const objectUrl = URL.createObjectURL(await res.blob());
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

function drawQr(ctx: Ctx, text: string, x: number, y: number, size: number) {
  const qr = QRCode.create(text || " ", { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  // Whole dots per module keeps the code sharp enough to scan
  const cell = Math.max(1, Math.floor(size / count));
  const offset = Math.floor((size - cell * count) / 2);
  ctx.fillStyle = "#000";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c)) {
        ctx.fillRect(x + offset + c * cell, y + offset + r * cell, cell, cell);
      }
    }
  }
}

// Writes text, shrinking the font until it fits the width (never below minSize)
function fitText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  bold = false,
  minSize = 12,
) {
  let s = size;
  ctx.font = `${bold ? "bold " : ""}${s}px ${FONT}`;
  while (s > minSize && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    ctx.font = `${bold ? "bold " : ""}${s}px ${FONT}`;
  }
  let shown = text;
  while (shown.length > 1 && ctx.measureText(shown).width > maxWidth) {
    shown = shown.slice(0, -2) + "…";
  }
  ctx.fillStyle = "#000";
  ctx.textBaseline = "middle";
  ctx.fillText(shown, x, y);
}

function boxedText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  h: number,
  size: number,
) {
  ctx.font = `bold ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + 12;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(x, y - h / 2, w, h);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 6, y + 1);
  return w;
}

// Draws a section turned a quarter turn, so its text runs up the label.
// Inside `draw`, (0,0) is the reading top-left and the area is `length` wide by `across` tall.
function rotatedSection(
  ctx: Ctx,
  start: number,
  end: number,
  draw: (length: number, across: number) => void,
) {
  ctx.save();
  ctx.translate(0, end);
  ctx.rotate(-Math.PI / 2);
  draw(end - start, LABEL_WIDTH);
  ctx.restore();
}

function drawFillRecord(ctx: Ctx, data: LabelData) {
  rotatedSection(ctx, 0, TOP_END, (length) => {
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
  drawQr(ctx, data.qrText, 206, 18, 90);
}

function drawCanisterFace(
  ctx: Ctx,
  data: LabelData,
  photo: HTMLImageElement | null,
) {
  rotatedSection(ctx, TOP_END, MIDDLE_END, (length) => {
    const left = 8;
    const width = length - 16;
    // Photo at the far end; the QR code is drawn upright after this section
    if (photo) {
      const boxW = 100;
      const boxH = 80;
      const scale = Math.min(boxW / photo.width, boxH / photo.height);
      const w = photo.width * scale;
      const h = photo.height * scale;
      ctx.drawImage(
        photo,
        length - 8 - boxW + (boxW - w) / 2,
        58 + (boxH - h) / 2,
        w,
        h,
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
  drawQr(ctx, data.qrText, 56, MIDDLE_END - 82, 78);
}

function drawTag(ctx: Ctx, data: LabelData) {
  const qrSize = 72;
  const qrX = LABEL_WIDTH - MARGIN - qrSize;
  const textW = qrX - MARGIN - 8;
  fitText(ctx, data.name, MARGIN, MIDDLE_END + 34, textW, 19);
  const boxW = boxedText(ctx, data.drugId, MARGIN, MIDDLE_END + 70, 26, 18);
  fitText(
    ctx,
    formatLabelDate(data.expiry),
    MARGIN + boxW + 6,
    MIDDLE_END + 70,
    textW - boxW - 6,
    18,
    true,
    11,
  );
  drawQr(ctx, data.qrText, qrX, MIDDLE_END + 16, qrSize);
}

function divider(ctx: Ctx, y: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(MARGIN, y - 1, LABEL_WIDTH - MARGIN * 2, 2);
}

// Draws the full label on a 320 x 480 dot canvas, matching the ACP canister label layout
export async function renderLabel(data: LabelData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_WIDTH;
  canvas.height = LABEL_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  const photo = data.imageUrl ? await loadImage(data.imageUrl) : null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);
  drawFillRecord(ctx, data);
  divider(ctx, TOP_END);
  drawCanisterFace(ctx, data, photo);
  divider(ctx, MIDDLE_END);
  drawTag(ctx, data);
  return canvas;
}
