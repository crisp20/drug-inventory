import LasaBadge from "@/components/lasa-badge.tsx";
import DdaBadge from "@/components/dda-badge.tsx";
import ManufacturerLine from "@/components/manufacturer-line.tsx";
import DrugNotes from "@/components/drug-notes.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import DrugImage from "@/components/drug-image.tsx";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import type { DrugWithDetails } from "@/lib/drug-types.ts";
import { cn } from "@/lib/utils.ts";

export default function DrugRow({
  drug,
  onSelect,
}: {
  drug: DrugWithDetails;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-start gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
    >
      <DrugImage url={drug.imageUrl} alt={drug.name} className="size-24 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="truncate text-base font-bold">{drug.name}</span>
          {drug.brandName && <span className="truncate text-sm text-muted-foreground">{drug.brandName}</span>}
          <span className="ml-auto font-mono text-xs text-muted-foreground">{drug.drugId}</span>
        </div>
        {(drug.lasa || drug.dda) && (
          <div className="flex flex-wrap gap-2">
            {drug.lasa && <LasaBadge />}
            {drug.dda && <DdaBadge />}
          </div>
        )}
        <ManufacturerLine manufacturer={drug.manufacturer} />
        <DrugNotes specifications={drug.specifications} remarks={drug.remarks} />
        <div className="flex flex-wrap gap-2">
          {drug.packages.map((p) => (
            <Badge
              key={p._id}
              variant="secondary"
              className={cn("gap-2 font-normal", p.stock === 0 && "bg-destructive/10 text-destructive")}
            >
              <span>{formatPackageForm(p)}</span>
              <span className="font-bold">{p.stock}</span>
            </Badge>
          ))}
        </div>
      </div>
    </button>
  );
}
