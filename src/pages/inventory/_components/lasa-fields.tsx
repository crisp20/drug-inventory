import { useWatch, type Control } from "react-hook-form";
import { TriangleAlert } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import type { DrugFormInput, DrugFormValues } from "../_lib/drug-form-schema.ts";
import LookAlikePicker from "./look-alike-picker.tsx";

type Props = {
  control: Control<DrugFormInput, unknown, DrugFormValues>;
  selfId?: Id<"drugs">;
};

// Look Alike, Sound Alike switch, and the linked similar drugs once switched on
export default function LasaFields({ control, selfId }: Props) {
  const lasa = useWatch({ control, name: "lasa" });
  return (
    <div className="space-y-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
      <FormField
        control={control}
        name="lasa"
        render={({ field }) => (
          <FormItem className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <FormLabel className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-destructive" /> Look Alike, Sound Alike
              </FormLabel>
              <p className="text-xs text-muted-foreground">
                Staff are warned to double-check the pictures whenever this drug is chosen.
              </p>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} className="cursor-pointer" />
            </FormControl>
          </FormItem>
        )}
      />
      {lasa && (
        <FormField
          control={control}
          name="lookAlikes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Looks or sounds like</FormLabel>
              <p className="text-xs text-muted-foreground">
                Linked drugs are marked too and show each other in the warning.
              </p>
              <LookAlikePicker selfId={selfId} value={field.value} onChange={field.onChange} />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
