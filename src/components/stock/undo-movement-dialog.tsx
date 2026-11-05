import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import { MAX_REASON_LENGTH, UNDO_REASONS } from "@/convex/lib/stock.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  movement: Doc<"stockMovements"> | null;
  onClose: () => void;
};

// Admin confirms an undo and records why (e.g. "Scanned in error")
export default function UndoMovementDialog({ movement, onClose }: Props) {
  return (
    <Dialog open={!!movement} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {movement && (
          <UndoForm key={movement._id} movement={movement} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UndoForm({
  movement,
  onClose,
}: {
  movement: Doc<"stockMovements">;
  onClose: () => void;
}) {
  const undo = useMutation(api.stock.undoMovement);
  const [reason, setReason] = useState<string>(UNDO_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const isIn = movement.kind === "in";
  const trimmed = reason.trim();

  const handleUndo = async () => {
    if (!trimmed) return;
    setSaving(true);
    try {
      const { stockAfter } = await undo({
        movementId: movement._id,
        reason: trimmed,
      });
      toast.success(`Entry undone. Stock is now ${stockAfter}.`);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't undo this entry"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Undo this {isIn ? "Stock In" : "Stock Out"}?</DialogTitle>
        <DialogDescription>
          {isIn ? "Removes" : "Adds back"} {movement.quantity} ×{" "}
          {formatPackageForm(movement)} of{" "}
          <span className="font-semibold text-foreground">
            {movement.drugName}
          </span>
          . The entry stays in the history, marked as undone.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="undo-reason">Reason</Label>
        <div className="flex flex-wrap gap-2">
          {UNDO_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                reason === r
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Input
          id="undo-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={MAX_REASON_LENGTH}
          placeholder="Or type another reason"
        />
        {!trimmed && (
          <p className="text-sm text-destructive">Please give a reason</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={() => void handleUndo()}
          disabled={saving || !trimmed}
        >
          {saving && <Spinner />}
          Undo entry
        </Button>
      </DialogFooter>
    </>
  );
}
