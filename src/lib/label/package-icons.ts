import type { BaseUnit } from "@/convex/lib/barcode.ts";
import { loadImage } from "./draw.ts";

// Local icons keep label printing independent of external image hosts.
export const PACKAGE_ICON_URLS: Record<BaseUnit, string> = {
  Box: "/package-icons/drugbox_icon.png",
  Bottle: "/package-icons/drugbot_icon.png",
  Strip: "/package-icons/drugstrip_icon.png",
  Bag: "/package-icons/drugbags_icon.png",
};

// Icons are scaled up before drawing so the lines stay smooth on the label
const ICON_SCALE = 4;

// Solid black-on-white copy of the icon: the printer prints black only, and the
// purple lines would otherwise come out as a grey dither pattern
export async function loadPackageIcon(
  unit: BaseUnit,
): Promise<HTMLCanvasElement | null> {
  const img = await loadImage(PACKAGE_ICON_URLS[unit]);
  if (!img) return null;
  const w = img.width * ICON_SCALE;
  const h = img.height * ICON_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    // Ink = visible and not near-white (handles transparent or white backgrounds)
    const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const ink = d[i + 3] > 110 && brightness < 215;
    const v = ink ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
