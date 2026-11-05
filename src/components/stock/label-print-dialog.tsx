import { useEffect, useRef, useState } from "react";
import { Bluetooth, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  bluetoothSupported,
  connectPrinter,
  forgetPrinter,
  printerConnected,
  printerName,
} from "@/lib/label/bluetooth-printer.ts";
import type { LabelData } from "@/lib/label/label-data.ts";
import {
  printCanvasBluetooth,
  printCanvasWindow,
} from "@/lib/label/print-label.ts";
import { renderLabel } from "@/lib/label/render-label.ts";
import { errorMessage } from "@/lib/errors.ts";

type Status =
  | { state: "drawing" }
  | { state: "ready" }
  | { state: "printing" }
  | { state: "printed" }
  | { state: "failed"; message: string };

type Props = {
  data: LabelData | null;
  onClose: () => void;
};

// Shown after a canister Stock Out is recorded: previews the label and prints it.
// Prints straight away when a Bluetooth printer is already connected.
export default function LabelPrintDialog({ data, onClose }: Props) {
  return (
    <Dialog open={data !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {data && <LabelPrinter key={JSON.stringify(data)} data={data} />}
      </DialogContent>
    </Dialog>
  );
}

function LabelPrinter({ data }: { data: LabelData }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ state: "drawing" });
  const canBluetooth = bluetoothSupported();

  const printBluetooth = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus({ state: "printing" });
    try {
      await connectPrinter();
      await printCanvasBluetooth(canvas);
      setStatus({ state: "printed" });
      toast.success("Label sent to the printer");
    } catch (e) {
      // Closing the printer list is not an error worth shouting about
      const cancelled = e instanceof DOMException && e.name === "NotFoundError";
      setStatus({
        state: "failed",
        message: cancelled
          ? "No printer was chosen."
          : errorMessage(e, "Could not print the label"),
      });
    }
  };

  const printWindow = () => {
    if (!canvasRef.current) return;
    try {
      printCanvasWindow(canvasRef.current);
    } catch (e) {
      toast.error(errorMessage(e, "Could not open the print window"));
    }
  };

  // Draw once, then print right away if the printer is still connected
  useEffect(() => {
    let cancelled = false;
    void renderLabel(data).then(async (canvas) => {
      if (cancelled) return;
      canvasRef.current = canvas;
      setPreview(canvas.toDataURL("image/png"));
      if (!printerConnected()) {
        setStatus({ state: "ready" });
        return;
      }
      setStatus({ state: "printing" });
      try {
        await printCanvasBluetooth(canvas);
        if (!cancelled) setStatus({ state: "printed" });
      } catch (e) {
        if (!cancelled)
          setStatus({
            state: "failed",
            message: errorMessage(e, "Could not print the label"),
          });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const busy = status.state === "drawing" || status.state === "printing";
  const name = printerName();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Stock Out recorded. Print the label</DialogTitle>
        <DialogDescription>
          {status.state === "printed"
            ? `Label printed${name ? ` on ${name}` : ""}.`
            : status.state === "printing"
              ? "Printing…"
              : canBluetooth
                ? "Connect the HPRT label printer by Bluetooth, or use the print window."
                : "This browser can't connect by Bluetooth. Use the print window with the printer paired to this device."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex justify-center rounded-lg bg-muted p-3">
        {preview ? (
          <img
            src={preview}
            alt="Label preview"
            className="h-[300px] w-[200px] rounded-sm bg-white shadow-sm [image-rendering:pixelated]"
          />
        ) : (
          <div className="flex h-[300px] w-[200px] items-center justify-center">
            <Spinner />
          </div>
        )}
      </div>

      {status.state === "failed" && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status.message} The Stock Out is saved. Try again or use the print
          window.
        </p>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={printWindow}
          disabled={!preview}
        >
          <Printer />
          Print window
        </Button>
        {canBluetooth && (
          <div className="flex gap-2">
            {name && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Choose a different printer"
                disabled={busy}
                onClick={() => {
                  forgetPrinter();
                  void printBluetooth();
                }}
              >
                <RotateCcw />
              </Button>
            )}
            <Button
              type="button"
              onClick={() => void printBluetooth()}
              disabled={busy}
            >
              {status.state === "printing" ? <Spinner /> : <Bluetooth />}
              {status.state === "printed" || status.state === "failed"
                ? "Reprint"
                : printerConnected()
                  ? "Print"
                  : "Connect printer & print"}
            </Button>
          </div>
        )}
      </DialogFooter>
    </>
  );
}
