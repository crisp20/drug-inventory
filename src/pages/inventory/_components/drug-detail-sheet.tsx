import { useState } from "react";
import { useMutation } from "convex/react";
import { Barcode, ChevronRight, Factory, History, NotebookText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import DrugImage from "@/components/drug-image.tsx";
import DrugNotes from "@/components/drug-notes.tsx";
import type { DrugPackage, DrugWithDetails } from "@/lib/drug-types.ts";
import PackageHistoryDialog from "./package-history-dialog.tsx";
import { errorMessage } from "@/lib/errors.ts";

type Props = {
  drug: DrugWithDetails | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (drug: DrugWithDetails) => void;
};

export default function DrugDetailSheet({ drug, isAdmin, onClose, onEdit }: Props) {
  const remove = useMutation(api.drugs.remove);
  const [confirming, setConfirming] = useState(false);
  const [historyPkg, setHistoryPkg] = useState<DrugPackage | null>(null);

  const handleDelete = async () => {
    if (!drug) return;
    try {
      await remove({ id: drug._id });
      toast.success("Drug deleted");
      setConfirming(false);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "Could not delete drug"));
    }
  };

  return (
    <Sheet open={!!drug} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {drug && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{drug.name}</SheetTitle>
              <SheetDescription>
                {drug.brandName || "No brand"} · <span className="font-mono">{drug.drugId}</span>
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <DrugImage url={drug.imageUrl} alt={drug.name} className="aspect-square w-full max-w-xs" />

              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Barcode className="size-4" /> Barcodes and stock
                </h3>
                <div className="divide-y rounded-xl border">
                  {drug.packages.map((p) => (
                    <div key={p._id} className="space-y-3 p-3">
                      <button
                        type="button"
                        onClick={() => setHistoryPkg(p)}
                        aria-label={`View Stock In and Stock Out history for ${formatPackageForm(p)}`}
                        className="-m-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted active:bg-muted"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm">
                            {p.barcode || <span className="font-sans italic text-muted-foreground">No barcode</span>}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatPackageForm(p)} · {p.qtyPerUnit * p.unitCount} {drug.pieceName} each
                          </div>
                          <div className="flex items-center gap-1 pt-1 text-xs font-medium text-primary">
                            <History className="size-3.5" /> View history
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-2xl font-extrabold leading-none">{p.stock}</div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">in stock</div>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </button>
                      {p.images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {p.images.map((img) =>
                            img.url ? (
                              <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="cursor-zoom-in">
                                <img src={img.url} alt="Packaging" className="size-16 rounded-lg border bg-muted object-contain" />
                              </a>
                            ) : null,
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {drug.manufacturer && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Factory className="size-4" /> Manufacturer
                  </h3>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{drug.manufacturer}</p>
                </section>
              )}

              {(drug.specifications || drug.remarks) && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <NotebookText className="size-4" /> Specifications and remarks
                  </h3>
                  <DrugNotes specifications={drug.specifications} remarks={drug.remarks} className="text-sm" />
                </section>
              )}

              {isAdmin && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => onEdit(drug)}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
      {drug && <PackageHistoryDialog drug={drug} pkg={historyPkg} onClose={() => setHistoryPkg(null)} />}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {drug?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the drug, its barcodes and pictures. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
