import { useCallback, useEffect, useState } from "react";
import { ScanLine, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { useScannerInput } from "@/hooks/use-scanner-input.ts";
import BarcodeScannerDialog from "./barcode-scanner-dialog.tsx";
import ScanKeyboardWarning from "./scan-keyboard-warning.tsx";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  // Change this number to put the cursor back in the box (e.g. after a form is done)
  focusSignal?: number;
};

// Works with keyboards, USB/Bluetooth scanners (they type + Enter) and the camera
export default function DrugSearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  focusSignal,
}: Props) {
  const [scanning, setScanning] = useState(false);
  const { inputRef, onKeyDown, setValue, display, warning } =
    useScannerInput(onChange);
  // Focus is a DOM side effect, so it has to run after the page has re-rendered.
  // Tried again shortly after, because a closing confirm dialog hands focus back to its button.
  useEffect(() => {
    if (!focusSignal) return;
    inputRef.current?.focus();
    const retry = window.setTimeout(() => {
      const active = document.activeElement;
      if (!(
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      )) {
        inputRef.current?.focus();
      }
    }, 300);
    return () => window.clearTimeout(retry);
  }, [focusSignal, inputRef]);
  const handleDetected = useCallback(
    (code: string) => {
      setScanning(false);
      setValue(code);
    },
    [setValue],
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={display(value)}
            autoFocus={autoFocus}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => void onKeyDown(e)}
            placeholder={
              placeholder ??
              "Scan or search barcode, GS1 code, drug name, brand or Drug ID"
            }
            className="h-11 bg-card pl-9 pr-9"
          />
          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button
          type="button"
          size="lg"
          className="h-11"
          onClick={() => setScanning(true)}
        >
          <ScanLine />
          <span className="hidden sm:inline">Scan</span>
        </Button>
        <BarcodeScannerDialog
          open={scanning}
          onOpenChange={setScanning}
          onDetected={handleDetected}
        />
      </div>
      {warning && <ScanKeyboardWarning />}
    </div>
  );
}
