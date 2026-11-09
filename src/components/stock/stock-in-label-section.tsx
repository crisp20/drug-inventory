import { useWatch, type Control } from "react-hook-form";
import { Lock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form.tsx";
import DdaBadge from "@/components/dda-badge.tsx";
import { bagLabelRanges, describeBagRanges } from "@/lib/label/bag-label.ts";
import type {
  MovementFormInput,
  MovementFormValues,
} from "./movement-form-schema.ts";

type Props = {
  control: Control<MovementFormInput, unknown, MovementFormValues>;
  dangerousDrug: boolean;
  // Package forms with a barcode don't need the Medicine Label, but can opt in
  hasBarcode: boolean;
  // Quantity received, for how many bag labels will print
  quantity: number;
  onPrint: () => void;
};

type FieldName = "eight" | "labelsOn" | "bagLabelsOn";

const ROW_CLASS =
  "flex items-center gap-3 rounded-lg bg-background px-3 py-2.5";

function TickBox({
  control,
  name,
  children,
}: {
  control: Props["control"];
  name: FieldName;
  children: React.ReactNode;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={ROW_CLASS}>
          <FormControl>
            <Checkbox
              checked={field.value === true}
              onCheckedChange={(on) => field.onChange(on === true)}
              className="size-5 cursor-pointer"
            />
          </FormControl>
          <FormLabel className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-2">
            {children}
          </FormLabel>
        </FormItem>
      )}
    />
  );
}

// Two label types at Stock In:
// - Medicine Label: one per package. Always printed for package forms without a
//   barcode; optional for those with one.
// - Medicine Bag Label: optional, numbered 1-15 per label (16 gives 1-15 and 16).
// The print window opens after recording, before anything is saved.
export default function StockInLabelSection({
  control,
  dangerousDrug,
  hasBarcode,
  quantity,
  onPrint,
}: Props) {
  const labelsOn = useWatch({ control, name: "labelsOn" }) === true;
  const bagOn = useWatch({ control, name: "bagLabelsOn" }) === true;
  const medicineOn = !hasBarcode || labelsOn;
  const anyLabels = medicineOn || bagOn;
  const ranges = bagLabelRanges(Math.max(1, quantity));
  const medicineCount = Math.max(1, quantity);
  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            <Printer className="size-4 text-primary" /> Labels
            {dangerousDrug && <DdaBadge />}
          </div>
          <p className="text-xs text-muted-foreground">
            {hasBarcode
              ? "Labels are optional for this package form."
              : "This package form has no barcode, so it needs the Medicine Label."}{" "}
            {anyLabels &&
              "The print window opens after you record the Stock In."}
          </p>
        </div>
        {anyLabels && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={onPrint}
          >
            <Printer /> Preview
          </Button>
        )}
      </div>

      {hasBarcode ? (
        <TickBox control={control} name="labelsOn">
          <span className="font-medium">Medicine Label</span>
          <span className="text-xs text-muted-foreground">
            {labelsOn
              ? `${medicineCount} labels, one per package`
              : "One per package"}
          </span>
        </TickBox>
      ) : (
        // Required here, so it can't be unticked
        <div className={ROW_CLASS}>
          <Checkbox
            checked
            disabled
            className="size-5"
            aria-label="Medicine Label (required)"
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm">
            <span className="font-medium">Medicine Label</span>
            <span className="text-xs text-muted-foreground">
              {medicineCount} labels, one per package
            </span>
          </div>
          <Lock className="size-4 shrink-0 text-muted-foreground" />
        </div>
      )}

      <TickBox control={control} name="bagLabelsOn">
        <span className="font-medium">Medicine Bag Label</span>
        <span className="text-xs text-muted-foreground">
          {bagOn
            ? `${ranges.length} label${ranges.length === 1 ? "" : "s"}: ${describeBagRanges(ranges)}`
            : "15 numbers per label"}
        </span>
      </TickBox>

      {anyLabels && (
        <TickBox control={control} name="eight">
          Print
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm border-2 border-foreground px-1 text-sm font-bold">
            8
          </span>
          on the labels
        </TickBox>
      )}
    </div>
  );
}
