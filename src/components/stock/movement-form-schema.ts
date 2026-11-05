import { z } from "zod";
import {
  CANISTER_TYPES,
  isCalendarDay,
  MAX_BATCH_LENGTH,
  MAX_CANISTER_QTY,
} from "@/convex/lib/canister.ts";
import { toCalendarDay } from "@/convex/lib/expiry.ts";
import {
  MAX_MOVEMENT_QUANTITY,
  MAX_NOTES_LENGTH,
  MAX_REASON_LENGTH,
  type MovementKind,
} from "@/convex/lib/stock.ts";

// Shared by Stock In and Stock Out forms. Reason is only required for Stock Out.
// The package form is not editable here; it always comes from the chosen barcode.
// Canister fields are only checked when "Fill canister" is switched on.
export function movementFormSchema(kind: MovementKind) {
  const reason = z
    .string()
    .trim()
    .max(
      MAX_REASON_LENGTH,
      `Reason can be at most ${MAX_REASON_LENGTH} characters`,
    );
  return z
    .object({
      quantity: z.coerce
        .number<string | number>()
        .int("Quantity must be a whole number")
        .min(1, "Quantity must be at least 1")
        .max(
          MAX_MOVEMENT_QUANTITY,
          `Quantity can be at most ${MAX_MOVEMENT_QUANTITY.toLocaleString()}`,
        ),
      notes: z
        .string()
        .trim()
        .max(
          MAX_NOTES_LENGTH,
          `Notes can be at most ${MAX_NOTES_LENGTH} characters`,
        ),
      reason:
        kind === "out" ? reason.min(1, "Choose or type a reason") : reason,
      canisterOn: z.boolean(),
      batch: z.string().trim(),
      expiry: z.string(),
      // GS1 code used even though its product didn't match (set by the scan box)
      mismatchedScan: z.string(),
      canisterQty: z.string(),
      canisterType: z.string(),
    })
    .superRefine((v, ctx) => {
      // Batch and Expiry are optional on any Stock Out, but checked when given
      if (v.batch.length > MAX_BATCH_LENGTH)
        ctx.addIssue({
          code: "custom",
          path: ["batch"],
          message: `Batch can be at most ${MAX_BATCH_LENGTH} characters`,
        });
      else if (v.canisterOn && !v.batch)
        ctx.addIssue({
          code: "custom",
          path: ["batch"],
          message: "Enter the batch number",
        });
      if (v.expiry === "") {
        if (v.canisterOn)
          ctx.addIssue({
            code: "custom",
            path: ["expiry"],
            message: "Enter the expiry date",
          });
      } else if (!isCalendarDay(v.expiry))
        ctx.addIssue({
          code: "custom",
          path: ["expiry"],
          message: "Enter a valid expiry date",
        });
      else if (v.expiry < toCalendarDay(new Date()))
        ctx.addIssue({
          code: "custom",
          path: ["expiry"],
          message: "Expiry date can't be before today",
        });
      if (!v.canisterOn) return;
      // Blank means "work it out from the quantity taken out"
      const qty = Number(v.canisterQty);
      if (
        v.canisterQty !== "" &&
        (!/^\d+$/.test(v.canisterQty) || qty < 1 || qty > MAX_CANISTER_QTY)
      )
        ctx.addIssue({
          code: "custom",
          path: ["canisterQty"],
          message: "Enter the number of tablets/capsules",
        });
      if (!CANISTER_TYPES.some((t) => String(t) === v.canisterType))
        ctx.addIssue({
          code: "custom",
          path: ["canisterType"],
          message: "Choose a canister type",
        });
    });
}

export type MovementFormInput = z.input<ReturnType<typeof movementFormSchema>>;
export type MovementFormValues = z.output<
  ReturnType<typeof movementFormSchema>
>;
