import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  SCAN_END_MS,
  addKey,
  hasNonAscii,
  isModifierCode,
  keyFromCode,
  scanResult,
  type Burst,
} from "@/lib/scanner-input.ts";

const END_KEYS = new Set(["Enter", "NumpadEnter", "Tab"]);
// Leftover text an input method commits right after a scan is ignored for this long
const SETTLE_MS = 150;

// Makes scanner input correct even when a Chinese (or other) keyboard is switched on.
// While keys are still arriving, the text is held in the box and only handed on once
// typing pauses, so a half-scanned code never triggers a search (and a jump to the
// quantity box) before the scanner has finished.
export function useScannerInput(onChange: (value: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const burstRef = useRef<Burst | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const settleUntilRef = useRef(0);
  const draftRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const setDraftValue = useCallback((value: string | null) => {
    draftRef.current = value;
    setDraft(value);
  }, []);

  // Ends the current burst. Returns the rebuilt code if it was a scan.
  const finish = useCallback((): string | null => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    const result = scanResult(burstRef.current);
    burstRef.current = null;
    const pending = draftRef.current;
    setDraftValue(null);
    if (!result) {
      // Normal typing: hand on whatever was typed
      if (pending !== null) onChange(pending);
      return null;
    }
    settleUntilRef.current = performance.now() + SETTLE_MS;
    const input = inputRef.current;
    // Blur + focus ends any half-typed Chinese word so it can't overwrite the code
    if (input && input.value !== result.text) {
      input.blur();
      input.focus();
    }
    onChange(result.text);
    setWarning(result.incomplete || hasNonAscii(result.text));
    return result.text;
  }, [onChange, setDraftValue]);

  // Returns the rebuilt code when Enter/Tab ends a scan, so callers can act on the right value
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): string | null => {
      if (END_KEYS.has(e.code) || e.key === "Enter") return finish();
      if (isModifierCode(e.code)) return null;
      const char =
        e.code === ""
          ? null
          : keyFromCode(e.code, {
              shift: e.shiftKey,
              ctrl: e.ctrlKey,
              capsLock: e.getModifierState("CapsLock"),
            });
      // Arrows, Backspace etc. mean a person is editing, not a scanner
      if (char === null && e.code !== "") {
        burstRef.current = null;
        return null;
      }
      burstRef.current = addKey(
        burstRef.current,
        char,
        e.timeStamp,
        e.currentTarget.value,
      );
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(finish, SCAN_END_MS);
      return null;
    },
    [finish],
  );

  // Use for the input's onChange and for clear/camera actions
  const setValue = useCallback(
    (value: string) => {
      if (performance.now() < settleUntilRef.current) return;
      setWarning(false);
      // Keys still arriving: hold the text until the burst ends
      if (timerRef.current !== undefined) setDraftValue(value);
      else onChange(value);
    },
    [onChange, setDraftValue],
  );

  // What the box should show: the held text while typing, otherwise the real value
  const display = useCallback((value: string) => draft ?? value, [draft]);

  return { inputRef, onKeyDown, setValue, display, warning };
}
