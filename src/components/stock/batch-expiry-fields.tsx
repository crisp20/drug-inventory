import { useState, type KeyboardEvent } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertTriangle, Camera } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { barcodesMatch } from "@/convex/lib/barcode.ts";
import { isCalendarDay } from "@/convex/lib/canister.ts";
import { expiryStatus, toCalendarDay } from "@/convex/lib/expiry.ts";
import { parseGs1 } from "@/convex/lib/gs1.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import BarcodeScannerDialog from "@/components/barcode-scanner-dialog.tsx";
import { useScannerInput } from "@/hooks/use-scanner-input.ts";
import { useConfirm } from "@/hooks/use-confirm.ts";
import type { MovementKind } from "@/convex/lib/stock.ts";
import type {
  MovementFormInput,
  MovementFormValues,
} from "./movement-form-schema.ts";

type Props = {
  kind: MovementKind;
  packageBarcode: string;
  // Months ahead that count as "expiring soon" (from Settings)
  warningMonths: number;
  // Expiry from the scan that found the medicine, if it was already expired
  scannedExpired: string | null;
  // Required only while "Fill canister" is on
  required: boolean;
};

const inputClass = "h-10 bg-background";

const showDay = (day: string) => format(parseISO(day), "d MMM yyyy");

// Batch and Expiry on Stock In and Stock Out, with a GS1 scan box that fills both
export default function BatchExpiryFields({
  kind,
  packageBarcode,
  warningMonths,
  scannedExpired,
  required,
}: Props) {
  const form = useFormContext<MovementFormInput, unknown, MovementFormValues>();
  const expiry = useWatch({ control: form.control, name: "expiry" });
  const mismatchedScan = useWatch({
    control: form.control,
    name: "mismatchedScan",
  });
  // Last scanned expiry that was refused because it had passed
  const [expiredScan, setExpiredScan] = useState(scannedExpired);
  const today = toCalendarDay(new Date());
  const status = isCalendarDay(expiry)
    ? expiryStatus(expiry, today, warningMonths)
    : null;
  const optional = required ? "" : " (optional)";

  return (
    <div className="space-y-3">
      <Gs1ScanBox
        kind={kind}
        packageBarcode={packageBarcode}
        onExpired={setExpiredScan}
      />
      {mismatchedScan && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-700 dark:text-orange-300"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Using a scanned code that did not match this package. It will be
            noted in the Log.
          </span>
        </div>
      )}
      {expiredScan && !expiry && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            The scanned stock expired on {showDay(expiredScan)}. Expired stock
            cannot be used. Please use another box.
          </span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="batch"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Batch{optional}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g. 50803-3"
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="expiry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expiry{optional}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="date"
                  min={today}
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
              {status === "soon" && !form.formState.errors.expiry && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  Expiring soon (within {warningMonths} month
                  {warningMonths === 1 ? "" : "s"})
                </p>
              )}
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

// Scan the box's GS1 code here to fill Batch and Expiry
function Gs1ScanBox({
  kind,
  packageBarcode,
  onExpired,
}: {
  kind: MovementKind;
  packageBarcode: string;
  onExpired: (expiry: string | null) => void;
}) {
  const form = useFormContext<MovementFormInput, unknown, MovementFormValues>();
  const confirm = useConfirm();
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const {
    inputRef,
    onKeyDown: scannerKeyDown,
    setValue: setScanned,
    display,
  } = useScannerInput(setValue);

  const apply = async (code: string) => {
    const data = parseGs1(code);
    setValue("");
    if (!data || (!data.batch && !data.expiry)) {
      toast.error("No batch or expiry found in that code", {
        description: "Scan the GS1 code (the square DataMatrix) on the box.",
      });
      return;
    }
    const mismatch =
      !!data.gtin &&
      !!packageBarcode &&
      !barcodesMatch(data.gtin, packageBarcode);
    if (mismatch) {
      // Some makers print a different product code in the square code than on
      // the ordinary barcode, so let the user decide
      const ok = await confirm({
        title: "This code doesn't match the selected package",
        description: `The scanned product code (${data.gtin}) is different from this package form's barcode (${packageBarcode}). Check it is the right box. If you continue, the ${kind === "in" ? "Stock In" : "Stock Out"} will be marked "Scanned code did not match" and the scan will be saved in the Log.`,
        confirmLabel: "Continue anyway",
        cancelLabel: "Cancel and scan again",
      });
      if (!ok) {
        inputRef.current?.focus();
        return;
      }
    }
    const opts = { shouldDirty: true, shouldValidate: true };
    form.setValue("mismatchedScan", mismatch ? code : "", {
      shouldDirty: true,
    });
    if (data.batch) form.setValue("batch", data.batch, opts);
    if (data.expiry && data.expiry < toCalendarDay(new Date())) {
      // Expired: keep Expiry empty so this box can't be recorded with it
      form.setValue("expiry", "", { shouldDirty: true });
      onExpired(data.expiry);
      toast.error("This stock has expired", {
        description: `Expired on ${showDay(data.expiry)}. It cannot be used.`,
      });
      return;
    }
    onExpired(null);
    if (data.expiry) form.setValue("expiry", data.expiry, opts);
    toast.success("Batch and expiry filled from scan");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const rebuilt = scannerKeyDown(e);
    if (e.key !== "Enter") return;
    // Enter here fills the fields; it must not record the movement
    e.preventDefault();
    const code = rebuilt ?? e.currentTarget.value;
    if (code.trim()) void apply(code);
  };

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        value={display(value)}
        onChange={(e) => setScanned(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scan GS1 code to fill batch and expiry"
        aria-label="Scan GS1 code to fill batch and expiry"
        className={inputClass}
      />
      <Button
        type="button"
        variant="secondary"
        className="h-10 shrink-0"
        onClick={() => setCamera(true)}
        aria-label="Scan with camera"
      >
        <Camera />
      </Button>
      <BarcodeScannerDialog
        open={camera}
        onOpenChange={setCamera}
        onDetected={(code) => {
          setCamera(false);
          void apply(code);
        }}
      />
    </div>
  );
}
