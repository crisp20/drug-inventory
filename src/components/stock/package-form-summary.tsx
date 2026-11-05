import type { DrugPackage } from "@/lib/drug-types.ts";

type Props = { pkg: DrugPackage; pieceName: string };

const FIELDS = [
  { label: "Qty per unit", value: (p: DrugPackage) => p.qtyPerUnit },
  { label: "Base unit", value: (p: DrugPackage) => p.baseUnit },
  { label: "No. of units", value: (p: DrugPackage) => p.unitCount },
] as const;

// Read-only package form for the chosen barcode. Only admins change it, from Inventory.
export default function PackageFormSummary({ pkg, pieceName }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
        {FIELDS.map((f) => (
          <div key={f.label} className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">
              {f.label}
            </div>
            <div className="flex h-11 items-center justify-center rounded-md bg-muted px-3 font-semibold">
              {f.value(pkg)}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {pkg.qtyPerUnit * pkg.unitCount} {pieceName} per package form
      </p>
    </div>
  );
}
