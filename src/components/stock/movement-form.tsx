import { useCallback, useState } from "react";
import { Printer } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import { fillDateCode, type LabelData } from "@/lib/label/label-data.ts";
import { userInitials } from "@/convex/lib/initials.ts";
import {
  defaultLabelCopies,
  type StockInLabelData,
} from "@/lib/label/stock-in-label.ts";
import type { StockInLabelChoice } from "@/lib/label/stock-in-set.ts";
import LabelPrintDialog from "./label-print-dialog.tsx";
import StockInLabelDialog from "./stock-in-label-dialog.tsx";
import StockInLabelSection from "./stock-in-label-section.tsx";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { ArrowDownToLine, ArrowUpFromLine, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { formatPackageForm } from "@/convex/lib/barcode.ts";
import {
  canisterQtyFor,
  DEFAULT_CANISTER_TYPE,
} from "@/convex/lib/canister.ts";
import {
  DEFAULT_EXPIRY_WARNING_MONTHS,
  expiryStatus,
  toCalendarDay,
} from "@/convex/lib/expiry.ts";
import { format, parseISO } from "date-fns";
import { parseGs1 } from "@/convex/lib/gs1.ts";
import {
  DEFAULT_LARGE_QUANTITY_THRESHOLD,
  needsLargeQuantityConfirm,
} from "@/convex/lib/settings.ts";
import {
  DEFAULT_STOCK_OUT_REASON,
  MAX_MOVEMENT_QUANTITY,
  type MovementKind,
} from "@/convex/lib/stock.ts";
import { useConfirm } from "@/hooks/use-confirm.ts";
import { useCanisterEnabled } from "@/hooks/use-canister-enabled.ts";
import { useScanGuard } from "@/hooks/use-scan-guard.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { errorMessage } from "@/lib/errors.ts";
import {
  useConfirmDiscard,
  useUnsavedChanges,
} from "@/hooks/use-unsaved-changes.ts";
import { cn } from "@/lib/utils.ts";
import {
  movementFormSchema,
  type MovementFormInput,
  type MovementFormValues,
} from "./movement-form-schema.ts";
import CanisterSection from "./canister-section.tsx";
import BatchExpiryFields from "./batch-expiry-fields.tsx";
import PackageFormSummary from "./package-form-summary.tsx";
import ReasonField from "./reason-field.tsx";
import type { StockSelection } from "./stock-drug-finder.tsx";

type Props = {
  kind: MovementKind;
  selection: StockSelection;
  // The barcode/GS1 code that picked this package form, if it was scanned
  scannedCode?: string;
  onDone: () => void;
};

const COPY = {
  in: {
    title: "Stock In",
    quantityLabel: "Quantity received",
    notesPlaceholder: "e.g. Invoice #4521 from supplier",
    submit: "Record Stock In",
    verb: "Added",
    error: "Could not record Stock In",
    icon: ArrowDownToLine,
  },
  out: {
    title: "Stock Out",
    quantityLabel: "Quantity going out",
    notesPlaceholder: "e.g. Patient / ward / script number",
    submit: "Record Stock Out",
    verb: "Removed",
    error: "Could not record Stock Out",
    icon: ArrowUpFromLine,
  },
} as const;

const NO_LABELS: StockInLabelChoice = { medicine: false, bag: false };

const MAX_QUANTITY_DIGITS = String(MAX_MOVEMENT_QUANTITY).length;

function toNumber(value: string | number | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Quantity, editable package form, notes (and reason for Stock Out) for one package form
export default function MovementForm({
  kind,
  selection,
  scannedCode,
  onDone,
}: Props) {
  const { drug, pkg } = selection;
  const copy = COPY[kind];
  const recordIn = useMutation(api.stock.recordIn);
  const recordOut = useMutation(api.stock.recordOut);
  const canisterEnabled = useCanisterEnabled() && kind === "out";
  // A scanned GS1 code already carries the batch and expiry
  const scanned = scannedCode ? parseGs1(scannedCode) : null;
  const today = toCalendarDay(new Date());
  // Expired stock found by scanning: leave Expiry empty and say why
  const scannedExpired =
    scanned?.expiry && scanned.expiry < today ? scanned.expiry : null;
  const form = useForm<MovementFormInput, unknown, MovementFormValues>({
    resolver: zodResolver(movementFormSchema(kind)),
    defaultValues: {
      quantity: 1,
      notes: "",
      reason: kind === "out" ? DEFAULT_STOCK_OUT_REASON : "",
      canisterOn: false,
      eight: false,
      labelsOn: false,
      bagLabelsOn: false,
      batch: scanned?.batch ?? "",
      expiry: scannedExpired ? "" : (scanned?.expiry ?? ""),
      mismatchedScan: "",
      canisterQty: "",
      canisterType: String(DEFAULT_CANISTER_TYPE),
    },
  });
  const watched = useWatch({ control: form.control });
  useUnsavedChanges(form.formState.isDirty);
  const confirmDiscard = useConfirmDiscard();
  const handleCancel = async () => {
    if (await confirmDiscard()) onDone();
  };
  const quantity = Math.max(0, toNumber(watched.quantity));
  const canisterOn = watched.canisterOn === true;
  const stockAfter =
    kind === "in" ? pkg.stock + quantity : pkg.stock - quantity;
  const notEnough = kind === "out" && stockAfter < 0;

  const willPrint = canisterEnabled && canisterOn;
  // Label waiting to print after a canister Stock Out was saved
  const [label, setLabel] = useState<LabelData | null>(null);
  const currentUser = useCurrentUser();
  // Stock In of a package form without a barcode always needs the Medicine Label;
  // with a barcode, only when ticked. The Medicine Bag Label is always optional.
  const hasBarcode = !!pkg.barcode.trim();
  const labelChoice = (values: {
    labelsOn?: boolean;
    bagLabelsOn?: boolean;
  }): StockInLabelChoice => ({
    medicine: !hasBarcode || values.labelsOn === true,
    bag: values.bagLabelsOn === true,
  });
  const watchedChoice = labelChoice(watched);
  const needsLabels =
    kind === "in" && (watchedChoice.medicine || watchedChoice.bag);
  const [stockInLabel, setStockInLabel] = useState<{
    data: StockInLabelData;
    choice: StockInLabelChoice;
    copies: number;
    quantity: number;
    afterSave: boolean;
    // Set while the Stock In is waiting to be saved (it saves on print)
    save?: () => Promise<boolean>;
  } | null>(null);
  const closeStockInLabel = async () => {
    const pending = stockInLabel;
    if (!pending) return;
    if (pending.save) {
      const ok = await confirm({
        title: "Save without printing?",
        description:
          "This Stock In hasn't been saved yet. Save it without printing labels, or go back to the form to keep editing.",
        confirmLabel: "Save Stock In",
        cancelLabel: "Back to the form",
      });
      if (ok && !(await pending.save())) return;
      setStockInLabel(null);
      if (ok) onDone();
      return;
    }
    setStockInLabel(null);
    if (pending.afterSave) onDone();
  };
  const buildStockInLabel = (): StockInLabelData => {
    const values = form.getValues();
    return {
      drugId: drug.drugId,
      brandName: drug.brandName,
      name: drug.name,
      packageForm: formatPackageForm(pkg),
      baseUnit: pkg.baseUnit,
      dangerousDrug: !!drug.dda,
      eight: values.eight === true,
      initials: userInitials(currentUser),
      batch: values.batch.trim() || undefined,
      expiry: values.expiry || undefined,
      imageUrl: drug.imageUrl,
    };
  };

  const confirm = useConfirm();
  const settings = useQuery(api.settings.get, {});
  const threshold =
    settings?.largeQuantityThreshold ?? DEFAULT_LARGE_QUANTITY_THRESHOLD;
  const warningMonths =
    settings?.expiryWarningMonths ?? DEFAULT_EXPIRY_WARNING_MONTHS;

  // A barcode scanned while the cursor is in the quantity box: undo it and explain
  const guardQuantity = useScanGuard(
    useCallback(
      (valueBefore: string) => {
        const restored = /^\d+$/.test(valueBefore) ? valueBefore : "1";
        form.setValue("quantity", restored, { shouldDirty: true });
        form.setError("quantity", {
          message:
            "Scan detected in the quantity box, so it was ignored. Please scan in the search box above. 數量欄偵測到掃描，已忽略。",
        });
        toast.warning("Scan detected in the quantity box", {
          description:
            "The scanned code was ignored. Please scan in the search box.",
        });
        form.setFocus("quantity");
      },
      [form],
    ),
  );

  const onSubmit = async ({
    reason,
    canisterOn,
    batch,
    expiry,
    mismatchedScan,
    canisterQty,
    canisterType,
    eight,
    labelsOn,
    bagLabelsOn,
    ...values
  }: MovementFormValues) => {
    const choice = labelChoice({ labelsOn, bagLabelsOn });
    // Large amounts are often a barcode scanned into the quantity box, so ask again
    if (needsLargeQuantityConfirm(values.quantity, threshold)) {
      const ok = await confirm({
        title: `Confirm ${values.quantity.toLocaleString()} × ${formatPackageForm(pkg)}?`,
        description: `This is a large ${copy.title} (${threshold.toLocaleString()} or more) for ${drug.name}. Stock will go from ${pkg.stock.toLocaleString()} to ${(kind === "in" ? pkg.stock + values.quantity : pkg.stock - values.quantity).toLocaleString()}. Please check the quantity was not a scanning error.`,
        confirmLabel: `Yes, record ${values.quantity.toLocaleString()}`,
        cancelLabel: "Go back and fix",
      });
      if (!ok) {
        form.setFocus("quantity");
        return;
      }
    }
    const useCanister = canisterEnabled && canisterOn;
    // Short-dated stock: ask before saving, whenever an expiry is entered
    if (
      expiry &&
      expiryStatus(expiry, toCalendarDay(new Date()), warningMonths) === "soon"
    ) {
      const ok = await confirm({
        title: "This stock is expiring soon",
        description: `This stock expires on ${format(parseISO(expiry), "d MMM yyyy")}, within ${warningMonths} month(s). Are you sure you want to continue?`,
        confirmLabel: "Yes, continue",
        cancelLabel: "Go back",
      });
      if (!ok) {
        form.setFocus("expiry");
        return;
      }
    }
    const args = { packageId: pkg._id, ...values };
    if (kind === "in" && needsLabels) {
      // Preview the labels first; nothing is saved until the user prints
      const inArgs = {
        ...args,
        batch: batch || undefined,
        expiry: expiry || undefined,
        mismatchedScan: mismatchedScan || undefined,
        eight: eight ? true : undefined,
        labels: hasBarcode && labelsOn ? true : undefined,
        bagLabels: bagLabelsOn ? true : undefined,
      };
      setStockInLabel({
        data: buildStockInLabel(),
        choice,
        copies: defaultLabelCopies(values.quantity),
        quantity: values.quantity,
        afterSave: true,
        save: async () => {
          try {
            const result = await recordIn(inArgs);
            toast.success(
              `${copy.verb} ${values.quantity} × ${formatPackageForm(pkg)} of ${drug.name}`,
              { description: `Stock is now ${result.stockAfter}` },
            );
            form.reset(form.getValues());
            // Saved: printing again or closing must not save a second time
            setStockInLabel((s) => (s ? { ...s, save: undefined } : s));
            return true;
          } catch (e) {
            toast.error(errorMessage(e, copy.error));
            return false;
          }
        },
      });
      return;
    }
    try {
      const canister = useCanister
        ? {
            batch,
            expiry,
            quantity:
              canisterQty === ""
                ? canisterQtyFor(values.quantity, pkg)
                : Number(canisterQty),
            type: Number(canisterType),
          }
        : undefined;
      const result =
        kind === "in"
          ? await recordIn({
              ...args,
              batch: batch || undefined,
              expiry: expiry || undefined,
              mismatchedScan: mismatchedScan || undefined,
              eight: needsLabels && eight ? true : undefined,
              labels: hasBarcode && labelsOn ? true : undefined,
              bagLabels: bagLabelsOn ? true : undefined,
            })
          : await recordOut({
              ...args,
              reason,
              batch,
              expiry,
              canister,
              mismatchedScan: mismatchedScan || undefined,
            });
      toast.success(
        `${copy.verb} ${values.quantity} × ${formatPackageForm(pkg)} of ${drug.name}`,
        {
          description: `Stock is now ${result.stockAfter}`,
        },
      );
      if (canister) {
        // Stock is saved first; the label dialog lets them print or reprint
        setLabel({
          drugId: drug.drugId,
          brandName: drug.brandName,
          name: drug.name,
          batch: canister.batch,
          expiry: canister.expiry,
          canisterType: canister.type,
          canisterQty: canister.quantity,
          filledBy: userInitials(currentUser),
          fillDate: fillDateCode(new Date()),
          qrText: drug.drugId,
          imageUrl: drug.imageUrl,
          dangerousDrug: !!drug.dda,
        });
        form.reset(form.getValues());
        return;
      }
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, copy.error));
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5 rounded-xl border-2 border-primary/30 bg-card p-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">{copy.title}</h2>
          <span className="truncate text-sm text-muted-foreground">
            {drug.name}
          </span>
        </div>

        {kind === "out" && drug.dda && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold">Dangerous Drug (DDA)</div>
              <div>
                Follow the DDA procedure for this medicine. DDA is printed on
                the canister label.
              </div>
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{copy.quantityLabel}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={String(field.value)}
                  // Digits only, at most 6 (max is 100,000), so a stray scan can't become a huge number
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, MAX_QUANTITY_DIGITS),
                    )
                  }
                  inputMode="numeric"
                  maxLength={MAX_QUANTITY_DIGITS}
                  autoFocus
                  onKeyDown={guardQuantity}
                  onFocus={(e) => e.target.select()}
                  className="h-14 bg-background text-center text-2xl font-extrabold"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PackageFormSummary pkg={pkg} pieceName={drug.pieceName} />

        {kind === "out" && <ReasonField control={form.control} />}

        <BatchExpiryFields
          kind={kind}
          packageBarcode={pkg.barcode}
          warningMonths={warningMonths}
          scannedExpired={scannedExpired}
          required={canisterEnabled && canisterOn}
        />

        {kind === "in" && (
          <StockInLabelSection
            control={form.control}
            dangerousDrug={!!drug.dda}
            hasBarcode={hasBarcode}
            quantity={quantity}
            onPrint={() =>
              setStockInLabel({
                data: buildStockInLabel(),
                choice: watchedChoice,
                copies: defaultLabelCopies(Math.max(1, quantity)),
                quantity: Math.max(1, quantity),
                afterSave: false,
              })
            }
          />
        )}

        {canisterEnabled && (
          <CanisterSection
            autoQty={canisterQtyFor(Math.max(1, quantity), pkg)}
            pieceName={drug.pieceName}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={2}
                  placeholder={copy.notesPlaceholder}
                  className="bg-background"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
            notEnough ? "bg-destructive/10 text-destructive" : "bg-muted",
          )}
        >
          <span className={cn(!notEnough && "text-muted-foreground")}>
            {notEnough
              ? `Not enough stock: only ${pkg.stock} on hand`
              : "Stock after"}
          </span>
          <span className="font-semibold">
            {pkg.stock} →{" "}
            <span className="text-lg font-extrabold">{stockAfter}</span>
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleCancel()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            disabled={form.formState.isSubmitting || notEnough}
          >
            {form.formState.isSubmitting ? (
              <Spinner />
            ) : willPrint || needsLabels ? (
              <Printer />
            ) : (
              <copy.icon />
            )}
            {willPrint
              ? "Print Label & Record Stock Out"
              : needsLabels
                ? "Check Labels & Record Stock In"
                : copy.submit}
          </Button>
        </div>
      </form>
      <LabelPrintDialog
        data={label}
        onClose={() => {
          setLabel(null);
          onDone();
        }}
      />
      <StockInLabelDialog
        data={stockInLabel?.data ?? null}
        choice={stockInLabel?.choice ?? NO_LABELS}
        copies={stockInLabel?.copies ?? 1}
        quantity={stockInLabel?.quantity ?? 1}
        title={
          stockInLabel?.save
            ? "Check the labels, then print"
            : stockInLabel?.afterSave
              ? "Stock In recorded. Print the labels"
              : "Print labels"
        }
        onSave={stockInLabel?.save}
        onEdit={
          stockInLabel?.save
            ? () => {
                // Back to the form with everything still filled in
                setStockInLabel(null);
              }
            : undefined
        }
        onClose={() => void closeStockInLabel()}
      />
    </Form>
  );
}
