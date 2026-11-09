import QRCode from "qrcode";
import { boostContrast, ditherToMono, toGray } from "./bitmap.ts";

// Drawing tools shared by every label design
export const FONT = "Arial, Helvetica, sans-serif";

export type Ctx = CanvasRenderingContext2D;

// Loads the photo as a local copy, so the canvas can still be read for printing.
// A photo that can't be loaded is left off rather than stopping the label.
export async function loadImage(url: string): Promise<HTMLImageElement | null> {
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

// Largest photo side kept before drawing; the label prints it far smaller anyway
const PHOTO_MAX = 400;

// Grey, high-contrast copy of the tablet photo, so a pale tablet on a pale
// background still prints as a visible shape instead of fading to white
export async function loadPhoto(
  url: string,
): Promise<HTMLCanvasElement | null> {
  const img = await loadImage(url);
  if (!img) return null;
  const s = Math.min(1, PHOTO_MAX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  const gray = boostContrast(toGray(pixels.data));
  for (let i = 0; i < gray.length; i++) {
    pixels.data[i * 4] = gray[i];
    pixels.data[i * 4 + 1] = gray[i];
    pixels.data[i * 4 + 2] = gray[i];
    pixels.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

// Draws the photo as large as fits inside the box, centred
export function drawPhotoInBox(
  ctx: Ctx,
  photo: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / photo.width, h / photo.height);
  const pw = photo.width * scale;
  const ph = photo.height * scale;
  ctx.drawImage(photo, x + (w - pw) / 2, y + (h - ph) / 2, pw, ph);
}

// Turns the finished label into pure black and white dots. Label printers can't
// print grey, and the computer's print window rounds light grey to white, which
// lost the canister dot and the photo. Doing it here makes every print path,
// and the preview, show exactly the dots that will print.
export function toPrintedDots(ctx: Ctx, width: number, height: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height);
  const mono = ditherToMono(toGray(pixels.data), width, height);
  for (let i = 0; i < mono.length; i++) {
    const v = mono[i] ? 0 : 255;
    pixels.data[i * 4] = v;
    pixels.data[i * 4 + 1] = v;
    pixels.data[i * 4 + 2] = v;
    pixels.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
}

// Writes text, shrinking the font until it fits the width (never below minSize)
export function fitText(
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

// Splits text into at most `maxLines` lines that fit the width (the last line may be shortened)
export function wrapLines(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      // Out of lines: keep the rest together and let fitText shrink or shorten it
      line = [line, ...words.slice(i)].join(" ");
      break;
    }
    lines.push(line);
    line = words[i];
  }
  if (line) lines.push(line);
  return lines;
}

// Drawn in printer dots (not base units) so each QR module is a whole number of dots
export function drawQr(
  ctx: Ctx,
  scale: number,
  text: string,
  x: number,
  y: number,
  size: number,
) {
  const qr = QRCode.create(text || " ", { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  const t = ctx.getTransform();
  const dx = Math.round(t.e + x * scale);
  const dy = Math.round(t.f + y * scale);
  const dSize = Math.floor(size * scale);
  const cell = Math.max(1, Math.floor(dSize / count));
  const offset = Math.floor((dSize - cell * count) / 2);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c)) {
        ctx.fillRect(
          dx + offset + c * cell,
          dy + offset + r * cell,
          cell,
          cell,
        );
      }
    }
  }
  ctx.restore();
}

// Turns a landscape drawing a quarter turn anticlockwise into the label's
// upright (portrait) form, so the Direction switch treats every design alike
export function rotateAnticlockwise(
  canvas: HTMLCanvasElement,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = canvas.height;
  out.height = canvas.width;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  ctx.translate(0, out.height);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

// A thin box with centred bold text (Drug ID, OS, DDA, 8 tags)
export function tagBox(
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

export function boxedText(
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
