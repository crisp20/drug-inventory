import { buildCpclJob, ditherToMono, toGray } from "./bitmap.ts";
import { sendToPrinter } from "./bluetooth-printer.ts";
import { DOTS_PER_MM, type LabelOrientation } from "./label-sizes.ts";

// Returns the label turned for the chosen direction. Landscape turns it a quarter
// turn clockwise; portrait returns the drawing unchanged.
export function orientCanvas(
  canvas: HTMLCanvasElement,
  orientation: LabelOrientation,
): HTMLCanvasElement {
  if (orientation === "portrait") return canvas;
  const out = document.createElement("canvas");
  out.width = canvas.height;
  out.height = canvas.width;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

// Sends a drawn label to the Bluetooth printer (the printer repeats it `copies` times)
export async function printCanvasBluetooth(
  canvas: HTMLCanvasElement,
  copies = 1,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mono = ditherToMono(toGray(data), canvas.width, canvas.height);
  await sendToPrinter(buildCpclJob(mono, canvas.width, canvas.height, copies));
}

// Fallback: the normal print window, with the page sized to the (turned) label,
// one page per copy
export function printCanvasWindow(canvas: HTMLCanvasElement, copies = 1): void {
  printCanvasesWindow(
    Array.from({ length: Math.max(1, Math.floor(copies)) }, () => canvas),
  );
}

// Several different labels of the same size, one page each, in order
export function printCanvasesWindow(canvases: HTMLCanvasElement[]): void {
  const first = canvases[0];
  if (!first) return;
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error("Could not open the print window");
  }
  const mmW = first.width / DOTS_PER_MM;
  const mmH = first.height / DOTS_PER_MM;
  const sources = new Map<HTMLCanvasElement, string>();
  const pages = canvases
    .map((c) => {
      const src = sources.get(c) ?? c.toDataURL("image/png");
      sources.set(c, src);
      return `<img src="${src}">`;
    })
    .join("");
  doc.open();
  doc.write(
    `<!doctype html><html><head><style>@page{size:${mmW}mm ${mmH}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:${mmW}mm;height:${mmH}mm;image-rendering:pixelated;break-after:page}img:last-child{break-after:auto}</style></head><body>${pages}</body></html>`,
  );
  doc.close();
  const img = doc.querySelector("img");
  const go = () => {
    win.focus();
    win.print();
    // Leave time for the print window before cleaning up
    setTimeout(() => frame.remove(), 60_000);
  };
  if (img && !img.complete) img.onload = go;
  else go();
}
