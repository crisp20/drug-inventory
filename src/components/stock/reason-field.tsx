import type { Control } from "react-hook-form";
import { STOCK_OUT_REASONS } from "@/convex/lib/stock.ts";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import type {
  MovementFormInput,
  MovementFormValues,
} from "./movement-form-schema.ts";

type Props = {
  control: Control<MovementFormInput, unknown, MovementFormValues>;
};

// Quick-pick reason chips plus a free-text box for anything else
export default function ReasonField({ control }: Props) {
  return (
    <FormField
      control={control}
      name="reason"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Reason</FormLabel>
          <div className="flex flex-wrap gap-2">
            {STOCK_OUT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => field.onChange(r)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  field.value === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <FormControl>
            <Input
              {...field}
              placeholder="Or type another reason"
              className="h-10 bg-background"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
