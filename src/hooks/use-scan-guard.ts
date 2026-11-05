import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import {
  SCAN_END_MS,
  addKey,
  isModifierCode,
  keyFromCode,
  scanResult,
  type Burst,
} from "@/lib/scanner-input.ts";

// For boxes meant for typing by hand (e.g. quantity). If scanner-speed typing arrives,
// further keys (including the scanner's Enter) are blocked, and once the burst ends
// `onBlocked` gets the value the box had before the scan so it can be put back.
export function useScanGuard(onBlocked: (valueBefore: string) => void) {
  const burstRef = useRef<Burst | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const blockedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const end = useCallback(() => {
    window.clearTimeout(timerRef.current);
    const burst = burstRef.current;
    const blocked = blockedRef.current;
    burstRef.current = null;
    blockedRef.current = false;
    if (!blocked || !burst) return;
    // Ends any half-typed Chinese word so it can't land in the box afterwards
    inputRef.current?.blur();
    onBlocked(burst.prefix);
  }, [onBlocked]);

  return useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      inputRef.current = e.currentTarget;
      const isEnter =
        e.code === "Enter" || e.code === "NumpadEnter" || e.key === "Enter";
      if (isEnter) {
        // Stop the scanner's Enter from submitting the scanned number
        if (blockedRef.current) {
          e.preventDefault();
          end();
        }
        return;
      }
      if (isModifierCode(e.code)) return;
      const char =
        e.code === ""
          ? null
          : keyFromCode(e.code, {
              shift: e.shiftKey,
              ctrl: e.ctrlKey,
              capsLock: e.getModifierState("CapsLock"),
            });
      if (char === null && e.code !== "") {
        burstRef.current = null;
        return;
      }
      burstRef.current = addKey(
        burstRef.current,
        char,
        e.timeStamp,
        e.currentTarget.value,
      );
      if (scanResult(burstRef.current)) {
        blockedRef.current = true;
        e.preventDefault();
      }
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(end, SCAN_END_MS);
    },
    [end],
  );
}
