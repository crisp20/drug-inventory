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

// Sends a drawn label to the Bluetooth printer
export async function printCanvasBluetooth(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mono = ditherToMono(toGray(data), canvas.width, canvas.height);
  await sendToPrinter(buildCpclJob(mono, canvas.width, canvas.height));
}

// Fallback: the normal print window, with the page sized to the (turned) label
export function printCanvasWindow(canvas: HTMLCanvasElement): void {
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
  const mmW = canvas.width / DOTS_PER_MM;
  const mmH = canvas.height / DOTS_PER_MM;
  doc.open();
  doc.write(
    `<!doctype html><html><head><style>@page{size:${mmW}mm ${mmH}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:${mmW}mm;height:${mmH}mm;image-rendering:pixelated}</style></head><body><img src="${canvas.toDataURL("image/png")}"></body></html>`,
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
