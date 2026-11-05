// Turns a grey-scale picture into the 1-bit image a thermal printer needs,
// and wraps it in CPCL commands (the HPRT D35BT's printer language).

// Floyd–Steinberg dithering so photos and the blue dot print as dot patterns.
// Returns one value per pixel: 1 = black (burn), 0 = white.
export function ditherToMono(
  gray: Float32Array,
  width: number,
  height: number,
): Uint8Array {
  const g = Float32Array.from(gray);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const black = g[i] < 128;
      out[i] = black ? 1 : 0;
      const err = g[i] - (black ? 0 : 255);
      if (x + 1 < width) g[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) g[i + width - 1] += (err * 3) / 16;
        g[i + width] += (err * 5) / 16;
        if (x + 1 < width) g[i + width + 1] += err / 16;
      }
    }
  }
  return out;
}

// Packs pixels 8 per byte, left pixel in the highest bit
export function packRows(
  mono: Uint8Array,
  width: number,
  height: number,
): { bytesPerRow: number; data: Uint8Array } {
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mono[y * width + x]) {
        data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return { bytesPerRow, data };
}

// One CPCL label: the picture at the top-left, then feed to the next label gap
export function buildCpclJob(
  mono: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const { bytesPerRow, data } = packRows(mono, width, height);
  const enc = new TextEncoder();
  const head = enc.encode(
    `! 0 200 200 ${height} 1\r\nPAGE-WIDTH ${bytesPerRow * 8}\r\nCG ${bytesPerRow} ${height} 0 0 `,
  );
  const tail = enc.encode("\r\nFORM\r\nPRINT\r\n");
  const job = new Uint8Array(head.length + data.length + tail.length);
  job.set(head, 0);
  job.set(data, head.length);
  job.set(tail, head.length + data.length);
  return job;
}

// Canvas pixels to grey-scale (transparent counts as white paper)
export function toGray(rgba: Uint8ClampedArray): Float32Array {
  const gray = new Float32Array(rgba.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const lum =
      0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    gray[i] = lum * a + 255 * (1 - a);
  }
  return gray;
}
