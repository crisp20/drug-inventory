import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { labelFromMovement } from "@/lib/label/label-data.ts";
import {
  hadMedicineLabel,
  stockInLabelFromMovement,
} from "@/lib/label/stock-in-label.ts";
import LabelPrintDialog from "./label-print-dialog.tsx";
import StockInLabelDialog from "./stock-in-label-dialog.tsx";

type Props = {
  movement: Doc<"stockMovements"> | null;
  onClose: () => void;
};

// Reprints the label of an earlier entry. Never prints by itself,
// so the size, direction and count can be checked first.
export default function ReprintLabelDialog({ movement, onClose }: Props) {
  // The picture and DDA mark aren't saved on the entry, so look up the drug (skipped while closed)
  const drug = useQuery(
    api.drugs.get,
    movement ? { id: movement.drugRef } : "skip",
  );
  const ready = movement !== null && drug !== undefined;
  const imageUrl = drug?.imageUrl ?? null;
  const dda = !!drug?.dda;
  const canister = movement?.canister;

  if (movement && movement.kind === "in" && !canister) {
    return (
      <StockInLabelDialog
        data={ready ? stockInLabelFromMovement(movement, imageUrl, dda) : null}
        // Reprint the label types the entry was printed with
        choice={{
          medicine: hadMedicineLabel(movement),
          bag: movement.bagLabels === true,
        }}
        copies={movement.quantity}
        quantity={movement.quantity}
        title="Reprint labels"
        onClose={onClose}
      />
    );
  }

  return (
    <LabelPrintDialog
      data={
        ready && movement && canister
          ? labelFromMovement({ ...movement, canister }, imageUrl, dda)
          : null
      }
      onClose={onClose}
      title="Reprint label"
      autoPrint={false}
    />
  );
}
