import { useQuery } from "convex/react";
import { RotateCcw } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { ACTIVITY_CATEGORIES } from "@/convex/lib/activity.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select.tsx";
import MedicineFilter from "@/components/stock/medicine-filter.tsx";
import { PERIODS } from "@/components/stock/movement-period.ts";
import type { LogFilters } from "../_lib/log-filters.ts";

type Props = {
  value: LogFilters;
  onChange: (next: LogFilters) => void;
  onReset: () => void;
  isFiltered: boolean;
};

const selectClass = "h-9 cursor-pointer bg-card";

export default function LogFilterBar({
  value,
  onChange,
  onReset,
  isFiltered,
}: Props) {
  const people = useQuery(api.users.listPeople, {});
  const set = (patch: Partial<LogFilters>) => onChange({ ...value, ...patch });
  const { period } = value;

  return (
    <div className="space-y-2 rounded-xl border bg-muted/40 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Time period"
          className={selectClass}
          value={period.value}
          onChange={(e) => {
            const next = PERIODS.find((p) => p.value === e.target.value);
            if (next) set({ period: { ...period, value: next.value } });
          }}
        >
          {PERIODS.map((p) => (
            <NativeSelectOption key={p.value} value={p.value}>
              {p.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          aria-label="Activity type"
          className={selectClass}
          value={value.category}
          onChange={(e) => {
            const c = ACTIVITY_CATEGORIES.find(
              (x) => x.value === e.target.value,
            );
            set({ category: c?.value ?? "all" });
          }}
        >
          <NativeSelectOption value="all">All activity</NativeSelectOption>
          {ACTIVITY_CATEGORIES.map((c) => (
            <NativeSelectOption key={c.value} value={c.value}>
              {c.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          aria-label="User"
          className={selectClass}
          value={value.userId}
          onChange={(e) => {
            const id = people?.find((p) => p._id === e.target.value)?._id;
            set({ userId: id ?? "all" });
          }}
        >
          <NativeSelectOption value="all">Everyone</NativeSelectOption>
          {(people ?? []).map((p) => (
            <NativeSelectOption key={p._id} value={p._id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <MedicineFilter
          value={value.medicine}
          onChange={(drug) => set({ medicine: drug })}
        />

        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onReset}
          >
            <RotateCcw className="size-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {period.value === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">From</span>
          <Input
            type="date"
            aria-label="From date"
            className="h-9 w-auto bg-card"
            value={period.from}
            max={period.to || undefined}
            onChange={(e) =>
              set({ period: { ...period, from: e.target.value } })
            }
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To date"
            className="h-9 w-auto bg-card"
            value={period.to}
            min={period.from || undefined}
            onChange={(e) => set({ period: { ...period, to: e.target.value } })}
          />
        </div>
      )}
    </div>
  );
}
