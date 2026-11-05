// Direct Bluetooth printing (Chrome / Edge / Android). Safari and iPhone/iPad don't offer Web Bluetooth.

// Serial-over-Bluetooth services used by HPRT and most label printers. The first
// writable characteristic found is used to send the CPCL job.
const PRINTER_SERVICES: BluetoothServiceUUID[] = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
];

const CHUNK_SIZE = 180;

let device: BluetoothDevice | null = null;
let writer: BluetoothRemoteGATTCharacteristic | null = null;

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function printerConnected(): boolean {
  return writer !== null && device?.gatt?.connected === true;
}

export function printerName(): string | null {
  return device?.name ?? null;
}

async function findWriter(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics().catch(() => []);
    const found = chars.find(
      (c) => c.properties.writeWithoutResponse || c.properties.write,
    );
    if (found) return found;
  }
  throw new Error("This printer did not offer a way to receive labels");
}

async function attach(d: BluetoothDevice) {
  if (!d.gatt) throw new Error("This device can't be used as a printer");
  const server = await d.gatt.connect();
  writer = await findWriter(server);
  device = d;
  d.addEventListener("gattserverdisconnected", () => {
    writer = null;
  });
}

// Reconnects to the last printer, or asks the user to pick one.
// Picking needs a button press, so call this straight from a click.
export async function connectPrinter(): Promise<void> {
  if (!bluetoothSupported()) {
    throw new Error("This browser can't connect to Bluetooth printers");
  }
  if (printerConnected()) return;
  if (device) {
    try {
      await attach(device);
      return;
    } catch {
      device = null;
    }
  }
  const picked = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });
  await attach(picked);
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendToPrinter(job: Uint8Array): Promise<void> {
  if (!printerConnected()) await connectPrinter();
  const w = writer;
  if (!w) throw new Error("Printer is not connected");
  for (let i = 0; i < job.length; i += CHUNK_SIZE) {
    const chunk = job.slice(i, i + CHUNK_SIZE);
    if (w.properties.writeWithoutResponse) {
      await w.writeValueWithoutResponse(chunk);
      // Small gap so the printer's buffer keeps up
      await pause(8);
    } else {
      await w.writeValueWithResponse(chunk);
    }
  }
}

export function forgetPrinter() {
  device?.gatt?.disconnect();
  device = null;
  writer = null;
}
