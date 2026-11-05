import { useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, Pill, X } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import type { DrugWithDetails } from "@/lib/drug-types.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  value: DrugWithDetails | null;
  onChange: (drug: DrugWithDetails | null) => void;
};

// Pick one medicine to filter by (search by name, brand, Drug ID or barcode)
export default function MedicineFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [term] = useDebounce(text.trim(), 200);
  // Only search while the picker is open
  const results = useQuery(api.drugs.search, open && term ? { term } : "skip");

  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const items = term && results ? results : [];
  // Keep the highlight inside the list when results shrink
  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  const pick = (drug: DrugWithDetails | null) => {
    onChange(drug);
    setOpen(false);
    setText("");
    setActive(0);
  };

  const moveTo = (index: number) => {
    setActive(index);
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  // Arrow keys move the highlight, Enter picks it
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveTo((activeIndex + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveTo((activeIndex - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(items[activeIndex]);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 max-w-56 justify-between gap-2 font-normal"
          >
            <Pill className="size-4 shrink-0" />
            <span className="truncate">
              {value ? value.name : "All medicines"}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-2 p-2">
          <Input
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search name, brand or Drug ID"
            className="h-9"
          />
          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {!term ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Type to find a medicine
              </p>
            ) : results === undefined ? (
              <div className="flex justify-center py-3">
                <Spinner />
              </div>
            ) : results.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No medicine matches “{term}”
              </p>
            ) : (
              results.map((d, i) => (
                <button
                  key={d._id}
                  type="button"
                  data-index={i}
                  onClick={() => pick(d)}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    "flex w-full cursor-pointer flex-col items-start rounded-md px-2 py-1.5 text-left",
                    i === activeIndex && "bg-muted",
                  )}
                >
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.brandName} ·{" "}
                    <span className="font-mono">{d.drugId}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => pick(null)}
          aria-label="Clear medicine filter"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
