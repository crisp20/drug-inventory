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
  orientCanvas,
  printCanvasBluetooth,
  printCanvasWindow,
} from "@/lib/label/print-label.ts";
import { renderLabel } from "@/lib/label/render-label.ts";
import {
  isLabelOrientation,
  isLabelSizeId,
  LABEL_ORIENTATIONS,
  LABEL_SIZES,
  loadLabelOrientation,
  loadLabelSize,
  saveLabelOrientation,
  saveLabelSize,
  type LabelOrientation,
  type LabelSizeId,
} from "@/lib/label/label-sizes.ts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import {
  isLabelDesignId,
  LABEL_DESIGNS,
  loadLabelDesign,
  saveLabelDesign,
  type LabelDesignId,
} from "@/lib/label/label-designs.ts";
import { errorMessage } from "@/lib/errors.ts";

// Preview boxes keep each label's shape (40x60 and 52x110) in either direction
const PREVIEW_CLASS: Record<LabelSizeId, Record<LabelOrientation, string>> = {
  "40x60": {
    portrait: "h-[300px] w-[200px]",
    landscape: "h-[200px] w-[300px]",
  },
  "52x110": {
    portrait: "h-[330px] w-[156px]",
    landscape: "h-[156px] w-[330px]",
  },
};

const TOGGLE_ITEM_CLASS =
  "cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

type Status =
  | { state: "drawing" }
  | { state: "ready" }
  | { state: "printing" }
  | { state: "printed" }
  | { state: "failed"; message: string };

type Options = {
  title?: string;
  // Print as soon as the label is drawn if a Bluetooth printer is still connected
  autoPrint?: boolean;
};

type Props = Options & {
  data: LabelData | null;
  onClose: () => void;
};

// Shown after a canister Stock Out is recorded (or for a reprint): previews the label and prints it.
export default function LabelPrintDialog({
  data,
  onClose,
  title = "Stock Out recorded. Print the label",
  autoPrint = true,
}: Props) {
  return (
    <Dialog open={data !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {data && (
          <LabelPrinter
            key={JSON.stringify(data)}
            data={data}
            title={title}
            autoPrint={autoPrint}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LabelPrinter({
  data,
  title,
  autoPrint,
}: Required<Options> & { data: LabelData }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ state: "drawing" });
  const [sizeId, setSizeId] = useState<LabelSizeId>(loadLabelSize);
  const [orientation, setOrientation] = useState<LabelOrientation>(() =>
    loadLabelOrientation(sizeId),
  );
  const [design, setDesign] = useState<LabelDesignId>(() =>
    loadLabelDesign(sizeId),
  );
  // Only the first drawing prints by itself; switching size or direction just redraws the preview
  const autoPrinted = useRef(!autoPrint);
  const size = LABEL_SIZES[sizeId];
  const canBluetooth = bluetoothSupported();

  const redraw = () => {
    setPreview(null);
    setStatus({ state: "drawing" });
  };

  const changeSize = (value: string) => {
    if (!isLabelSizeId(value) || value === sizeId) return;
    saveLabelSize(value);
    redraw();
    setSizeId(value);
    // Each size keeps its own direction and design
    setOrientation(loadLabelOrientation(value));
    setDesign(loadLabelDesign(value));
  };

  const changeDesign = (value: string) => {
    if (!isLabelDesignId(value) || value === design) return;
    saveLabelDesign(sizeId, value);
    redraw();
    setDesign(value);
  };

  const changeOrientation = (value: string) => {
    if (!isLabelOrientation(value) || value === orientation) return;
    saveLabelOrientation(sizeId, value);
    redraw();
    setOrientation(value);
  };

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

  // Draw the label, and on first draw print right away if the printer is still connected
  useEffect(() => {
    let cancelled = false;
    void renderLabel(data, LABEL_SIZES[sizeId], design).then(async (drawn) => {
      if (cancelled) return;
      const canvas = orientCanvas(drawn, orientation);
      canvasRef.current = canvas;
      setPreview(canvas.toDataURL("image/png"));
      if (autoPrinted.current || !printerConnected()) {
        setStatus({ state: "ready" });
        return;
      }
      autoPrinted.current = true;
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
  }, [data, sizeId, orientation, design]);

  const busy = status.state === "drawing" || status.state === "printing";
  const name = printerName();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
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

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Label size</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={sizeId}
          onValueChange={changeSize}
          disabled={status.state === "printing"}
        >
          {Object.values(LABEL_SIZES).map((s) => (
            <ToggleGroupItem
              key={s.id}
              value={s.id}
              className={TOGGLE_ITEM_CLASS}
            >
              {s.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Design</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={design}
          onValueChange={changeDesign}
          disabled={status.state === "printing"}
        >
          {LABEL_DESIGNS.map((d) => (
            <ToggleGroupItem
              key={d.id}
              value={d.id}
              className={TOGGLE_ITEM_CLASS}
            >
              {d.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Direction</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={orientation}
          onValueChange={changeOrientation}
          disabled={status.state === "printing"}
        >
          {LABEL_ORIENTATIONS.map((o) => (
            <ToggleGroupItem
              key={o.id}
              value={o.id}
              className={TOGGLE_ITEM_CLASS}
            >
              {o.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex justify-center rounded-lg bg-muted p-3">
        {preview ? (
          <img
            src={preview}
            alt={`Label preview, ${size.name}, ${orientation}`}
            className={`${PREVIEW_CLASS[sizeId][orientation]} rounded-sm bg-white shadow-sm [image-rendering:pixelated]`}
          />
        ) : (
          <div
            className={`${PREVIEW_CLASS[sizeId][orientation]} flex items-center justify-center`}
          >
            <Spinner />
          </div>
        )}
      </div>

      {status.state === "failed" && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status.message}
          {autoPrint ? " The Stock Out is saved." : ""} Try again or use the
          print window.
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
