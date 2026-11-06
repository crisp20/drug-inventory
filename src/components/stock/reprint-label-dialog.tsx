import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { labelFromMovement } from "@/lib/label/label-data.ts";
import LabelPrintDialog from "./label-print-dialog.tsx";

type Props = {
  movement: Doc<"stockMovements"> | null;
  onClose: () => void;
};

// Reprints the label of an earlier canister Stock Out. Never prints by itself,
// so the size and direction can be checked first.
export default function ReprintLabelDialog({ movement, onClose }: Props) {
  // The picture isn't saved on the entry, so look up the drug (skipped while closed)
  const drug = useQuery(
    api.drugs.get,
    movement?.canister ? { id: movement.drugRef } : "skip",
  );
  const canister = movement?.canister;
  const data =
    movement && canister && drug !== undefined
      ? labelFromMovement({ ...movement, canister }, drug?.imageUrl ?? null, !!drug?.dda)
      : null;

  return (
    <LabelPrintDialog
      data={data}
      onClose={onClose}
      title="Reprint label"
      autoPrint={false}
    />
  );
}
