import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import {
  PACKAGE_FILTERS,
  countPackageKinds,
  type PackageFilter,
  type SheetRecord,
} from "@/convex/lib/drugImport.ts";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { DialogFooter } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";

type Props = {
  fileName: string;
  records: SheetRecord[];
  available: { form: string; drugs: number }[];
  initialForms: string[];
  onBack: () => void;
  onCheck: (forms: string[], filter: PackageFilter) => void;
};

const chip = (on: boolean) =>
  cn(
    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
    on ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted",
  );

// Step 2 of the import: pick dosage forms and whether drugs with/without package forms come in
export default function ImportFormsStep({ fileName, records, available, initialForms, onBack, onCheck }: Props) {
  const [forms, setForms] = useState<string[]>(initialForms);
  const [filter, setFilter] = useState<PackageFilter>("with");
  const counts = useMemo(() => countPackageKinds(records, forms), [records, forms]);
  const countOf = (f: PackageFilter) => (f === "both" ? counts.with + counts.without : counts[f]);
  const selected = countOf(filter);

  return (
    <>
      <div className="min-h-0 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="size-4 text-primary" />
          <span className="font-medium">{fileName}</span>
          <span className="text-muted-foreground">· {records.length.toLocaleString()} rows</span>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Which drug forms should be imported?</div>
          <div className="flex flex-wrap gap-2">
            {available.map(({ form, drugs }) => {
              const on = forms.includes(form);
              return (
                <button
                  key={form}
                  type="button"
                  onClick={() => setForms(on ? forms.filter((f) => f !== form) : [...forms, form])}
                  className={chip(on)}
                >
                  <Checkbox checked={on} tabIndex={-1} className="pointer-events-none" />
                  {form}
                  <span className="text-xs text-muted-foreground">{drugs.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Which drugs should be imported?</div>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {PACKAGE_FILTERS.map(({ value, label }) => {
              const on = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setFilter(value)}
                  className={chip(on)}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border",
                      on ? "border-primary" : "border-input",
                    )}
                  >
                    {on && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  {label}
                  <span className="text-xs text-muted-foreground">{countOf(value).toLocaleString()}</span>
                </button>
              );
            })}
          </div>
          {filter !== "with" && (
            <p className="text-xs text-muted-foreground">
              Drugs without a barcode or package form are saved with no package form, so they cannot be stocked in or
              out until you add one on the Inventory page.
            </p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onBack}>
          Choose another file
        </Button>
        <Button disabled={forms.length === 0 || selected === 0} onClick={() => onCheck(forms, filter)}>
          Check {selected.toLocaleString()} drugs
        </Button>
      </DialogFooter>
    </>
  );
}
