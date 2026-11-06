import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { TriangleAlert } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import LasaDrugCard, { type LasaCompareDrug } from "./lasa-drug-card.tsx";

type Props = {
  // The marked drug to warn about; null keeps the dialog closed
  drugId: Id<"drugs"> | null;
  highlightPackageId?: string;
  confirmLabel?: string;
  // "package": switching picks a package form of the other drug (Stock In / Out); "drug": the drug itself (Inventory)
  switchMode: "package" | "drug";
  onConfirm: () => void;
  // Staff decided the other drug is the right one
  onSwitch: (drug: LasaCompareDrug, packageId: string | null) => void;
  onCancel: () => void;
  // Runs once the dialog has fully closed after continuing or switching (e.g. to focus a field)
  onAfterChoose?: () => void;
};

// Firm Look Alike, Sound Alike warning: staff must tick that they checked the pictures to continue,
// or switch to one of the look-alike drugs shown
export default function LasaWarningDialog(props: Props) {
  // After continuing or switching, the next screen sets the cursor itself (e.g. the Quantity box),
  // so don't send focus back to whatever opened the dialog
  const chose = useRef(false);
  const wrap =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      chose.current = true;
      fn(...args);
    };

  return (
    <Dialog open={!!props.drugId} onOpenChange={(o) => !o && props.onCancel()}>
      <DialogContent
        className="max-h-[92vh] max-w-[calc(100vw-1.5rem)] gap-4 overflow-y-auto p-4 sm:max-w-5xl sm:p-6"
        onCloseAutoFocus={(e) => {
          if (chose.current) {
            e.preventDefault();
            props.onAfterChoose?.();
          }
          chose.current = false;
        }}
      >
        {/* Keyed so the tick box starts empty for every drug */}
        {props.drugId && (
          <WarningBody
            key={props.drugId}
            {...props}
            drugId={props.drugId}
            onConfirm={wrap(props.onConfirm)}
            onSwitch={wrap(props.onSwitch)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WarningBody({
  drugId,
  highlightPackageId,
  confirmLabel = "Continue",
  switchMode,
  onConfirm,
  onSwitch,
  onCancel,
}: Props & { drugId: Id<"drugs"> }) {
  const [checked, setChecked] = useState(false);
  const data = useQuery(api.drugs.lasaCompare, { id: drugId });

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="flex items-center gap-2 text-lg text-destructive">
          <TriangleAlert className="size-5 shrink-0" /> Look Alike, Sound Alike medicine
        </DialogTitle>
        <DialogDescription>
          This drug is easily confused with others. Compare the drug picture, package form pictures,
          specifications and remarks before you continue. Picked the wrong one? Choose the correct drug below.
        </DialogDescription>
      </DialogHeader>

      {data === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full rounded-xl" />
          ))}
        </div>
      ) : data === null ? (
        <p className="text-sm text-muted-foreground">This drug could not be found. It may have been deleted.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LasaDrugCard drug={data.selected} selected highlightPackageId={highlightPackageId} />
          {data.lookAlikes.map((d) => (
            <LasaDrugCard
              key={d._id}
              drug={d}
              switchMode={switchMode}
              onSwitch={(packageId) => onSwitch(d, packageId)}
            />
          ))}
          {data.lookAlikes.length === 0 && (
            <div className="flex items-center justify-center rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              No similar drugs are linked yet. Check the pictures carefully anyway.
            </div>
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
          className="mt-0.5 size-5"
          disabled={!data}
        />
        <span className="text-sm font-medium">
          I have checked the drug picture, package form pictures, specifications and remarks.
        </span>
      </label>

      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={!checked || !data}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
