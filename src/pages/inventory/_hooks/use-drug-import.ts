import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  COLUMNS,
  MAX_IMPORT_BATCH,
  buildImportDrugs,
  type ImportDrug,
  type ImportProblem,
  type SheetRecord,
} from "@/convex/lib/drugImport.ts";

export type CheckResult = FunctionReturnType<typeof api.drugImport.checkBatch>[number];
export type MissingDrug = FunctionReturnType<typeof api.drugImport.listForImport>["page"][number];

export type ReviewItem = { drug: ImportDrug; check: CheckResult };

export type ImportReview = {
  newDrugs: ReviewItem[];
  conflicts: ReviewItem[];
  unchanged: number;
  missing: MissingDrug[];
  problems: ImportProblem[];
  withoutPackages: number;
};

export type ImportReport = {
  created: number;
  updated: number;
  removed: number;
  failures: { drugId: string; name: string; message: string }[];
  skipped: { drugId: string; name: string; barcodes: string[] }[];
};

function chunks<T>(items: T[], size = MAX_IMPORT_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Runs the check (compare file with saved inventory) and the final import in small batches
export function useDrugImport() {
  const convex = useConvex();
  const applyBatch = useMutation(api.drugImport.applyBatch);
  const removeBatch = useMutation(api.drugImport.removeBatch);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);

  const check = async (records: SheetRecord[], forms: string[]): Promise<ImportReview> => {
    const { drugs, problems, withoutPackages } = buildImportDrugs(records, forms);
    const batches = chunks(drugs);
    const review: ImportReview = { newDrugs: [], conflicts: [], unchanged: 0, missing: [], problems, withoutPackages };
    try {
      for (let i = 0; i < batches.length; i++) {
        setProgress({ label: "Comparing with your inventory", done: i, total: batches.length });
        const results = await convex.query(api.drugImport.checkBatch, { drugs: batches[i] });
        results.forEach((check, j) => {
          const item = { drug: batches[i][j], check };
          if (check.status === "new") review.newDrugs.push(item);
          else if (check.status === "conflict") review.conflicts.push(item);
          else review.unchanged += 1;
        });
      }
      // A saved drug counts as "in the file" when its Drug ID appears on any row, whatever the form
      const fileIds = new Set(records.map((r) => r.values[COLUMNS.drugId]));
      let cursor: string | null = null;
      for (;;) {
        setProgress({ label: "Looking for drugs missing from the file", done: 0, total: 0 });
        const page: FunctionReturnType<typeof api.drugImport.listForImport> = await convex.query(
          api.drugImport.listForImport,
          { paginationOpts: { numItems: 200, cursor } },
        );
        review.missing.push(...page.page.filter((d) => !fileIds.has(d.drugId)));
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      return review;
    } finally {
      setProgress(null);
    }
  };

  const run = async (
    items: { drug: ImportDrug; action: "create" | "update" }[],
    removeIds: Id<"drugs">[],
  ): Promise<ImportReport> => {
    const report: ImportReport = { created: 0, updated: 0, removed: 0, failures: [], skipped: [] };
    const batches = chunks(items);
    const removeBatches = chunks(removeIds);
    const total = batches.length + removeBatches.length;
    try {
      for (let i = 0; i < batches.length; i++) {
        setProgress({ label: "Saving drugs", done: i, total });
        const res = await applyBatch({ items: batches[i] });
        const failed = new Set(res.failures.map((f) => f.drugId));
        for (const it of batches[i]) {
          if (failed.has(it.drug.drugId)) continue;
          if (it.action === "create") report.created += 1;
          else report.updated += 1;
        }
        report.failures.push(...res.failures);
        report.skipped.push(...res.skipped);
      }
      for (let i = 0; i < removeBatches.length; i++) {
        setProgress({ label: "Deleting drugs", done: batches.length + i, total });
        report.removed += await removeBatch({ ids: removeBatches[i] });
      }
      return report;
    } finally {
      setProgress(null);
    }
  };

  return { check, run, progress };
}
