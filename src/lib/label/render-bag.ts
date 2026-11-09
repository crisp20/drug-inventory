import { drawQr, FONT, type Ctx } from "./draw.ts";
import { drawLandscape } from "./render-compact.ts";
import { drawNames, drawPackageRow } from "./render-stock-in.ts";
import { loadPackageIcon } from "./package-icons.ts";
import { renderOnSheet } from "./sheet.ts";
import type { LabelSize } from "./label-sizes.ts";
import {
  BAG_COLUMNS,
  BAG_ROWS,
  bagQrText,
  bagTagText,
  type BagRange,
} from "./bag-label.ts";
import type { StockInLabelData } from "./stock-in-label.ts";

// Same 480 x 320 landscape grid as the Medicine Label, laid out like the ACP
// Medicine Bag samples: names, tags + package row, then a numbered grid beside the QR
const GRID = { x: 12, y: 186, w: 300, h: 120 };

function drawGrid(ctx: Ctx, range: BagRange) {
  const cw = GRID.w / BAG_COLUMNS;
  const ch = GRID.h / BAG_ROWS;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let c = 1; c < BAG_COLUMNS; c++) {
    ctx.moveTo(GRID.x + c * cw, GRID.y);
    ctx.lineTo(GRID.x + c * cw, GRID.y + GRID.h);
  }
  for (let r = 1; r < BAG_ROWS; r++) {
    ctx.moveTo(GRID.x, GRID.y + r * ch);
    ctx.lineTo(GRID.x + GRID.w, GRID.y + r * ch);
  }
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeRect(GRID.x, GRID.y, GRID.w, GRID.h);

  ctx.font = `26px ${FONT}`;
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let n = range.start; n <= range.end; n++) {
    const i = n - range.start;
    const c = i % BAG_COLUMNS;
    const r = Math.floor(i / BAG_COLUMNS);
    ctx.fillText(
      String(n),
      GRID.x + c * cw + cw / 2,
      GRID.y + r * ch + ch / 2 + 1,
    );
  }
  ctx.textAlign = "left";
}

function drawBag(
  ctx: Ctx,
  scale: number,
  data: StockInLabelData,
  icon: HTMLCanvasElement | null,
  range: BagRange,
) {
  drawNames(ctx, data);
  // "DDA,8" ends just before the package icon
  const tags = bagTagText(data);
  if (tags) {
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillStyle = "#000";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(tags, 244, 162);
    ctx.textAlign = "left";
  }
  drawPackageRow(ctx, data, icon);
  drawGrid(ctx, range);
  drawQr(ctx, scale, bagQrText(data), 324, 188, 120);
}

// One upright (portrait) canvas per Medicine Bag Label, e.g. 1-15 then 16
export async function renderBagLabels(
  data: StockInLabelData,
  size: LabelSize,
  ranges: BagRange[],
): Promise<HTMLCanvasElement[]> {
  const icon = await loadPackageIcon(data.baseUnit);
  return Promise.all(
    ranges.map((range) =>
      renderOnSheet(size, async (s) =>
        drawLandscape(s, (ctx, scale) =>
          drawBag(ctx, scale, data, icon, range),
        ),
      ),
    ),
  );
}
