import Papa from "papaparse";
import { format } from "date-fns";
import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { ACTIVITY_CATEGORIES } from "@/convex/lib/activity.ts";
import type { LogQueryArgs } from "./log-filters.ts";

const PAGE_SIZE = 500;
// Safety cap so a huge export cannot run forever
export const MAX_EXPORT_ROWS = 50_000;

export function categoryLabel(value: string): string {
  return ACTIVITY_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function formatChanges(entry: Doc<"activityLog">): string {
  return (entry.changes ?? [])
    .map(
      (c) => `${c.field}: ${c.before || "(empty)"} → ${c.after || "(empty)"}`,
    )
    .join("; ");
}

// Spreadsheet formulas in cells are an injection risk; prefix them
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function toRow(e: Doc<"activityLog">) {
  return {
    Date: format(new Date(e.occurredAt), "yyyy-MM-dd HH:mm:ss"),
    Type: categoryLabel(e.category),
    Action: e.action,
    Summary: e.summary,
    "Drug ID": e.drugCode ?? "",
    Medicine: e.drugName ?? "",
    Details: e.detail ?? "",
    Changes: formatChanges(e),
    User: e.userName,
  };
}

export async function fetchAllEntries(
  convex: ConvexReactClient,
  args: LogQueryArgs,
): Promise<{ entries: Doc<"activityLog">[]; truncated: boolean }> {
  const entries: Doc<"activityLog">[] = [];
  let cursor: string | null = null;
  while (entries.length < MAX_EXPORT_ROWS) {
    const res: {
      page: Doc<"activityLog">[];
      isDone: boolean;
      continueCursor: string;
    } = await convex.query(api.activity.list, {
      ...args,
      paginationOpts: { numItems: PAGE_SIZE, cursor },
    });
    entries.push(...res.page);
    if (res.isDone) return { entries, truncated: false };
    cursor = res.continueCursor;
  }
  return { entries: entries.slice(0, MAX_EXPORT_ROWS), truncated: true };
}

export function downloadLogCsv(entries: Doc<"activityLog">[]) {
  const rows = entries.map((e) => {
    const row = toRow(e);
    return Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, safeCell(v)]),
    );
  });
  // BOM so Excel reads Chinese characters correctly
  const csv = "\uFEFF" + Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acp-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
