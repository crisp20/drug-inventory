import { Keyboard } from "lucide-react";

// Shown when a scan still looks wrong, usually because a Chinese keyboard is switched on
export default function ScanKeyboardWarning() {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <Keyboard className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">This scan may not have read correctly.</p>
        <p>Switch your keyboard to English (A) and scan again.</p>
        <p className="pt-0.5 opacity-90">
          掃描可能有誤。請將鍵盤切換為英文 (A)，然後重新掃描。
        </p>
      </div>
    </div>
  );
}
