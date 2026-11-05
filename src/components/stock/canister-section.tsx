import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Pill } from "lucide-react";
import { CANISTER_TYPES } from "@/convex/lib/canister.ts";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import type {
  MovementFormInput,
  MovementFormValues,
} from "./movement-form-schema.ts";

type Props = {
  // Tablets/capsules in what is being taken out (used when Canister QTY is left blank)
  autoQty: number;
  pieceName: string;
};

const inputClass = "h-10 bg-background";

// "Fill canister" switch plus Canister QTY and Canister Type.
// Batch and Expiry sit in the main Stock Out form and become required while this is on.
export default function CanisterSection({ autoQty, pieceName }: Props) {
  const form = useFormContext<MovementFormInput, unknown, MovementFormValues>();
  const on = useWatch({ control: form.control, name: "canisterOn" });
  // Follows the quantity taken out until the user types their own number
  const [qtyEdited, setQtyEdited] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-primary/40 bg-secondary/40 p-3">
      <FormField
        control={form.control}
        name="canisterOn"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between gap-3">
            <FormLabel className="flex cursor-pointer items-center gap-2 text-base font-semibold">
              <Pill className="size-4 text-primary" />
              Fill canister
            </FormLabel>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={(v) => {
                  field.onChange(v);
                  // Batch/Expiry errors depend on the switch, so re-check them
                  if (form.formState.isSubmitted)
                    void form.trigger(["batch", "expiry"]);
                }}
                className="cursor-pointer"
              />
            </FormControl>
          </FormItem>
        )}
      />
      {on && (
        <>
          <p className="text-sm text-muted-foreground">
            Batch and Expiry above are required when filling a canister.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="canisterQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Canister QTY ({pieceName || "pieces"})</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      placeholder={String(autoQty)}
                      value={qtyEdited ? field.value : String(autoQty)}
                      onChange={(e) => {
                        setQtyEdited(true);
                        field.onChange(
                          e.target.value.replace(/\D/g, "").slice(0, 7),
                        );
                      }}
                      onFocus={(e) => e.target.select()}
                      className={inputClass}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="canisterType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Canister Type</FormLabel>
                  <FormControl>
                    <NativeSelect
                      {...field}
                      className="h-10 w-full cursor-pointer bg-background"
                    >
                      {CANISTER_TYPES.map((t) => (
                        <NativeSelectOption key={t} value={String(t)}>
                          {t}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
