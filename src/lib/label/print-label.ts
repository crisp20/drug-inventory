import { buildCpclJob, ditherToMono, toGray } from "./bitmap.ts";
import { sendToPrinter } from "./bluetooth-printer.ts";
import { LABEL_HEIGHT, LABEL_WIDTH } from "./render-label.ts";

// Sends a drawn label to the Bluetooth printer
export async function printCanvasBluetooth(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw labels");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mono = ditherToMono(toGray(data), canvas.width, canvas.height);
  await sendToPrinter(buildCpclJob(mono, canvas.width, canvas.height));
}

// Fallback: the normal print window, sized to one 40mm x 60mm label
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
  const mmW = LABEL_WIDTH / 8;
  const mmH = LABEL_HEIGHT / 8;
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
