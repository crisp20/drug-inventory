import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { listDosageForms, sheetToRecords, type SheetRecord } from "@/convex/lib/drugImport.ts";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useConfirm } from "@/hooks/use-confirm.ts";
import { errorMessage } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";
import { readImportFile } from "../_lib/read-import-file.ts";
import { useDrugImport, type ImportReport, type ImportReview } from "../_hooks/use-drug-import.ts";
import ImportConflictCard, { ClashNote, type Choice } from "./import-conflict-card.tsx";

const DEFAULT_FORMS = ["TABLET", "CAPSULE"];
const PAGE = 40;

type Loaded = { fileName: string; records: SheetRecord[]; forms: { form: string; drugs: number }[] };

type Step =
  | { name: "pick" }
  | { name: "forms"; loaded: Loaded }
  | { name: "review"; loaded: Loaded; review: ImportReview }
  | { name: "done"; report: ImportReport };

export default function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<Step>({ name: "pick" });
  const importer = useDrugImport();
  const reset = (o: boolean) => {
    if (!o) setStep({ name: "pick" });
    onOpenChange(o);
  };
  return (
    // Closing mid-import would stop the remaining batches, so block it while busy
    <Dialog open={open} onOpenChange={(o) => !importer.progress && reset(o)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import inventory file</DialogTitle>
          <DialogDescription>
            Excel or CSV file with the columns drugid, printoutName, brandName, Manufacturer, DosageForm, barcode,
            form, per and amount.
          </DialogDescription>
        </DialogHeader>
        <ImportSteps step={step} setStep={setStep} importer={importer} onClose={() => reset(false)} />
      </DialogContent>
    </Dialog>
  );
}

type Importer = ReturnType<typeof useDrugImport>;

function ImportSteps({
  step,
  setStep,
  importer,
  onClose,
}: {
  step: Step;
  setStep: (s: Step) => void;
  importer: Importer;
  onClose: () => void;
}) {
  const [reading, setReading] = useState(false);
  const [forms, setForms] = useState<string[]>(DEFAULT_FORMS);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const rows = await readImportFile(file);
      const { records, missingColumns } = sheetToRecords(rows);
      if (missingColumns.length > 0) {
        toast.error(`The file is missing these columns: ${missingColumns.join(", ")}`);
        return;
      }
      if (records.length === 0) {
        toast.error("The file has no rows");
        return;
      }
      const available = listDosageForms(records);
      setForms(DEFAULT_FORMS.filter((f) => available.some((a) => a.form === f)));
      setStep({ name: "forms", loaded: { fileName: file.name, records, forms: available } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The file could not be read");
    } finally {
      setReading(false);
    }
  };

  if (importer.progress) {
    const { label, done, total } = importer.progress;
    return (
      <div className="space-y-3 py-8 text-center">
        <Spinner className="mx-auto" />
        <div className="font-medium">{label}…</div>
        {total > 0 && <Progress value={(done / total) * 100} className="mx-auto max-w-sm" />}
        <p className="text-xs text-muted-foreground">Keep this window open until it finishes.</p>
      </div>
    );
  }

  if (step.name === "pick") {
    return (
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/40",
          reading && "pointer-events-none opacity-60",
        )}
      >
        {reading ? <Spinner /> : <Upload className="size-8 text-primary" />}
        <div className="font-semibold">{reading ? "Reading file…" : "Choose an Excel (.xlsx) or CSV file"}</div>
        <div className="text-sm text-muted-foreground">Nothing is saved until you review and confirm.</div>
        <input
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
    );
  }

  if (step.name === "forms") {
    const { loaded } = step;
    const startCheck = async () => {
      try {
        const review = await importer.check(loaded.records, forms);
        setStep({ name: "review", loaded, review });
      } catch (error) {
        toast.error(errorMessage(error, "Could not compare the file with your inventory"));
      }
    };
    return (
      <>
        <div className="min-h-0 space-y-3 overflow-y-auto">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="size-4 text-primary" />
            <span className="font-medium">{loaded.fileName}</span>
            <span className="text-muted-foreground">· {loaded.records.length.toLocaleString()} rows</span>
          </div>
          <div className="text-sm font-semibold">Which drug forms should be imported?</div>
          <div className="flex flex-wrap gap-2">
            {loaded.forms.map(({ form, drugs }) => {
              const on = forms.includes(form);
              return (
                <button
                  key={form}
                  type="button"
                  onClick={() => setForms(on ? forms.filter((f) => f !== form) : [...forms, form])}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    on ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted",
                  )}
                >
                  <Checkbox checked={on} tabIndex={-1} className="pointer-events-none" />
                  {form}
                  <span className="text-xs text-muted-foreground">{drugs.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Only drugs with at least one barcode or package form are imported.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setStep({ name: "pick" })}>
            Choose another file
          </Button>
          <Button disabled={forms.length === 0} onClick={() => void startCheck()}>
            Check file
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (step.name === "review") {
    return <ReviewStep review={step.review} importer={importer} onDone={(report) => setStep({ name: "done", report })} />;
  }

  return <DoneStep report={step.report} onClose={onClose} />;
}

function ReviewStep({
  review,
  importer,
  onDone,
}: {
  review: ImportReview;
  importer: Importer;
  onDone: (r: ImportReport) => void;
}) {
  const confirm = useConfirm();
  const [addNew, setAddNew] = useState(true);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [remove, setRemove] = useState<Set<Id<"drugs">>>(new Set());
  const [shownConflicts, setShownConflicts] = useState(PAGE);
  const [shownMissing, setShownMissing] = useState(PAGE);

  const choiceOf = (drugId: string): Choice => choices[drugId] ?? "keep";
  const useFileCount = useMemo(
    () => review.conflicts.filter((c) => (choices[c.drug.drugId] ?? "keep") === "file").length,
    [review.conflicts, choices],
  );
  const setAll = (c: Choice) => setChoices(Object.fromEntries(review.conflicts.map((i) => [i.drug.drugId, c])));
  const newWithClashes = review.newDrugs.filter((n) => n.check.clashes.length > 0);

  const submit = async () => {
    const items = [
      ...(addNew ? review.newDrugs.map((i) => ({ drug: i.drug, action: "create" as const })) : []),
      ...review.conflicts
        .filter((i) => choiceOf(i.drug.drugId) === "file")
        .map((i) => ({ drug: i.drug, action: "update" as const })),
    ];
    if (items.length === 0 && remove.size === 0) {
      toast.info("Nothing to change");
      return;
    }
    if (remove.size > 0) {
      const ok = await confirm({
        title: `Delete ${remove.size} drug${remove.size === 1 ? "" : "s"}?`,
        description: "They are not in the file. Their package forms, stock and pictures are removed. The stock log is kept.",
        confirmLabel: "Delete and import",
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      onDone(await importer.run(items, [...remove]));
    } catch (error) {
      toast.error(errorMessage(error, "The import stopped part way. Check the file again to continue."));
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="New drugs" value={review.newDrugs.length} />
        <Stat label="Conflicts" value={review.conflicts.length} highlight={review.conflicts.length > 0} />
        <Stat label="Already the same" value={review.unchanged} />
        <Stat label="Not in file" value={review.missing.length} highlight={review.missing.length > 0} />
      </div>
      <Tabs defaultValue={review.conflicts.length > 0 ? "conflicts" : "new"} className="min-h-0 flex-1">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="new">New ({review.newDrugs.length})</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts ({review.conflicts.length})</TabsTrigger>
          <TabsTrigger value="missing">Not in file ({review.missing.length})</TabsTrigger>
          <TabsTrigger value="problems">Skipped ({review.problems.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="min-h-0 space-y-2 overflow-y-auto pr-1 [max-height:45vh]">
          <label className="flex cursor-pointer items-center justify-between rounded-lg bg-muted p-3 text-sm">
            <span>Add all {review.newDrugs.length.toLocaleString()} new drugs (stock starts at 0)</span>
            <Switch checked={addNew} onCheckedChange={setAddNew} />
          </label>
          {newWithClashes.map((i) => (
            <div key={i.drug.drugId} className="space-y-1 rounded-lg border p-2 text-sm">
              <div className="font-medium">
                {i.drug.name} <span className="text-muted-foreground">· {i.drug.drugId}</span>
              </div>
              <ClashNote item={i} />
            </div>
          ))}
          {review.withoutPackages > 0 && (
            <p className="text-xs text-muted-foreground">
              {review.withoutPackages.toLocaleString()} drugs have no barcode or package form and were left out.
            </p>
          )}
        </TabsContent>

        <TabsContent value="conflicts" className="min-h-0 space-y-2 overflow-y-auto pr-1 [max-height:45vh]">
          {review.conflicts.length === 0 ? (
            <Note>No conflicts. Saved drugs already match the file.</Note>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-2 text-sm">
                <span>
                  {useFileCount} of {review.conflicts.length} will use the file
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setAll("keep")}>
                    Keep all current
                  </Button>
                  <Button size="sm" onClick={() => setAll("file")}>
                    Use file for all
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Stock, pictures and package forms that are only in the app are always kept.
              </p>
              {review.conflicts.slice(0, shownConflicts).map((item) => (
                <ImportConflictCard
                  key={item.drug.drugId}
                  item={item}
                  choice={choiceOf(item.drug.drugId)}
                  onChoose={(c) => setChoices({ ...choices, [item.drug.drugId]: c })}
                />
              ))}
              {shownConflicts < review.conflicts.length && (
                <Button variant="secondary" className="w-full" onClick={() => setShownConflicts(shownConflicts + PAGE)}>
                  Show more
                </Button>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="missing" className="min-h-0 space-y-2 overflow-y-auto pr-1 [max-height:45vh]">
          {review.missing.length === 0 ? (
            <Note>Every saved drug is in the file.</Note>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-2 text-sm">
                <span>Tick the drugs you want to delete. Unticked drugs are left alone.</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setRemove(remove.size === review.missing.length ? new Set() : new Set(review.missing.map((m) => m._id)))
                  }
                >
                  {remove.size === review.missing.length ? "Untick all" : "Tick all"}
                </Button>
              </div>
              {review.missing.slice(0, shownMissing).map((m) => (
                <label key={m._id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 text-sm hover:bg-muted/50">
                  <Checkbox
                    checked={remove.has(m._id)}
                    onCheckedChange={(on) => {
                      const next = new Set(remove);
                      if (on) next.add(m._id);
                      else next.delete(m._id);
                      setRemove(next);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.drugId} · {m.brandName || "No brand"}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.stock} in stock</span>
                </label>
              ))}
              {shownMissing < review.missing.length && (
                <Button variant="secondary" className="w-full" onClick={() => setShownMissing(shownMissing + PAGE)}>
                  Show more
                </Button>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="problems" className="min-h-0 space-y-1 overflow-y-auto pr-1 [max-height:45vh]">
          {review.problems.length === 0 ? (
            <Note>Every row could be read.</Note>
          ) : (
            review.problems.map((p, i) => (
              <div key={`${p.row}-${i}`} className="rounded-md border px-2 py-1.5 text-xs">
                <span className="font-semibold">Row {p.row}</span> · {p.drugId || "no ID"} {p.name} — {p.message}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button onClick={() => void submit()}>Import</Button>
      </DialogFooter>
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-2 text-center", highlight && "border-chart-3 bg-chart-3/10")}>
      <div className="text-xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Note({ children }: { children: string }) {
  return <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{children}</p>;
}

function DoneStep({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const problems = report.failures.length + report.skipped.length;
  return (
    <>
      <div className="min-h-0 space-y-3 overflow-y-auto">
        <div className="flex items-center gap-2 font-semibold">
          {problems > 0 ? (
            <AlertTriangle className="size-5 text-chart-3" />
          ) : (
            <CheckCircle2 className="size-5 text-primary" />
          )}
          Import finished
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Added" value={report.created} />
          <Stat label="Updated" value={report.updated} />
          <Stat label="Deleted" value={report.removed} />
        </div>
        {report.failures.map((f) => (
          <div key={`f-${f.drugId}`} className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {f.drugId} {f.name}: {f.message}
          </div>
        ))}
        {report.skipped.map((s) => (
          <div key={`s-${s.drugId}`} className="rounded-md bg-muted px-2 py-1.5 text-xs">
            {s.drugId} {s.name}: barcode {s.barcodes.join(", ")} skipped (already used by another drug)
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </>
  );
}
