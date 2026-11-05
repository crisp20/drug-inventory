import { format } from "date-fns";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileUp,
  Image,
  Package,
  Pill,
  Settings,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import type { ActivityCategory } from "@/convex/lib/activity.ts";
import { cn } from "@/lib/utils.ts";
import { categoryLabel } from "../_lib/export-log.ts";

const ICONS: Record<ActivityCategory, LucideIcon> = {
  medicine: Pill,
  package: Package,
  photo: Image,
  import: FileUp,
  stock_in: ArrowDownToLine,
  stock_out: ArrowUpFromLine,
  undo: Undo2,
  user: Users,
  settings: Settings,
};

const TONES: Partial<Record<ActivityCategory, string>> = {
  stock_in: "bg-primary/10 text-primary",
  stock_out: "bg-chart-3/15 text-chart-3",
  undo: "bg-destructive/10 text-destructive",
};

export default function ActivityEntry({
  entry,
}: {
  entry: Doc<"activityLog">;
}) {
  const Icon = ICONS[entry.category];
  const when = new Date(entry.occurredAt);
  return (
    <li className="flex gap-3 px-4 py-3">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground",
          TONES[entry.category],
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 break-words font-semibold">{entry.summary}</p>
          <time
            dateTime={entry.occurredAt}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {format(when, "d MMM yyyy, h:mm a")}
          </time>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">
            {categoryLabel(entry.category)}
          </span>
          {entry.drugName && (
            <span className="min-w-0 break-words">
              {entry.drugCode ? `${entry.drugCode} · ` : ""}
              {entry.drugName}
            </span>
          )}
          <span>by {entry.userName}</span>
        </div>
        {entry.detail && (
          <p className="break-words text-sm text-muted-foreground">
            {entry.detail}
          </p>
        )}
        {entry.changes && entry.changes.length > 0 && (
          <ul className="space-y-0.5 rounded-lg bg-muted/50 p-2 text-sm">
            {entry.changes.map((c, i) => (
              <li key={`${c.field}-${i}`} className="break-words">
                <span className="font-medium">{c.field}:</span>{" "}
                <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                  {c.before || "(empty)"}
                </span>{" "}
                <span className="text-muted-foreground">→</span>{" "}
                <span>{c.after || "(empty)"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
