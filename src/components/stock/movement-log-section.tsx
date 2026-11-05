import type { MovementKind } from "@/convex/lib/stock.ts";
import MovementFilterBar, {
  type MovementFilters,
} from "./movement-filter-bar.tsx";
import MovementLog, { type MovementLogFilter } from "./movement-log.tsx";
import type { StockSelection } from "./stock-drug-finder.tsx";
import { CLEARED_FILTERS, useMovementFilters } from "./use-movement-filters.ts";

type Props = {
  kind: MovementKind;
  title: string;
  selection: StockSelection | null;
  barcodeMatched: boolean;
};

function initialFilters(
  selection: StockSelection | null,
  barcodeMatched: boolean,
): MovementFilters {
  return {
    ...CLEARED_FILTERS,
    // A chosen drug narrows the list; a scanned barcode narrows it to that package form
    medicine: selection?.drug ?? null,
    packageId: selection && barcodeMatched ? selection.pkg._id : "all",
  };
}

// Recent entries with filters. Picking a drug above pre-fills the medicine filter.
export default function MovementLogSection({
  kind,
  title,
  selection,
  barcodeMatched,
}: Props) {
  return (
    <section className="space-y-3 pt-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {/* Re-key so filters start from the newly chosen drug / barcode each time */}
      <FilteredLog
        key={`${selection?.pkg._id ?? "none"}-${barcodeMatched}`}
        kind={kind}
        defaults={initialFilters(selection, barcodeMatched)}
      />
    </section>
  );
}

function FilteredLog({
  kind,
  defaults,
}: {
  kind: MovementKind;
  defaults: MovementFilters;
}) {
  const { filters, setFilters, reset, isFiltered, extra } = useMovementFilters(
    defaults,
    kind,
  );

  const scope: MovementLogFilter | undefined =
    filters.packageId !== "all"
      ? { type: "package", packageId: filters.packageId }
      : filters.medicine
        ? { type: "drug", drugId: filters.medicine._id }
        : undefined;

  return (
    <>
      <MovementFilterBar
        kind={kind}
        value={filters}
        onChange={setFilters}
        onReset={reset}
        isFiltered={isFiltered}
      />
      <MovementLog
        kind={kind}
        filter={scope}
        extra={extra}
        isFiltered={isFiltered}
      />
    </>
  );
}
