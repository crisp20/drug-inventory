import { formatLabelDate, type LabelData } from "./label-data.ts";
import { canisterQrText } from "./label-designs.ts";
import {
  drawPhotoInBox,
  drawQr,
  fitText,
  FONT,
  loadPhoto,
  rotateAnticlockwise,
  toPrintedDots,
  wrapLines,
  type Ctx,
} from "./draw.ts";
import { labelDots, type LabelSize } from "./label-sizes.ts";

// The Canister QR design is drawn landscape on a 480 x 320 grid (a 60 x 40 mm
// label at 8 dots per mm), matching the ACP samples, then scaled to fit bigger labels.
const W = 480;
const H = 320;
const LEFT = 10;

// Light grey so the type marker dithers to a dotted shape like the sample's blue
const MARKER_GREY = "#9a9a9a";

// Full circle for type 1, a matching slice for halves, thirds, quarters and eighths
export function markerSweep(type: number): number {
  // 0.33 is stored for a third; draw an exact third
  const fraction = Math.abs(type - 0.33) < 0.005 ? 1 / 3 : type;
  return Math.min(1, Math.max(0, fraction)) * Math.PI * 2;
}

function drawTypeMarker(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  type: number,
) {
  const sweep = markerSweep(type);
  ctx.fillStyle = MARKER_GREY;
  ctx.beginPath();
  if (sweep >= Math.PI * 2) {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else {
    // Starts at the top and goes clockwise, so a half is the right half (like the sample)
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + sweep);
    ctx.closePath();
  }
  ctx.fill();
}

// A thin box with centred bold text
function tagBox(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(x, y, w, h);
  ctx.font = `bold ${size}px ${FONT}`;
  let s = size;
  while (s > 10 && ctx.measureText(text).width > w - 8) {
    s -= 1;
    ctx.font = `bold ${s}px ${FONT}`;
  }
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.textAlign = "left";
}

function drawCompact(
  ctx: Ctx,
  scale: number,
  data: LabelData,
  photo: HTMLCanvasElement | null,
) {
  const textW = W - LEFT * 2;
  // Brand name over up to two lines, then the drug name in bold
  ctx.font = `24px ${FONT}`;
  const brand = wrapLines(ctx, data.brandName || data.name, textW, 2);
  brand.forEach((line, i) =>
    fitText(ctx, line, LEFT, 30 + i * 32, textW, 24, false, 14),
  );
  const nameY = brand.length > 1 ? 104 : 72;
  fitText(ctx, data.name, LEFT, nameY, textW, 24, true, 14);

  // Space for the resident's name (printed when given)
  if (data.residentName) {
    fitText(ctx, data.residentName, LEFT + 4, 166, 300, 24, true, 14);
  }

  // Type marker and canister quantity, above the QR code
  drawTypeMarker(ctx, 350, 160, 24, data.canisterType);
  fitText(ctx, String(data.canisterQty), 382, 166, W - 382 - 6, 26, true, 14);

  // Tablet photo, batch and expiry
  const photoBox = { x: 12, y: 196, w: 108, h: 70 };
  if (photo) {
    drawPhotoInBox(ctx, photo, photoBox.x, photoBox.y, photoBox.w, photoBox.h);
  }
  fitText(ctx, `B:${data.batch}`, 128, 210, 126, 20, true, 11);
  fitText(
    ctx,
    `E:${formatLabelDate(data.expiry)}`,
    128,
    255,
    126,
    20,
    true,
    11,
  );

  // Drug ID box under the photo
  tagBox(ctx, data.drugId, 12, 274, 108, 40, 26);

  // OS and DDA boxes (space kept; printed when set)
  const tags = [data.ownStock && "OS", data.dangerousDrug && "DDA"].filter(
    (t): t is string => Boolean(t),
  );
  tags.forEach((t, i) => tagBox(ctx, t, 258, 198 + i * 40, 56, 32, 18));

  // Canister QR code
  drawQr(ctx, scale, canisterQrText(data), 322, 196, 116);
}

// Draws the Canister QR label and returns it upright (portrait), like every design
export async function renderCompactLabel(
  data: LabelData,
  size: LabelSize,
): Promise<HTMLCanvasElement> {
  const dots = labelDots(size);
  // Landscape drawing: the label's length runs across
  const canvas = document.createElement("canvas");
  canvas.width = dots.height;
  canvas.height = dots.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  const photo = data.imageUrl ? await loadPhoto(data.imageUrl) : null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Bigger labels: scale the 60 x 40 design to fit and centre it
  const scale = Math.min(canvas.width / W, canvas.height / H);
  ctx.translate(
    Math.round((canvas.width - W * scale) / 2),
    Math.round((canvas.height - H * scale) / 2),
  );
  ctx.scale(scale, scale);
  drawCompact(ctx, scale, data, photo);
  toPrintedDots(ctx, canvas.width, canvas.height);
  return rotateAnticlockwise(canvas);
}
