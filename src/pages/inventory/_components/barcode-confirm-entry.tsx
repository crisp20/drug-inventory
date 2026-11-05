import { useCallback, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Plus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
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
import BarcodeScannerDialog from "@/components/barcode-scanner-dialog.tsx";
import {
  barcodesMatch,
  isGs1String,
  normalizeBarcode,
  toStoredBarcode,
} from "@/convex/lib/barcode.ts";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import ScanField from "./scan-field.tsx";

type Slot = "first" | "second";

type Props = {
  existingBarcodes: string[];
  onAdd: (barcode: string) => void;
};

// Barcode must be scanned twice and match before a package form can be added.
// Medicines without a barcode can be added after confirming a reminder.
export default function BarcodeConfirmEntry({
  existingBarcodes,
  onAdd,
}: Props) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [scanSlot, setScanSlot] = useState<Slot | null>(null);
  const [askNoBarcode, setAskNoBarcode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);

  const bothFilled = first.trim() !== "" && second.trim() !== "";
  const matched = barcodesMatch(first, second);
  const isDuplicate =
    matched &&
    existingBarcodes.some(
      (b) => b && normalizeBarcode(b) === normalizeBarcode(first),
    );

  const reset = () => {
    setFirst("");
    setSecond("");
    setError(null);
    firstRef.current?.focus();
  };

  const tryAdd = (secondValue: string = second) => {
    if (!first.trim()) {
      setError("Scan the barcode first.");
      firstRef.current?.focus();
      return;
    }
    if (!secondValue.trim()) {
      setError("Scan the barcode a second time to confirm.");
      secondRef.current?.focus();
      return;
    }
    if (!barcodesMatch(first, secondValue)) {
      setError("The two scans do not match. Please scan again.");
      setSecond("");
      secondRef.current?.focus();
      return;
    }
    if (
      existingBarcodes.some(
        (b) => b && normalizeBarcode(b) === normalizeBarcode(first),
      )
    ) {
      setError("This barcode is already listed below.");
      return;
    }
    onAdd(toStoredBarcode(first));
    if (isGs1String(first))
      toast.success(`GS1 code detected. Saved GTIN ${toStoredBarcode(first)}`);
    reset();
  };

  const handleEnter = (slot: Slot) => (value: string) => {
    if (slot === "first" && value.trim()) secondRef.current?.focus();
    else if (slot === "second") tryAdd(value);
  };

  const handleDetected = useCallback(
    (code: string) => {
      setError(null);
      if (scanSlot === "first") {
        setFirst(code);
        setTimeout(() => secondRef.current?.focus(), 0);
      } else {
        setSecond(code);
      }
      setScanSlot(null);
    },
    [scanSlot],
  );

  const scanField = (
    slot: Slot,
    value: string,
    setValue: (v: string) => void,
    label: string,
  ) => (
    <ScanField
      ref={slot === "first" ? firstRef : secondRef}
      label={label}
      value={value}
      onChange={(v) => {
        setValue(v);
        setError(null);
      }}
      onEnter={handleEnter(slot)}
      onCamera={() => setScanSlot(slot)}
      className={cn(
        bothFilled &&
          matched &&
          !isDuplicate &&
          "border-green-600 dark:border-green-400",
        bothFilled && !matched && "border-destructive",
      )}
    />
  );

  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {scanField("first", first, setFirst, "Scan barcode")}
        {scanField("second", second, setSecond, "Scan again to confirm")}
        <Button
          type="button"
          className="h-11"
          onClick={() => tryAdd()}
          disabled={!bothFilled}
        >
          <Plus /> Add
        </Button>
      </div>

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs">
        {error ? (
          <span className="flex items-center gap-1 text-destructive">
            <CircleAlert className="size-3.5" /> {error}
          </span>
        ) : bothFilled && matched && !isDuplicate ? (
          <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="size-3.5" />
            {isGs1String(first)
              ? `GS1 code read. GTIN ${toStoredBarcode(first)} will be saved. Press Add.`
              : "Barcodes match. Press Add."}
          </span>
        ) : bothFilled && !matched ? (
          <span className="flex items-center gap-1 text-destructive">
            <CircleAlert className="size-3.5" /> The two scans do not match.
          </span>
        ) : (
          <span className="text-muted-foreground">
            Scan the same barcode twice so we know it was read correctly.
          </span>
        )}
        <button
          type="button"
          onClick={() => setAskNoBarcode(true)}
          className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
        >
          No barcode?
        </button>
      </div>

      <BarcodeScannerDialog
        open={scanSlot !== null}
        onOpenChange={(open) => !open && setScanSlot(null)}
        onDetected={handleDetected}
      />

      <AlertDialog open={askNoBarcode} onOpenChange={setAskNoBarcode}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add without a barcode?</AlertDialogTitle>
            <AlertDialogDescription>
              Please check the packaging carefully. Only continue if this
              medicine has no barcode or GS1 code. Staff will need to find it by
              name or Drug ID instead of scanning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onAdd("");
                reset();
              }}
            >
              Yes, add without barcode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
