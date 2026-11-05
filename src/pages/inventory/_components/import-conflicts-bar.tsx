import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import type { Choice } from "../_lib/import-choices.ts";

type Props = {
  total: number;
  selected: number;
  useFileCount: number;
  onSelectAll: (on: boolean) => void;
  // Applies to the selected conflicts, or to all of them when none are selected
  onApply: (c: Choice) => void;
};

// Bulk actions above the conflict cards: tick cards, then decide for all ticked ones at once
export default function ImportConflictsBar({ total, selected, useFileCount, onSelectAll, onApply }: Props) {
  const some = selected > 0;
  const allTicked = selected === total;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-2 text-sm">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox
          checked={allTicked ? true : some ? "indeterminate" : false}
          onCheckedChange={() => onSelectAll(!allTicked)}
          aria-label="Select all conflicts"
        />
        <span>
          {some
            ? `${selected} selected`
            : `${useFileCount} of ${total} will use the file`}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {some && (
          <Button size="sm" variant="ghost" onClick={() => onSelectAll(false)}>
            Clear
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => onApply("keep")}>
          {some ? "Keep selected current" : "Keep all current"}
        </Button>
        <Button size="sm" onClick={() => onApply("file")}>
          {some ? "Use file for selected" : "Use file for all"}
        </Button>
      </div>
    </div>
  );
}
