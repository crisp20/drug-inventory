import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { format } from "date-fns";
import { History, Undo2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import type { MovementKind } from "@/convex/lib/stock.ts";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import { cn } from "@/lib/utils.ts";
import UndoMovementDialog from "./undo-movement-dialog.tsx";

const PAGE_SIZE = 25;

export type MovementLogFilter =
  | { type: "drug"; drugId: Id<"drugs"> }
  | { type: "package"; packageId: Id<"drugPackages"> };

// Time period, user and reason narrowing (applied on the server before paging)
export type MovementLogExtra = {
  since?: string;
  until?: string;
  userId?: Id<"users">;
  reason?: string;
};

type Common = { extra?: MovementLogExtra; isFiltered?: boolean };

// Leaving out `kind` shows Stock In and Stock Out together (package form filter only)
type Props = Common &
  (
    | { kind: MovementKind; filter?: MovementLogFilter }
    | {
        kind?: undefined;
        filter: Extract<MovementLogFilter, { type: "package" }>;
      }
  );

const KIND_LABEL: Record<MovementKind, string> = {
  in: "Stock In",
  out: "Stock Out",
};

// Who recorded what, and when. Newest first.
export default function MovementLog({
  kind,
  filter,
  extra,
  isFiltered,
}: Props) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.stock.listMovements,
    { kind, filter, ...extra },
    { initialNumItems: PAGE_SIZE },
  );
  const currentUser = useCurrentUser();
  const isAdmin =
    currentUser?.role === "admin" && currentUser.status === "active";
  const [undoing, setUndoing] = useState<Doc<"stockMovements"> | null>(null);
  const mixed = kind === undefined;
  const label = kind ? KIND_LABEL[kind] : "Stock In or Stock Out";

  if (status === "LoadingFirstPage") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (status === "Exhausted" && results.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>
            {isFiltered
              ? `No ${label} matches these filters`
              : filter
                ? `No ${label} recorded for this ${filter.type === "drug" ? "drug" : "package form"} yet`
                : "Nothing recorded yet"}
          </EmptyTitle>
          <EmptyDescription>
            {isFiltered
              ? "Try a longer time period or clear some filters."
              : filter
                ? "Earlier entries will appear here once they are recorded."
                : `Each ${label} will appear here with who recorded it.`}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border bg-card">
        {results.map((m) => (
          <li
            key={m._id}
            className={cn("flex gap-3 p-3", m.undo && "bg-muted/50")}
          >
            <div
              className={cn(
                "w-14 shrink-0 pt-0.5 text-center text-lg font-extrabold",
                m.undo
                  ? "text-muted-foreground line-through"
                  : m.kind === "in"
                    ? "text-primary"
                    : "text-chart-3",
              )}
            >
              {m.kind === "in" ? "+" : "−"}
              {m.quantity}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {mixed && (
                  <Badge variant={m.kind === "in" ? "default" : "secondary"}>
                    {KIND_LABEL[m.kind]}
                  </Badge>
                )}
                <span
                  className={cn(
                    "truncate font-semibold",
                    m.undo && "text-muted-foreground line-through",
                  )}
                >
                  {m.drugName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatPackageForm(m)}
                </span>
                {m.reason && <Badge variant="secondary">{m.reason}</Badge>}
                {m.undo && <Badge variant="destructive">Undone</Badge>}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {m.barcode ? (
                  <span className="font-mono">{m.barcode}</span>
                ) : (
                  "No barcode"
                )}{" "}
                · Stock {m.stockBefore} → {m.stockAfter}
              </div>
              {m.canister && (
                <p className="text-xs font-medium text-primary">
                  Canister · Batch {m.canister.batch} · Exp{" "}
                  {format(
                    new Date(`${m.canister.expiry}T00:00:00`),
                    "d MMM yyyy",
                  )}{" "}
                  · Qty {m.canister.quantity} · Type {m.canister.type}
                </p>
              )}
              {!m.canister && (m.batch || m.expiry) && (
                <p className="text-xs font-medium text-muted-foreground">
                  {[
                    m.batch && `Batch ${m.batch}`,
                    m.expiry &&
                      `Exp ${format(new Date(`${m.expiry}T00:00:00`), "d MMM yyyy")}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {m.mismatchedScan && (
                <p className="break-all text-xs font-medium text-orange-700 dark:text-orange-300">
                  Scanned code did not match: {m.mismatchedScan}
                </p>
              )}
              {m.notes && (
                <p className="whitespace-pre-line text-sm">{m.notes}</p>
              )}
              {m.undo && (
                <p className="text-xs text-destructive">
                  Undone by {m.undo.userName} ·{" "}
                  {format(new Date(m.undo.undoneAt), "d MMM yyyy, h:mm a")} ·{" "}
                  <span className="font-semibold">{m.undo.reason}</span> · Stock{" "}
                  {m.undo.stockBefore} → {m.undo.stockAfter}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{m.userName}</div>
              <div>{format(new Date(m.occurredAt), "d MMM yyyy")}</div>
              <div>{format(new Date(m.occurredAt), "h:mm a")}</div>
              {isAdmin && !m.undo && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => setUndoing(m)}
                >
                  <Undo2 className="size-3.5" />
                  Undo
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => loadMore(PAGE_SIZE)}
        >
          Load more
        </Button>
      )}
      <UndoMovementDialog movement={undoing} onClose={() => setUndoing(null)} />
    </div>
  );
}
