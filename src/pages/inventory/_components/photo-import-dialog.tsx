import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import FileDropZone from "@/components/file-drop-zone.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";
import { readPhotoFiles } from "../_lib/read-photo-files.ts";
import { usePhotoImport, type PhotoReport, type PhotoReview } from "../_hooks/use-photo-import.ts";
import type { Choice } from "../_lib/import-choices.ts";
import { applyKeepChoice, photosToUpload, splitMatches } from "../_lib/photo-choices.ts";
import ImportConflictsBar from "./import-conflicts-bar.tsx";
import { AddPhotoRow, ReplacePhotoRow } from "./photo-review-rows.tsx";

const PAGE = 60;

type Step =
  | { name: "pick" }
  | { name: "review"; review: PhotoReview; ignored: string[]; duplicates: string[] }
  | { name: "done"; report: PhotoReport };

type Importer = ReturnType<typeof usePhotoImport>;

export default function PhotoImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<Step>({ name: "pick" });
  const importer = usePhotoImport();
  const reset = (o: boolean) => {
    if (!o) setStep({ name: "pick" });
    onOpenChange(o);
  };
  return (
    // Closing mid-upload would stop the remaining photos, so block it while busy
    <Dialog open={open} onOpenChange={(o) => !importer.progress && reset(o)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload drug photos</DialogTitle>
          <DialogDescription>
            Name each photo by its Drug ID, for example 25.jpg. Each photo becomes that drug's main picture. For drugs
            that already have one, you can compare and choose to keep the current picture.
          </DialogDescription>
        </DialogHeader>
        <Steps step={step} setStep={setStep} importer={importer} onClose={() => reset(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Steps({
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

  const onFiles = async (files: File[]) => {
    setReading(true);
    try {
      const picked = await readPhotoFiles(files);
      if (picked.photos.length === 0) {
        toast.error("No photos named by Drug ID were found");
        return;
      }
      const review = await importer.check(picked.photos);
      setStep({ name: "review", review, ignored: picked.ignored, duplicates: picked.duplicates });
    } catch (error) {
      toast.error(errorMessage(error, "The photos could not be read"));
    } finally {
      setReading(false);
    }
  };

  if (importer.progress) {
    const { label, done, total } = importer.progress;
    return (
      <div className="space-y-3 py-8 text-center">
        <Spinner className="mx-auto" />
        <div className="font-medium">
          {label}… {total > 1 && `${done.toLocaleString()} of ${total.toLocaleString()}`}
        </div>
        {total > 0 && <Progress value={(done / total) * 100} className="mx-auto max-w-sm" />}
        <p className="text-xs text-muted-foreground">Keep this window open until it finishes.</p>
      </div>
    );
  }

  if (step.name === "pick") {
    return (
      // No type filter here: readPhotoFiles reports unusable files in the Skipped list
      <FileDropZone
        icon={<ImageUp className="size-8 text-primary" />}
        label="Drag a zip file or photos here, or click to choose"
        hint="JPG, PNG or WebP. Nothing is saved until you confirm."
        readingLabel="Reading photos…"
        reading={reading}
        accept=".zip,image/jpeg,image/png,image/webp,image/gif"
        multiple
        onFiles={(files) => void onFiles(files)}
      />
    );
  }

  if (step.name === "review") {
    return <ReviewStep {...step} importer={importer} onBack={() => setStep({ name: "pick" })} onDone={(report) => setStep({ name: "done", report })} />;
  }

  return <DoneStep report={step.report} onClose={onClose} />;
}

function ReviewStep({
  review,
  ignored,
  duplicates,
  importer,
  onBack,
  onDone,
}: {
  review: PhotoReview;
  ignored: string[];
  duplicates: string[];
  importer: Importer;
  onBack: () => void;
  onDone: (r: PhotoReport) => void;
}) {
  const [shownAdd, setShownAdd] = useState(PAGE);
  const [shownReplace, setShownReplace] = useState(PAGE);
  // Drug IDs whose current picture is kept; empty = replace all (the default)
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { adding, replacing } = splitMatches(review.matched);
  const toUpload = photosToUpload(review.matched, keep);
  const keptCount = review.matched.length - toUpload.length;
  const skipped = [
    ...review.notFound.map((p) => `${p.fileName}: no drug with Drug ID ${p.drugId}`),
    ...ignored.map((f) => `${f}: not a photo named by Drug ID`),
    ...duplicates.map((f) => `${f}: another photo for the same Drug ID was used`),
  ];

  const choose = (drugId: string, c: Choice) => setKeep(applyKeepChoice(keep, replacing, new Set([drugId]), c));
  const applyChoice = (c: Choice) => {
    setKeep(applyKeepChoice(keep, replacing, selected, c));
    if (selected.size > 0) {
      toast.success(`${c === "file" ? "Replacing" : "Keeping current"} for ${selected.size} drug${selected.size === 1 ? "" : "s"}`);
      setSelected(new Set());
    }
  };
  const toggleSelected = (drugId: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(drugId);
    else next.delete(drugId);
    setSelected(next);
  };

  const submit = async () => {
    try {
      onDone(await importer.run(toUpload));
    } catch (error) {
      toast.error(errorMessage(error, "The upload stopped part way. Upload the photos again to continue."));
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Will be added" value={adding.length} />
        <Stat label={keptCount > 0 ? `Will replace (${keptCount} kept)` : "Will replace"} value={replacing.length - keptCount} />
        <Stat label="Skipped" value={skipped.length} highlight={skipped.length > 0} />
      </div>
      <Tabs defaultValue={replacing.length > 0 ? "replace" : "add"} className="min-h-0 flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="add">Will be added ({adding.length})</TabsTrigger>
          <TabsTrigger value="replace">Will replace ({replacing.length})</TabsTrigger>
          <TabsTrigger value="skipped">Skipped ({skipped.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="add" className="min-h-0 space-y-1 overflow-y-auto pr-1 [max-height:45vh]">
          {adding.length === 0 ? (
            <Note>No new pictures. Every matched drug already has one.</Note>
          ) : (
            <>
              {adding.slice(0, shownAdd).map((m) => (
                <AddPhotoRow key={m.drugId} m={m} />
              ))}
              {shownAdd < adding.length && (
                <Button variant="secondary" className="w-full" onClick={() => setShownAdd(shownAdd + PAGE)}>
                  Show more
                </Button>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="replace" className="min-h-0 space-y-1 overflow-y-auto pr-1 [max-height:45vh]">
          {replacing.length === 0 ? (
            <Note>No current pictures will be replaced.</Note>
          ) : (
            <>
              <ImportConflictsBar
                total={replacing.length}
                selected={selected.size}
                useFileCount={replacing.length - keptCount}
                onSelectAll={(on) => setSelected(on ? new Set(replacing.map((m) => m.drugId)) : new Set())}
                onApply={applyChoice}
              />
              {replacing.slice(0, shownReplace).map((m) => (
                <ReplacePhotoRow
                  key={m.drugId}
                  m={m}
                  choice={keep.has(m.drugId) ? "keep" : "file"}
                  onChoose={(c) => choose(m.drugId, c)}
                  selected={selected.has(m.drugId)}
                  onSelectedChange={(on) => toggleSelected(m.drugId, on)}
                />
              ))}
              {shownReplace < replacing.length && (
                <Button variant="secondary" className="w-full" onClick={() => setShownReplace(shownReplace + PAGE)}>
                  Show more
                </Button>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="skipped" className="min-h-0 space-y-1 overflow-y-auto pr-1 [max-height:45vh]">
          {skipped.length === 0 ? (
            <Note>Every photo matches a saved drug.</Note>
          ) : (
            skipped.map((s) => (
              <div key={s} className="rounded-md border px-2 py-1.5 text-xs">
                {s}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button variant="ghost" onClick={onBack}>
          Choose other photos
        </Button>
        <Button disabled={toUpload.length === 0} onClick={() => void submit()}>
          Upload {toUpload.length.toLocaleString()} photos
          {keptCount > 0 && ` (${keptCount.toLocaleString()} kept current)`}
        </Button>
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

function DoneStep({ report, onClose }: { report: PhotoReport; onClose: () => void }) {
  return (
    <>
      <div className="min-h-0 space-y-3 overflow-y-auto">
        <div className="flex items-center gap-2 font-semibold">
          {report.failed.length > 0 ? (
            <AlertTriangle className="size-5 text-chart-3" />
          ) : (
            <CheckCircle2 className="size-5 text-primary" />
          )}
          {report.applied.toLocaleString()} photos saved
        </div>
        {report.failed.map((f) => (
          <div key={f.drugId} className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {f.drugId}: {f.message}
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </>
  );
}
