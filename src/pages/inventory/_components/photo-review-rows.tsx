import { useEffect, useMemo, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import ZoomableDrugImage from "@/components/zoomable-drug-image.tsx";
import { cn } from "@/lib/utils.ts";
import type { PhotoMatch } from "../_hooks/use-photo-import.ts";
import type { Choice } from "../_lib/import-choices.ts";
import { ChoicePair } from "./import-conflict-card.tsx";

// Preview link for a picked photo; released when the row leaves the screen so memory stays low
function useObjectUrl(file: File) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return url;
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {children}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function DrugLabel({ m }: { m: PhotoMatch }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate font-medium">{m.name}</div>
      <div className="truncate text-xs text-muted-foreground">
        Drug ID {m.drugId} · {m.fileName}
      </div>
    </div>
  );
}

export function AddPhotoRow({ m }: { m: PhotoMatch }) {
  const url = useObjectUrl(m.file);
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2 text-sm">
      <ZoomableDrugImage url={url} alt={`${m.name} (new)`} className="size-14" hoverPreview />
      <DrugLabel m={m} />
    </div>
  );
}

export function ReplacePhotoRow({
  m,
  choice,
  onChoose,
  selected,
  onSelectedChange,
}: {
  m: PhotoMatch;
  choice: Choice;
  onChoose: (c: Choice) => void;
  selected: boolean;
  onSelectedChange: (on: boolean) => void;
}) {
  const url = useObjectUrl(m.file);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border p-2 text-sm transition-colors",
        selected && "border-primary bg-primary/5",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(on) => onSelectedChange(on === true)}
        aria-label={`Select ${m.name}`}
      />
      <div className="flex items-center gap-2">
        <Labeled label="Current">
          <div className={cn("transition-opacity", choice === "file" && "opacity-50")}>
            <ZoomableDrugImage url={m.photoUrl} alt={`${m.name} (current)`} className="size-14" hoverPreview />
          </div>
        </Labeled>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        <Labeled label="New">
          <div className={cn("transition-opacity", choice === "keep" && "opacity-50")}>
            <ZoomableDrugImage url={url} alt={`${m.name} (new)`} className="size-14" hoverPreview />
          </div>
        </Labeled>
      </div>
      <DrugLabel m={m} />
      <ChoicePair choice={choice} onChoose={onChoose} />
    </div>
  );
}
