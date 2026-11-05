import { useQuery } from "convex/react";
import { RotateCcw } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import { STOCK_OUT_REASONS, type MovementKind } from "@/convex/lib/stock.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select.tsx";
import type { DrugWithDetails } from "@/lib/drug-types.ts";
import MedicineFilter from "./medicine-filter.tsx";
import { PERIODS, type Period } from "./movement-period.ts";

export type MovementFilters = {
  period: Period;
  userId: Id<"users"> | "all";
  reason: string;
  medicine: DrugWithDetails | null;
  packageId: Id<"drugPackages"> | "all";
};

type Props = {
  // Undefined: Stock In and Stock Out together
  kind?: MovementKind;
  value: MovementFilters;
  onChange: (next: MovementFilters) => void;
  onReset: () => void;
  isFiltered: boolean;
  // Hidden where the list is already about one medicine
  showMedicine?: boolean;
};

const selectClass = "h-9 cursor-pointer bg-card";

// Time period, user, medicine, package form and (Stock Out) reason filters
export default function MovementFilterBar({
  kind,
  value,
  onChange,
  onReset,
  isFiltered,
  showMedicine = true,
}: Props) {
  const people = useQuery(api.users.listPeople, {});
  const set = (patch: Partial<MovementFilters>) =>
    onChange({ ...value, ...patch });
  const { period, medicine } = value;

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

        {showMedicine && (
          <MedicineFilter
            value={medicine}
            onChange={(drug) => set({ medicine: drug, packageId: "all" })}
          />
        )}

        {showMedicine && medicine && medicine.packages.length > 0 && (
          <NativeSelect
            aria-label="Package form"
            className={selectClass}
            value={value.packageId}
            onChange={(e) => {
              const id = medicine.packages.find(
                (p) => p._id === e.target.value,
              )?._id;
              set({ packageId: id ?? "all" });
            }}
          >
            <NativeSelectOption value="all">
              All package forms
            </NativeSelectOption>
            {medicine.packages.map((p) => (
              <NativeSelectOption key={p._id} value={p._id}>
                {formatPackageForm(p)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}

        {kind !== "in" && (
          <NativeSelect
            aria-label="Reason"
            className={selectClass}
            value={value.reason}
            onChange={(e) => set({ reason: e.target.value })}
          >
            <NativeSelectOption value="all">All reasons</NativeSelectOption>
            {STOCK_OUT_REASONS.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {r}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}

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
