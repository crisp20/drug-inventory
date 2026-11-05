import type { MovementKind } from "@/convex/lib/stock.ts";
import PageHeader from "@/components/page-header.tsx";
import MovementForm from "./movement-form.tsx";
import MovementLogSection from "./movement-log-section.tsx";
import StockDrugFinder from "./stock-drug-finder.tsx";

const COPY = {
  in: {
    title: "Stock In",
    description:
      "Scan or search a drug, choose the package form, and record what arrived.",
    logTitle: "Recent Stock In",
  },
  out: {
    title: "Stock Out",
    description:
      "Scan or search a drug, choose the package form, and record what is going out.",
    logTitle: "Recent Stock Out",
  },
} as const;

// Shared page layout for Stock In and Stock Out
export default function StockMovementPage({ kind }: { kind: MovementKind }) {
  const copy = COPY[kind];
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader title={copy.title} description={copy.description} />
      <StockDrugFinder key={kind}>
        {({ selection, barcodeMatched, term, reset }) => (
          <>
            {selection && (
              <MovementForm
                key={selection.pkg._id}
                kind={kind}
                selection={selection}
                scannedCode={barcodeMatched ? term : undefined}
                onDone={reset}
              />
            )}
            <MovementLogSection
              kind={kind}
              title={copy.logTitle}
              selection={selection}
              barcodeMatched={barcodeMatched}
            />
          </>
        )}
      </StockDrugFinder>
    </div>
  );
}
