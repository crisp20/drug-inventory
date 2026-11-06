import type { Control } from "react-hook-form";
import { ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form.tsx";
import type {
  DrugFormInput,
  DrugFormValues,
} from "../_lib/drug-form-schema.ts";

type Props = { control: Control<DrugFormInput, unknown, DrugFormValues> };

// Dangerous Drug (DDA) tick box. Set once on the medicine.
export default function DdaField({ control }: Props) {
  return (
    <FormField
      control={control}
      name="dda"
      render={({ field }) => (
        <FormItem className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={(on) => field.onChange(on === true)}
              className="mt-0.5 size-5 cursor-pointer"
            />
          </FormControl>
          <div className="space-y-1">
            <FormLabel className="flex cursor-pointer items-center gap-2">
              <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />{" "}
              Dangerous Drug (DDA)
            </FormLabel>
            <p className="text-xs text-muted-foreground">
              Staff see a DDA notice at Stock Out, and DDA prints on the
              canister label.
            </p>
          </div>
        </FormItem>
      )}
    />
  );
}
