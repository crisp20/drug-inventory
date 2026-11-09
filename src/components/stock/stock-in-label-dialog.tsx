import { useEffect, useRef, useState } from "react";
import {
  Bluetooth,
  Minus,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
} from "lucide-react";
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
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import {
  bluetoothSupported,
  connectPrinter,
  forgetPrinter,
  printerConnected,
  printerName,
} from "@/lib/label/bluetooth-printer.ts";
import {
  isLabelOrientation,
  isLabelSizeId,
  LABEL_ORIENTATIONS,
  LABEL_SIZES,
  loadLabelOrientation,
  loadStockInLabelSize,
  saveLabelOrientation,
  saveStockInLabelSize,
  STOCK_IN_LABEL_SIZES,
  type LabelOrientation,
  type LabelSizeId,
} from "@/lib/label/label-sizes.ts";
import {
  printCanvasBluetooth,
  printCanvasesWindow,
} from "@/lib/label/print-label.ts";
import {
  drawStockInLabels,
  type DrawnStockInLabels,
  type StockInLabelChoice,
} from "@/lib/label/stock-in-set.ts";
import {
  bagLabelRanges,
  describeBagRange,
  type BagRange,
} from "@/lib/label/bag-label.ts";
import { PREVIEW_CLASS, TOGGLE_ITEM_CLASS } from "@/lib/label/preview-class.ts";
import {
  MAX_LABEL_COPIES,
  type StockInLabelData,
} from "@/lib/label/stock-in-label.ts";
import { errorMessage } from "@/lib/errors.ts";
import LabelPreview from "./label-preview.tsx";

type Status =
  | { state: "drawing" }
  | { state: "ready" }
  | { state: "printing" }
  | { state: "printed"; total: number }
  | { state: "failed"; message: string };

type Props = {
  data: StockInLabelData | null;
  choice: StockInLabelChoice;
  // Starting number of Medicine Labels (usually the quantity received)
  copies: number;
  // Quantity received, which sets the bag label numbers (16 gives 1-15 and 16)
  quantity: number;
  title: string;
  // Saves the Stock In before the first print; false means saving failed
  onSave?: () => Promise<boolean>;
  // Back to the form to change the entry (not offered on reprints)
  onEdit?: () => void;
  onClose: () => void;
};

// Previews the Stock In labels (Medicine Label and/or Medicine Bag Label) and
// prints them. Never prints by itself, so the count can be checked first.
export default function StockInLabelDialog({
  data,
  choice,
  copies,
  quantity,
  title,
  onSave,
  onEdit,
  onClose,
}: Props) {
  return (
    <Dialog open={data !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-md">
        {data && (
          <StockInLabelPrinter
            key={JSON.stringify({ data, choice, quantity })}
            data={data}
            choice={choice}
            initialCopies={copies}
            quantity={quantity}
            title={title}
            onSave={onSave}
            onEdit={onEdit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function clampCopies(n: number): number {
  return Math.min(MAX_LABEL_COPIES, Math.max(1, Math.floor(n) || 1));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function StockInLabelPrinter({
  data,
  choice,
  initialCopies,
  quantity,
  title,
  onSave,
  onEdit,
}: {
  data: StockInLabelData;
  choice: StockInLabelChoice;
  initialCopies: number;
  quantity: number;
  title: string;
  onSave?: () => Promise<boolean>;
  onEdit?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  // Saves the entry (once) before printing; returns false if it couldn't be saved
  const saveFirst = async (): Promise<boolean> => {
    if (!onSave) return true;
    setSaving(true);
    try {
      return await onSave();
    } finally {
      setSaving(false);
    }
  };
  const drawnRef = useRef<DrawnStockInLabels | null>(null);
  const [previews, setPreviews] = useState<
    DrawnStockInLabels["previews"] | null
  >(null);
  const [status, setStatus] = useState<Status>({ state: "drawing" });
  const [sizeId, setSizeId] = useState<LabelSizeId>(loadStockInLabelSize);
  const size = LABEL_SIZES[sizeId];
  const [orientation, setOrientation] = useState<LabelOrientation>(() =>
    loadLabelOrientation(sizeId),
  );
  // Kept as typed text so the box can be cleared while typing
  const [copiesText, setCopiesText] = useState(
    String(clampCopies(initialCopies)),
  );
  const copies = choice.medicine ? clampCopies(Number(copiesText)) : 0;
  const [ranges] = useState(() => bagLabelRanges(quantity));
  const bagCount = choice.bag ? ranges.length : 0;
  const total = copies + bagCount;
  const canBluetooth = bluetoothSupported();
  // Plain booleans so a new choice object doesn't redraw the labels
  const showMedicine = choice.medicine;
  const showBag = choice.bag;

  const redraw = () => {
    setPreviews(null);
    setStatus({ state: "drawing" });
  };

  const changeSize = (value: string) => {
    if (!isLabelSizeId(value) || value === sizeId) return;
    saveStockInLabelSize(value);
    redraw();
    setSizeId(value);
    // Each size keeps its own direction
    setOrientation(loadLabelOrientation(value));
  };

  const changeOrientation = (value: string) => {
    if (!isLabelOrientation(value) || value === orientation) return;
    saveLabelOrientation(sizeId, value);
    redraw();
    setOrientation(value);
  };

  useEffect(() => {
    let cancelled = false;
    const wanted = { medicine: showMedicine, bag: showBag };
    void drawStockInLabels(data, wanted, ranges, sizeId, orientation).then(
      (drawn) => {
        if (cancelled) return;
        drawnRef.current = drawn;
        setPreviews(drawn.previews);
        setStatus({ state: "ready" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [data, showMedicine, showBag, ranges, sizeId, orientation]);

  const printBluetooth = async () => {
    const drawn = drawnRef.current;
    if (!drawn) return;
    if (!(await saveFirst())) return;
    setStatus({ state: "printing" });
    try {
      await connectPrinter();
      // Medicine Labels repeat on the printer; each bag label is different
      if (drawn.medicine) await printCanvasBluetooth(drawn.medicine, copies);
      for (const bag of drawn.bags) await printCanvasBluetooth(bag, 1);
      setStatus({ state: "printed", total });
      toast.success(`${plural(total, "label")} sent to the printer`);
    } catch (e) {
      const cancelled = e instanceof DOMException && e.name === "NotFoundError";
      setStatus({
        state: "failed",
        message: cancelled
          ? "No printer was chosen."
          : errorMessage(e, "Could not print the labels"),
      });
    }
  };

  const printWindow = async () => {
    const drawn = drawnRef.current;
    if (!drawn) return;
    if (!(await saveFirst())) return;
    try {
      const medicine = drawn.medicine;
      printCanvasesWindow([
        ...(medicine ? Array.from({ length: copies }, () => medicine) : []),
        ...drawn.bags,
      ]);
    } catch (e) {
      toast.error(errorMessage(e, "Could not open the print window"));
    }
  };

  const busy =
    saving || status.state === "drawing" || status.state === "printing";
  const name = printerName();
  const previewClass = PREVIEW_CLASS[sizeId][orientation];
  const summary = [
    choice.medicine && plural(copies, "Medicine Label"),
    choice.bag && plural(bagCount, "Medicine Bag Label"),
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {status.state === "printed"
            ? `${plural(status.total, "label")} printed${name ? ` on ${name}` : ""}.`
            : status.state === "printing"
              ? "Printing…"
              : onSave
                ? "Not saved yet. The Stock In is saved when you print. Use Edit to change the entry."
                : `${size.name} labels. ${canBluetooth ? "Connect the HPRT printer by Bluetooth, or use the print window." : "Use the print window with the printer paired to this device."}`}
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
          {STOCK_IN_LABEL_SIZES.map((id) => (
            <ToggleGroupItem key={id} value={id} className={TOGGLE_ITEM_CLASS}>
              {LABEL_SIZES[id].name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {choice.medicine && (
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="label-copies" className="text-sm font-medium">
            Medicine Labels
          </label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="One fewer label"
              disabled={copies <= 1 || status.state === "printing"}
              onClick={() => setCopiesText(String(clampCopies(copies - 1)))}
            >
              <Minus />
            </Button>
            <Input
              id="label-copies"
              value={copiesText}
              inputMode="numeric"
              maxLength={3}
              onChange={(e) => setCopiesText(e.target.value.replace(/\D/g, ""))}
              onBlur={() => setCopiesText(String(copies))}
              onFocus={(e) => e.target.select()}
              className="h-9 w-16 text-center text-lg font-bold"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="One more label"
              disabled={
                copies >= MAX_LABEL_COPIES || status.state === "printing"
              }
              onClick={() => setCopiesText(String(clampCopies(copies + 1)))}
            >
              <Plus />
            </Button>
          </div>
        </div>
      )}

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

      <div className="space-y-3 rounded-lg bg-muted p-3">
        {choice.medicine && (
          <LabelPreview
            caption={`Medicine Label × ${copies}`}
            src={previews?.medicine ?? null}
            alt={`Medicine Label preview, ${size.name}, ${orientation}`}
            className={previewClass}
          />
        )}
        {choice.bag &&
          ranges.map((r, i) => (
            <LabelPreview
              key={r.start}
              caption={`Medicine Bag Label ${i + 1} of ${ranges.length} (${describeBagRange(r)})`}
              src={previews?.bags[i] ?? null}
              alt={`Medicine Bag Label preview, numbers ${describeBagRange(r)}`}
              className={previewClass}
            />
          ))}
      </div>

      {status.state === "failed" && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status.message} Try again or use the print window.
        </p>
      )}

      <p className="text-center text-sm font-medium">{summary}</p>

      <DialogFooter className="gap-2 sm:justify-between">
        <div className="flex gap-2">
          {onEdit && (
            <Button
              type="button"
              variant="secondary"
              onClick={onEdit}
              disabled={saving || status.state === "printing"}
            >
              <Pencil />
              Edit
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => void printWindow()}
            disabled={!previews || saving}
          >
            {saving ? <Spinner /> : <Printer />}
            Print window
          </Button>
        </div>
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
                ? `Print ${total} again`
                : printerConnected()
                  ? `Print ${total}`
                  : `Connect & print ${total}`}
            </Button>
          </div>
        )}
      </DialogFooter>
    </>
  );
}
