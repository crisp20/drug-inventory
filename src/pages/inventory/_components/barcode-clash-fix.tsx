import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import ManufacturerLine from "@/components/manufacturer-line.tsx";
import ZoomableDrugImage from "@/components/zoomable-drug-image.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { cn } from "@/lib/utils.ts";
import type { ReviewItem } from "../_hooks/use-drug-import.ts";
import type { BarcodeFixes } from "../_lib/import-choices.ts";

type Clash = ReviewItem["check"]["clashes"][number];

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

// Live check of a typed replacement, so the admin sees right away if it is also taken
function ReplacementStatus({ barcode, drugId }: { barcode: string; drugId: string }) {
  const [debounced] = useDebounce(barcode.trim(), 300);
  const owner = useQuery(api.drugImport.barcodeOwner, debounced ? { barcode: debounced, drugId } : "skip");
  if (!barcode.trim()) return <p className="text-xs text-muted-foreground">Leave blank to add without a barcode.</p>;
  if (owner === undefined || debounced !== barcode.trim()) return <Spinner className="size-3" />;
  if (owner) {
    return (
      <p className="text-xs text-destructive">
        Also used by {owner.name} ({owner.drugId}). It will be added without a barcode unless you change it.
      </p>
    );
  }
  return <p className="text-xs text-primary">This barcode is free.</p>;
}

function ClashRow({
  clash,
  drugId,
  fix,
  onFix,
}: {
  clash: Clash;
  drugId: string;
  fix: string | undefined;
  onFix: (value: string | undefined) => void;
}) {
  const changing = fix !== undefined;
  return (
    <div className="space-y-2 rounded-md bg-destructive/10 p-2">
      <div className="flex items-start gap-3">
        {/* Hidden when the other drug has no picture */}
        {clash.otherImageUrl && (
          <ZoomableDrugImage url={clash.otherImageUrl} alt={clash.otherName} className="size-14" hoverPreview />
        )}
        <div className="min-w-0 space-y-0.5 text-xs">
          <p className="text-destructive">
            Barcode {clash.barcode} already belongs to{" "}
            <span className="font-semibold">
              {clash.otherName} ({clash.otherDrugId})
            </span>
            .
          </p>
          {clash.otherBrand && <p className="truncate text-foreground">{clash.otherBrand}</p>}
          <ManufacturerLine manufacturer={clash.otherManufacturer} />
          <p className="text-muted-foreground">
            {formatPackageForm(clash.otherPackage)} · {clash.otherPackage.stock.toLocaleString()}{" "}
            {clash.otherPieceName} in stock
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <ModeButton active={!changing} onClick={() => onFix(undefined)}>
          Add without barcode
        </ModeButton>
        <ModeButton active={changing} onClick={() => onFix(fix ?? "")}>
          Change barcode
        </ModeButton>
      </div>
      {changing ? (
        <div className="space-y-1">
          <Input
            autoFocus
            value={fix}
            onChange={(e) => onFix(e.target.value)}
            placeholder="New barcode, e.g. 4891234567890"
            aria-label={`New barcode instead of ${clash.barcode}`}
            className="h-8 bg-background"
          />
          <ReplacementStatus barcode={fix} drugId={drugId} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">The package form is still added, just without this barcode.</p>
      )}
    </div>
  );
}

export default function BarcodeClashFix({
  item,
  fixes,
  onChange,
}: {
  item: ReviewItem;
  fixes: BarcodeFixes | undefined;
  onChange: (fixes: BarcodeFixes) => void;
}) {
  const setFix = (barcode: string, value: string | undefined) => {
    const next = { ...fixes };
    if (value === undefined) delete next[barcode];
    else next[barcode] = value;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {item.check.clashes.map((c) => (
        <ClashRow
          key={c.barcode}
          clash={c}
          drugId={item.drug.drugId}
          fix={fixes?.[c.barcode]}
          onFix={(v) => setFix(c.barcode, v)}
        />
      ))}
    </div>
  );
}
