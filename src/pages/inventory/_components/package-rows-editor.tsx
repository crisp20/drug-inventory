import { useFieldArray, useFormContext, useWatch, type Control } from "react-hook-form";
import { Barcode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { BASE_UNITS, defaultUnitCount } from "@/convex/lib/barcode.ts";
import { useConfirm } from "@/hooks/use-confirm.ts";
import {
  newPackage,
  type DrugFormInput,
  type DrugFormValues,
} from "../_lib/drug-form-schema.ts";
import BarcodeConfirmEntry from "./barcode-confirm-entry.tsx";
import ImagePicker from "./image-picker.tsx";

// Mirrors MAX_PACKAGING_IMAGES in convex/lib/drugs.ts
const MAX_PACKAGING_IMAGES = 10;

type Props = { control: Control<DrugFormInput, unknown, DrugFormValues> };

const numberField = "h-10 bg-card text-center";
const GRID = "sm:grid sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_4.5rem_5rem_2.5rem] sm:items-start sm:gap-2";

function ColumnHeaders() {
  return (
    <div className={`hidden px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${GRID}`}>
      <span>Barcode</span>
      <span className="text-center">Qty per</span>
      <span>Base unit</span>
      <span className="text-center">No. of</span>
      <span className="text-center">Stock</span>
      <span />
    </div>
  );
}

export default function PackageRowsEditor({ control }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: "packages" });
  const { setValue } = useFormContext<DrugFormInput, unknown, DrugFormValues>();
  const packages = useWatch({ control, name: "packages" });
  const barcodes = packages.map((p) => p.barcode);
  const confirm = useConfirm();

  const confirmRemove = async (index: number) => {
    const pkg = packages[index];
    const ok = await confirm({
      title: "Remove this package form?",
      description: `${pkg?.barcode ? `Barcode ${pkg.barcode}` : "This package form (no barcode)"} and its stock and packaging pictures will be removed when you save.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (ok) remove(index);
  };

  return (
    <div className="space-y-3">
      <BarcodeConfirmEntry existingBarcodes={barcodes} onAdd={(barcode) => append(newPackage(barcode))} />

      {fields.length > 0 && <ColumnHeaders />}
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className={`grid grid-cols-4 gap-2 rounded-xl border bg-muted/40 p-3 ${GRID}`}>
            <div className="col-span-3 flex h-10 min-w-0 items-center gap-2 sm:col-span-1">
              <Barcode className="size-4 shrink-0 text-muted-foreground" />
              {field.barcode ? (
                <span className="truncate font-mono text-sm">{field.barcode}</span>
              ) : (
                <span className="truncate text-sm italic text-muted-foreground">No barcode</span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="justify-self-end sm:hidden"
              onClick={() => void confirmRemove(index)}
              aria-label="Remove package form"
            >
              <Trash2 />
            </Button>
            <FormField
              control={control}
              name={`packages.${index}.qtyPerUnit`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} value={String(f.value)} inputMode="numeric" className={numberField} aria-label="Quantity per base unit" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`packages.${index}.baseUnit`}
              render={({ field: f }) => (
                <FormItem>
                  <Select
                    value={f.value}
                    onValueChange={(value: DrugFormValues["packages"][number]["baseUnit"]) => {
                      f.onChange(value);
                      setValue(`packages.${index}.unitCount`, defaultUnitCount(value), { shouldValidate: true });
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 w-full bg-card" aria-label="Base unit">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BASE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`packages.${index}.unitCount`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} value={String(f.value)} inputMode="numeric" className={numberField} aria-label="Number of base units" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`packages.${index}.stock`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} value={String(f.value)} inputMode="numeric" className={`${numberField} font-bold`} aria-label="Stock amount" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={() => void confirmRemove(index)}
              aria-label="Remove package form"
            >
              <Trash2 />
            </Button>
            <FormField
              control={control}
              name={`packages.${index}.images`}
              render={({ field: f }) => (
                <FormItem className="col-span-4 space-y-1.5 border-t pt-3 sm:col-span-6">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Packaging pictures for this package form
                  </div>
                  <ImagePicker images={f.value} onChange={f.onChange} max={MAX_PACKAGING_IMAGES} size="sm" />
                </FormItem>
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
