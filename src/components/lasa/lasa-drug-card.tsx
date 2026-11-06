import { ArrowLeftRight } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api.js";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import { Button } from "@/components/ui/button.tsx";
import DrugNotes from "@/components/drug-notes.tsx";
import ZoomableDrugImage, { type GallerySlide } from "@/components/zoomable-drug-image.tsx";
import { cn } from "@/lib/utils.ts";

export type LasaCompareDrug = NonNullable<FunctionReturnType<typeof api.drugs.lasaCompare>>["selected"];

type Props = {
  drug: LasaCompareDrug;
  // The chosen drug is outlined; look-alikes are not
  selected?: boolean;
  // Package form picked in Stock In / Stock Out, highlighted on the chosen drug
  highlightPackageId?: string;
  // Look-alikes only: lets staff switch to this drug ("package" = pick one of its package forms)
  switchMode?: "package" | "drug";
  onSwitch?: (packageId: string | null) => void;
};

// One drug in the look-alike comparison: picture, package form pictures, specifications and remarks
export default function LasaDrugCard({ drug, selected = false, highlightPackageId, switchMode, onSwitch }: Props) {
  // Every picture of this drug, so an enlarged view can swipe through them all
  const slides: GallerySlide[] = [
    ...(drug.imageUrl ? [{ url: drug.imageUrl, caption: `${drug.name} · drug picture` }] : []),
    ...drug.packages.flatMap((p) =>
      p.images.flatMap((img) => (img.url ? [{ url: img.url, caption: `${drug.name} · ${formatPackageForm(p)}` }] : [])),
    ),
  ];
  const indexOf = (url: string | null) => Math.max(0, slides.findIndex((s) => s.url === url));

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3",
        selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      <div
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide",
          selected ? "text-primary" : "text-destructive",
        )}
      >
        {selected ? "You selected" : "Looks or sounds like"}
      </div>
      <ZoomableDrugImage
        url={drug.imageUrl}
        alt={drug.name}
        slides={slides.length ? slides : undefined}
        startIndex={indexOf(drug.imageUrl)}
        className="aspect-square w-full"
      />
      <div className="min-w-0">
        <div className="break-words text-base font-bold leading-tight">{drug.name}</div>
        <div className="break-words text-sm text-muted-foreground">
          {drug.brandName || "No brand"} · <span className="font-mono">{drug.drugId}</span>
        </div>
        {drug.manufacturer && <div className="break-words text-xs text-muted-foreground">{drug.manufacturer}</div>}
      </div>

      {drug.packages.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold">Package forms</div>
          {drug.packages.map((p) => (
            <div
              key={p._id}
              className={cn(
                "space-y-2 rounded-lg border p-2",
                p._id === highlightPackageId && "border-primary bg-primary/5",
              )}
            >
              <div className="text-xs">
                <span className="font-medium">{formatPackageForm(p)}</span>
                <span className="block truncate font-mono text-muted-foreground">{p.barcode || "No barcode"}</span>
              </div>
              {p.images.some((img) => img.url) ? (
                <div className="flex flex-wrap gap-2">
                  {p.images.map((img) =>
                    img.url ? (
                      <ZoomableDrugImage
                        key={img.id}
                        url={img.url}
                        alt={`${drug.name} packaging`}
                        slides={slides}
                        startIndex={indexOf(img.url)}
                        className="size-20 border"
                      />
                    ) : null,
                  )}
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">No package picture</p>
              )}
              {onSwitch && switchMode === "package" && (
                <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => onSwitch(p._id)}>
                  <ArrowLeftRight /> Use this drug instead
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {onSwitch && switchMode === "package" && drug.packages.length === 0 && (
        <p className="text-xs italic text-muted-foreground">
          No package form yet, so this drug cannot be chosen for stock.
        </p>
      )}

      <DrugNotes specifications={drug.specifications} remarks={drug.remarks} />
      {!drug.specifications && !drug.remarks && (
        <p className="text-xs italic text-muted-foreground">No specifications or remarks</p>
      )}
      {onSwitch && switchMode === "drug" && (
        <Button type="button" variant="secondary" className="mt-auto w-full" onClick={() => onSwitch(null)}>
          <ArrowLeftRight /> Open this drug instead
        </Button>
      )}
    </div>
  );
}
