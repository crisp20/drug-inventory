import Papa from "papaparse";
import { format } from "date-fns";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api.js";

type ExportDrug = FunctionReturnType<
  typeof api.drugImport.listForExport
>["page"][number];

const PAGE_SIZE = 200;
// Safety cap so a huge export cannot run forever
const MAX_EXPORT_DRUGS = 20_000;

// Spreadsheet formulas in cells are an injection risk; prefix them
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const yesNo = (b: boolean) => (b ? "Yes" : "No");

// One row per package form, with the same headers the import reads, so the file can be imported back
export function exportRows(drugs: ExportDrug[]): Record<string, string>[] {
  return drugs.flatMap((d) => {
    const base = {
      "Drug ID": d.drugId,
      "Print Out Name": d.name,
      "Brand Name": d.brandName,
      Manufacturer: d.manufacturer,
      "Dosage Form": d.pieceName,
    };
    const extra = {
      Specifications: d.specifications,
      Remarks: d.remarks,
      LASA: yesNo(d.lasa),
      DDA: yesNo(d.dda),
    };
    const forms =
      d.packages.length > 0
        ? d.packages.map((p) => ({
            Barcode: p.barcode,
            Form: p.baseUnit,
            Per: String(p.qtyPerUnit),
            Amount: String(p.unitCount),
          }))
        : [{ Barcode: "", Form: "", Per: "", Amount: "" }];
    return forms.map((f) =>
      Object.fromEntries(
        Object.entries({ ...base, ...f, ...extra }).map(([k, v]) => [
          k,
          safeCell(v),
        ]),
      ),
    );
  });
}

async function fetchAllDrugs(convex: ConvexReactClient): Promise<ExportDrug[]> {
  const drugs: ExportDrug[] = [];
  let cursor: string | null = null;
  while (drugs.length < MAX_EXPORT_DRUGS) {
    const res: FunctionReturnType<typeof api.drugImport.listForExport> =
      await convex.query(api.drugImport.listForExport, {
        paginationOpts: { numItems: PAGE_SIZE, cursor },
      });
    drugs.push(...res.page);
    if (res.isDone) break;
    cursor = res.continueCursor;
  }
  return drugs;
}

// Downloads every medicine as a CSV file; returns how many medicines were exported
export async function downloadDrugsCsv(
  convex: ConvexReactClient,
): Promise<number> {
  const drugs = await fetchAllDrugs(convex);
  // BOM so Excel reads Chinese characters correctly
  const csv = "\uFEFF" + Papa.unparse(exportRows(drugs));
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `acp-medicines-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return drugs.length;
}
