import { useState } from "react";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import type { MovementKind } from "@/convex/lib/stock.ts";
import MovementFilterBar from "@/components/stock/movement-filter-bar.tsx";
import MovementLog from "@/components/stock/movement-log.tsx";
import { useMovementFilters } from "@/components/stock/use-movement-filters.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import type { DrugPackage, DrugWithDetails } from "@/lib/drug-types.ts";

type Props = {
  drug: DrugWithDetails;
  pkg: DrugPackage | null;
  onClose: () => void;
};

const TABS = [
  { value: "all", label: "All", kind: undefined },
  { value: "in", label: "Stock In", kind: "in" },
  { value: "out", label: "Stock Out", kind: "out" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  kind: MovementKind | undefined;
}>;
type TabValue = (typeof TABS)[number]["value"];

// Every Stock In and Stock Out recorded against one package form (barcode)
export default function PackageHistoryDialog({ drug, pkg, onClose }: Props) {
  return (
    <Dialog open={!!pkg} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-2xl">
        {/* Re-key so filters start fresh for each package form */}
        {pkg && <PackageHistory key={pkg._id} drug={drug} pkg={pkg} />}
      </DialogContent>
    </Dialog>
  );
}

function PackageHistory({
  drug,
  pkg,
}: {
  drug: DrugWithDetails;
  pkg: DrugPackage;
}) {
  const [tab, setTab] = useState<TabValue>("all");
  const kind = TABS.find((t) => t.value === tab)?.kind;
  // Filters stay the same when switching tabs
  const { filters, setFilters, reset, isFiltered, extra } = useMovementFilters(
    undefined,
    kind,
  );
  const filter = { type: "package", packageId: pkg._id } as const;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {drug.name} · {formatPackageForm(pkg)}
        </DialogTitle>
        <DialogDescription>
          {pkg.barcode ? (
            <span className="font-mono">{pkg.barcode}</span>
          ) : (
            "No barcode"
          )}{" "}
          · {pkg.stock} in stock
        </DialogDescription>
      </DialogHeader>
      {/* Inactive tabs unmount, so only one list is loaded at a time */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = TABS.find((t) => t.value === v);
          if (next) setTab(next.value);
        }}
        className="min-h-0 flex-1"
      >
        <TabsList className="grid w-full grid-cols-3">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="cursor-pointer"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <MovementFilterBar
          kind={kind}
          value={filters}
          onChange={setFilters}
          onReset={reset}
          isFiltered={isFiltered}
          showMedicine={false}
        />
        <div className="min-h-0 flex-1 overflow-y-auto pt-2">
          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              {t.kind === undefined ? (
                <MovementLog
                  filter={filter}
                  extra={extra}
                  isFiltered={isFiltered}
                />
              ) : (
                <MovementLog
                  kind={t.kind}
                  filter={filter}
                  extra={extra}
                  isFiltered={isFiltered}
                />
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </>
  );
}
