import { useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import DrugImage from "@/components/drug-image.tsx";
import ZoomableDrugImage from "@/components/zoomable-drug-image.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { cn } from "@/lib/utils.ts";

export type LookAlikeOption = {
  _id: Id<"drugs">;
  drugId: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
};

type Props = {
  // The drug being edited (left out of the results); undefined when adding a new drug
  selfId?: Id<"drugs">;
  value: LookAlikeOption[];
  onChange: (value: LookAlikeOption[]) => void;
};

const MAX_LINKS = 20;

// Search and link the drugs this one looks or sounds like
export default function LookAlikePicker({ selfId, value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [term] = useDebounce(search.trim(), 250);
  const results = useQuery(api.drugs.search, term ? { term } : "skip");
  const chosen = new Set(value.map((d) => d._id));
  const options = (results ?? []).filter((d) => d._id !== selfId && !chosen.has(d._id)).slice(0, 8);

  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Keep the highlight inside the list when results shrink
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));

  const add = (d: LookAlikeOption) => {
    onChange([
      ...value,
      { _id: d._id, drugId: d.drugId, name: d.name, brandName: d.brandName, imageUrl: d.imageUrl },
    ]);
    setSearch("");
    setActive(0);
  };

  const moveTo = (index: number) => {
    setActive(index);
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  };

  // Arrow keys move the highlight, Enter adds it (and never submits the drug form)
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (term && options.length > 0) add(options[activeIndex]);
      return;
    }
    if (e.key === "Escape" && search) {
      e.preventDefault();
      e.stopPropagation();
      setSearch("");
      return;
    }
    if (!term || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveTo((activeIndex + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveTo((activeIndex - 1 + options.length) % options.length);
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {value.map((d) => (
            <div key={d._id} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-1.5 pr-1">
              <ZoomableDrugImage url={d.imageUrl} alt={d.name} className="size-12" hoverPreview />
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-medium">{d.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {d.brandName && <>{d.brandName} · </>}
                  <span className="font-mono">{d.drugId}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x._id !== d._id))}
                className="cursor-pointer self-start rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${d.name}`}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {value.length < MAX_LINKS && (
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search a similar drug by name, brand or Drug ID"
        />
      )}
      {term && (
        <div ref={listRef} className="max-h-72 overflow-y-auto rounded-lg border">
          {results === undefined ? (
            <div className="flex justify-center p-3">
              <Spinner />
            </div>
          ) : options.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No other drugs match “{term}”.</p>
          ) : (
            options.map((d, i) => (
              <button
                key={d._id}
                type="button"
                data-index={i}
                onClick={() => add(d)}
                onMouseMove={() => setActive(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0",
                  i === activeIndex && "bg-muted",
                )}
              >
                <Plus className="size-4 shrink-0 text-primary" />
                <DrugImage url={d.imageUrl} alt={d.name} className="size-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.name}</span>
                  {d.brandName && (
                    <span className="block truncate text-xs text-muted-foreground">{d.brandName}</span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{d.drugId}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
