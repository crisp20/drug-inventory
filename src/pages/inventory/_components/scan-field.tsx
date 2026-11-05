import { forwardRef, type KeyboardEvent } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import ScanKeyboardWarning from "@/components/scan-keyboard-warning.tsx";
import { useScannerInput } from "@/hooks/use-scanner-input.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Called on Enter/Tab with the final (scanner-corrected) value
  onEnter: (value: string) => void;
  onCamera: () => void;
  className?: string;
};

// One barcode box that reads scanners correctly even with a Chinese keyboard on
const ScanField = forwardRef<HTMLInputElement, Props>(function ScanField(
  { label, value, onChange, onEnter, onCamera, className },
  ref,
) {
  const { inputRef, onKeyDown, setValue, display, warning } =
    useScannerInput(onChange);

  const setRefs = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const scanned = onKeyDown(e);
    // Barcode scanners type the code then press Enter; move along instead of submitting the form.
    // With a Chinese keyboard on, e.key can be "Process", so also check the physical key.
    if (e.key !== "Enter" && e.code !== "Enter" && e.code !== "NumpadEnter")
      return;
    e.preventDefault();
    onEnter(scanned ?? e.currentTarget.value);
  };

  return (
    <div className="flex-1 space-y-2">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent-foreground/70" />
          <Input
            ref={setRefs}
            value={display(value)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={label}
            aria-label={label}
            className={cn(
              "h-11 border-accent-foreground/20 bg-accent pl-9 font-mono text-accent-foreground placeholder:text-accent-foreground/60",
              className,
            )}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-11"
          onClick={onCamera}
          aria-label={`Use camera for ${label.toLowerCase()}`}
        >
          <ScanLine />
        </Button>
      </div>
      {warning && <ScanKeyboardWarning />}
    </div>
  );
});

export default ScanField;
