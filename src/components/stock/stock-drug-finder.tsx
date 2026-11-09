import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { PackageSearch, ScanLine } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { normalizeBarcode } from "@/convex/lib/barcode.ts";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import DrugSearchInput from "@/components/drug-search-input.tsx";
import LasaWarningDialog from "@/components/lasa/lasa-warning-dialog.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useConfirmDiscard } from "@/hooks/use-unsaved-changes.ts";
import type { DrugPackage, DrugWithDetails } from "@/lib/drug-types.ts";
import DrugPackagePicker from "./drug-package-picker.tsx";

export type StockSelection = { drug: DrugWithDetails; pkg: DrugPackage };

export type FinderState = {
  // Set once a package form is chosen (by tapping it or by scanning its barcode)
  selection: StockSelection | null;
  // True when the selection came from typing or scanning that package form's barcode
  barcodeMatched: boolean;
  // What was searched or scanned (a GS1 code also carries batch and expiry)
  term: string;
  reset: () => void;
};

type Props = {
  children: (state: FinderState) => ReactNode;
};

// Finds the package form whose barcode matches the scanned/typed term exactly
function findBarcodeMatch(
  drugs: DrugWithDetails[],
  term: string,
): StockSelection | null {
  const key = normalizeBarcode(term);
  for (const drug of drugs) {
    const pkg = drug.packages.find((p) => p.barcodeKey && p.barcodeKey === key);
    if (pkg) return { drug, pkg };
  }
  return null;
}

function Hint({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ScanLine />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// Puts the cursor in the stock form's Quantity box once it has appeared (it may still be loading)
function focusQuantity() {
  let tries = 0;
  const attempt = () => {
    const input = document.querySelector<HTMLInputElement>(
      'input[name="quantity"]',
    );
    if (input) {
      input.focus();
      input.select();
    } else if (tries++ < 20) {
      window.setTimeout(attempt, 100);
    }
  };
  window.requestAnimationFrame(attempt);
}

// Search or scan a drug, then pick a package form. A barcode scan picks it automatically.
export default function StockDrugFinder({ children }: Props) {
  const [search, setSearch] = useState("");
  const [term] = useDebounce(search.trim(), 200);
  const [picked, setPicked] = useState<string | null>(null);
  // Lets the user browse every result instead of the auto-picked barcode match
  const [showAll, setShowAll] = useState(false);
  const results = useQuery(api.drugs.search, term ? { term } : "skip");

  // Read selection from live results so stock numbers stay current
  const pickedSelection = picked
    ? (results ?? []).flatMap((drug) =>
        drug.packages
          .filter((p) => p._id === picked)
          .map((pkg) => ({ drug, pkg })),
      )[0]
    : undefined;
  const match = results && term ? findBarcodeMatch(results, term) : null;
  const selection: StockSelection | null =
    // While a picked package form is still loading (e.g. after switching drug), don't fall back to the old match
    pickedSelection ?? (showAll || picked ? null : match);

  // Look Alike, Sound Alike drugs stay locked until staff confirm they checked the pictures
  const [confirmedDrug, setConfirmedDrug] = useState<string | null>(null);
  const needsWarning =
    !!selection?.drug.lasa && confirmedDrug !== selection.drug._id;
  const usable = needsWarning ? null : selection;

  const confirmDiscard = useConfirmDiscard();

  // Bumped after each record/cancel so the cursor goes straight back to the search box
  const [focusSignal, setFocusSignal] = useState(0);

  const reset = () => {
    setSearch("");
    setPicked(null);
    setShowAll(false);
    setConfirmedDrug(null);
    setFocusSignal((n) => n + 1);
  };
  // Switching drug or package form throws away a half-filled form, so ask first
  const handleSearch = async (value: string) => {
    if (!(await confirmDiscard())) return;
    setSearch(value);
    setPicked(null);
    setShowAll(false);
    setConfirmedDrug(null);
  };
  const handlePick = async (pkgId: string) => {
    if (pkgId === selection?.pkg._id || !(await confirmDiscard())) return;
    setPicked(pkgId);
  };
  const handleShowAll = async () => {
    if (!(await confirmDiscard())) return;
    setPicked(null);
    setShowAll(true);
  };

  return (
    <div className="space-y-4">
      <DrugSearchInput
        value={search}
        onChange={(v) => void handleSearch(v)}
        autoFocus
        focusSignal={focusSignal}
      />
      {!term ? (
        <Hint
          title="Scan or search a drug"
          description="Use a scanner, the camera, or type a barcode, name, brand or Drug ID."
        />
      ) : results === undefined ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : results.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch />
            </EmptyMedia>
            <EmptyTitle>No match for “{term}”</EmptyTitle>
            <EmptyDescription>
              Check the barcode, or ask an admin to add this drug to the
              inventory.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {(selection ? [selection.drug] : results).map((drug) => (
            <DrugPackagePicker
              key={drug._id}
              drug={drug}
              selectedPackageId={selection?.pkg._id}
              matchedPackageId={match?.pkg._id}
              onPick={(p) => void handlePick(p._id)}
            />
          ))}
          {selection && results.length > 1 && (
            <button
              type="button"
              onClick={() => void handleShowAll()}
              className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Show all {results.length} matches
            </button>
          )}
        </div>
      )}
      {children({
        selection: usable,
        barcodeMatched: !!match && usable?.pkg._id === match.pkg._id,
        term,
        reset,
      })}
      <LasaWarningDialog
        drugId={needsWarning && selection ? selection.drug._id : null}
        highlightPackageId={selection?.pkg._id}
        confirmLabel="Continue with this drug"
        switchMode="package"
        onConfirm={() => selection && setConfirmedDrug(selection.drug._id)}
        // Load the other drug by its Drug ID and pick its package form; it was just compared, so no second warning
        onSwitch={(other, packageId) => {
          setSearch(other.drugId);
          setPicked(packageId);
          setShowAll(false);
          setConfirmedDrug(other._id);
        }}
        onAfterChoose={focusQuantity}
        // Backing out clears the pick so the wrong drug cannot be used by accident
        onCancel={reset}
      />
    </div>
  );
}
