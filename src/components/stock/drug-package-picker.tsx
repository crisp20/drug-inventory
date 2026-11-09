import { Barcode, Check } from "lucide-react";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import LasaBadge from "@/components/lasa-badge.tsx";
import DdaBadge from "@/components/dda-badge.tsx";
import ManufacturerLine from "@/components/manufacturer-line.tsx";
import DrugNotes from "@/components/drug-notes.tsx";
import ZoomableDrugImage, {
  type GallerySlide,
} from "@/components/zoomable-drug-image.tsx";
import type { DrugPackage, DrugWithDetails } from "@/lib/drug-types.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  drug: DrugWithDetails;
  selectedPackageId?: string;
  matchedPackageId?: string;
  onPick: (pkg: DrugPackage) => void;
};

// A drug with one tappable button per package form (barcode)
export default function DrugPackagePicker({
  drug,
  selectedPackageId,
  matchedPackageId,
  onPick,
}: Props) {
  const selectedPkg = drug.packages.find((p) => p._id === selectedPackageId);
  const matchInDrug = drug.packages.some((p) => p._id === matchedPackageId);
  const drugSlides: GallerySlide[] = drug.imageUrl
    ? [{ url: drug.imageUrl, caption: "Drug picture" }]
    : [];
  const slides = [
    ...drugSlides,
    ...(selectedPkg ? packagingSlides(selectedPkg) : []),
  ];
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-3 pb-3">
        <ZoomableDrugImage
          url={drug.imageUrl}
          alt={drug.name}
          slides={slides}
          className="size-32 sm:size-40"
        />
        <div className="min-w-0">
          {(drug.lasa || drug.dda) && (
            <div className="mb-1 flex flex-wrap gap-1">
              {drug.lasa && <LasaBadge />}
              {drug.dda && <DdaBadge />}
            </div>
          )}
          <div className="truncate text-lg font-semibold">{drug.name}</div>
          <div className="truncate text-sm text-muted-foreground">
            {drug.brandName || "No brand"} ·{" "}
            <span className="font-mono">{drug.drugId}</span>
          </div>
          <ManufacturerLine manufacturer={drug.manufacturer} className="pt-1" />
          <DrugNotes
            specifications={drug.specifications}
            remarks={drug.remarks}
            className="pt-1"
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {drug.packages.map((p) => {
          const selected = p._id === selectedPackageId;
          return (
            <div
              key={p._id}
              className={cn(
                "min-w-0 overflow-hidden rounded-lg border transition-colors",
                selected && "border-primary bg-secondary",
                p._id === matchedPackageId &&
                  !selected &&
                  "border-accent-foreground/40 bg-accent/40",
              )}
            >
              <button
                type="button"
                onClick={() => onPick(p)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
                  !selected && "hover:bg-muted",
                )}
              >
                <div className="min-w-0">
                  <div className="font-semibold">{formatPackageForm(p)}</div>
                  <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Barcode className="size-3 shrink-0" />
                    {p.barcode ? (
                      <span className="truncate font-mono">{p.barcode}</span>
                    ) : (
                      <span className="italic">No barcode</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-lg font-extrabold leading-none">
                      {p.stock}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      in stock
                    </div>
                  </div>
                  {selected && <Check className="size-4 text-primary" />}
                </div>
              </button>
              {/* Before a form is picked, show pictures per form; after a barcode scan, only for the scanned form */}
              {!selectedPkg && (!matchInDrug || p._id === matchedPackageId) && (
                <PackagePictureStrip
                  pkg={p}
                  drugName={drug.name}
                  onPick={() => onPick(p)}
                />
              )}
            </div>
          );
        })}
      </div>
      {selectedPkg && (
        <PackagingPictures
          pkg={selectedPkg}
          drugName={drug.name}
          slides={slides}
          offset={drugSlides.length}
        />
      )}
    </div>
  );
}

// Each packaging picture is captioned with its package form, e.g. "14/Box x 1"
function packagingSlides(pkg: DrugPackage): GallerySlide[] {
  const form = formatPackageForm(pkg);
  return pkg.images.flatMap((img) =>
    img.url ? [{ url: img.url, caption: form }] : [],
  );
}

type StripProps = { pkg: DrugPackage; drugName: string; onPick: () => void };

// Sideways-scrolling packaging pictures inside one package form; enlarging offers to pick that form
function PackagePictureStrip({ pkg, drugName, onPick }: StripProps) {
  const form = formatPackageForm(pkg);
  const caption = pkg.barcode ? `${form} · ${pkg.barcode}` : form;
  const slides = pkg.images.flatMap((img) =>
    img.url ? [{ url: img.url, caption }] : [],
  );
  if (slides.length === 0) {
    return (
      <p className="px-3 pb-2 text-xs italic text-muted-foreground">
        No packaging pictures
      </p>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto px-3 pb-3">
      {slides.map((pic, i) => (
        <ZoomableDrugImage
          key={`${pic.url}-${i}`}
          url={pic.url}
          alt={`${drugName} · ${form}`}
          slides={slides}
          startIndex={i}
          action={{ label: "Use this package form", onClick: onPick }}
          className="size-20 border sm:size-24"
        />
      ))}
    </div>
  );
}

type PackagingPicturesProps = {
  pkg: DrugPackage;
  drugName: string;
  slides: GallerySlide[];
  offset: number;
};

// Packaging pictures for the chosen package form (each barcode can have its own)
function PackagingPictures({
  pkg,
  drugName,
  slides,
  offset,
}: PackagingPicturesProps) {
  const pictures = packagingSlides(pkg);
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Packaging pictures · {formatPackageForm(pkg)}
      </div>
      {pictures.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pictures.map((pic, i) => (
            <ZoomableDrugImage
              key={`${pic.url}-${i}`}
              url={pic.url}
              alt={drugName}
              slides={slides}
              startIndex={offset + i}
              hoverPreview
              className="size-24 border sm:size-28"
            />
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No packaging pictures for this package form.
        </p>
      )}
    </div>
  );
}
