import { formatPackageForm } from "@/convex/lib/barcode.ts";
import type { FieldChange, ImportPackage, NoteKey } from "@/convex/lib/drugImport.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import ZoomableDrugImage from "@/components/zoomable-drug-image.tsx";
import { cn } from "@/lib/utils.ts";
import type { ReviewItem } from "../_hooks/use-drug-import.ts";
import { allChoices, type BarcodeFixes, type Choice, type DrugChoices } from "../_lib/import-choices.ts";
import BarcodeClashFix from "./barcode-clash-fix.tsx";

function pkgLabel(p: ImportPackage) {
  return `${formatPackageForm(p)}${p.barcode ? ` · ${p.barcode}` : " · no barcode"}`;
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function ChoicePair({ choice, onChoose }: { choice: Choice; onChoose: (c: Choice) => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <ChoiceButton active={choice === "keep"} onClick={() => onChoose("keep")}>
        Keep current
      </ChoiceButton>
      <ChoiceButton active={choice === "file"} onClick={() => onChoose("file")}>
        Use file
      </ChoiceButton>
    </div>
  );
}

function FieldRows({ fields, choice }: { fields: FieldChange[]; choice: Choice }) {
  return (
    <div className="overflow-hidden rounded-lg border text-sm">
      <div className="grid grid-cols-[7rem_1fr_1fr] bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span />
        <span>Current</span>
        <span>In file</span>
      </div>
      {fields.map((f) => (
        <div key={f.label} className="grid grid-cols-[7rem_1fr_1fr] gap-2 border-t px-2 py-1.5">
          <span className="text-muted-foreground">{f.label}</span>
          <span className={cn("min-w-0 whitespace-pre-line break-words", choice === "file" && "line-through opacity-60")}>
            {f.current || "(blank)"}
          </span>
          <span className={cn("min-w-0 whitespace-pre-line break-words font-medium", choice === "keep" && "opacity-60")}>
            {f.file || "(blank)"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ImportConflictCard({
  item,
  choices,
  onChange,
  selected,
  onSelectedChange,
  barcodeFixes,
  onBarcodeFixesChange,
}: {
  item: ReviewItem;
  choices: DrugChoices;
  onChange: (c: DrugChoices) => void;
  selected: boolean;
  onSelectedChange: (on: boolean) => void;
  barcodeFixes: BarcodeFixes | undefined;
  onBarcodeFixesChange: (fixes: BarcodeFixes) => void;
}) {
  const diff = item.check.diff;
  if (!diff) return null;
  const askNotes = diff.notes.filter((n) => !n.auto);
  const autoNotes = diff.notes.filter((n) => n.auto);
  const askLasa = diff.lasa && !diff.lasa.auto ? diff.lasa : null;
  const askDda = diff.dda && !diff.dda.auto ? diff.dda : null;
  const decisions = (diff.detailChanges ? 1 : 0) + askNotes.length + (askLasa ? 1 : 0) + (askDda ? 1 : 0);
  const yesNo = (b: boolean) => (b ? "Yes" : "No");
  const setNote = (key: NoteKey, c: Choice) => onChange({ ...choices, notes: { ...choices.notes, [key]: c } });

  return (
    <div className={cn("space-y-3 rounded-xl border bg-card p-3 transition-colors", selected && "border-primary bg-primary/5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(on) => onSelectedChange(on === true)}
            aria-label={`Select ${item.drug.name}`}
            className="mt-1"
          />
          <ZoomableDrugImage url={item.check.imageUrl} alt={item.drug.name} className="size-16" hoverPreview />
          <div className="min-w-0">
            <div className="truncate font-semibold">{item.drug.name}</div>
            <div className="text-xs text-muted-foreground">
              Drug ID {item.drug.drugId} · row {item.drug.row}
            </div>
          </div>
        </div>
        {decisions > 1 && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange(allChoices(item, "keep"))}
              className="cursor-pointer text-xs font-medium text-primary hover:underline"
            >
              Keep all
            </button>
            <span className="text-xs text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => onChange(allChoices(item, "file"))}
              className="cursor-pointer text-xs font-medium text-primary hover:underline"
            >
              Use file for all
            </button>
          </div>
        )}
      </div>

      {diff.detailChanges && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drug details</span>
            <ChoicePair choice={choices.details} onChoose={(c) => onChange({ ...choices, details: c })} />
          </div>
          {diff.fields.length > 0 && <FieldRows fields={diff.fields} choice={choices.details} />}
          {(diff.added.length > 0 || diff.changed.length > 0) && (
            <div className="space-y-1 text-sm">
              {diff.added.map((p) => (
                <div key={pkgLabel(p)} className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">New package form</Badge>
                  <span>{pkgLabel(p)}</span>
                </div>
              ))}
              {diff.changed.map((c) => (
                <div key={pkgLabel(c.file)} className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Form differs</Badge>
                  <span>
                    {c.file.barcode || "no barcode"}: {formatPackageForm(c.current)} → {formatPackageForm(c.file)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {askNotes.map((n) => {
        const choice = choices.notes[n.key] ?? "keep";
        return (
          <div key={n.key} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{n.label}</span>
              <ChoicePair choice={choice} onChoose={(c) => setNote(n.key, c)} />
            </div>
            <FieldRows fields={[n]} choice={choice} />
          </div>
        );
      })}

      {askLasa && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Look Alike, Sound Alike
            </span>
            <ChoicePair
              choice={choices.lasa ?? "keep"}
              onChoose={(c) => onChange({ ...choices, lasa: c })}
            />
          </div>
          <FieldRows
            fields={[{ label: "Marked", current: yesNo(askLasa.current), file: yesNo(askLasa.file) }]}
            choice={choices.lasa ?? "keep"}
          />
          <p className="text-xs text-muted-foreground">Using the file also removes its links to look-alike drugs.</p>
        </div>
      )}

      {diff.lasa?.auto && (
        <p className="text-xs text-muted-foreground">Will be marked Look Alike, Sound Alike from the file.</p>
      )}

      {askDda && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dangerous Drug (DDA)
            </span>
            <ChoicePair choice={choices.dda ?? "keep"} onChoose={(c) => onChange({ ...choices, dda: c })} />
          </div>
          <FieldRows
            fields={[{ label: "Marked", current: yesNo(askDda.current), file: yesNo(askDda.file) }]}
            choice={choices.dda ?? "keep"}
          />
        </div>
      )}

      {diff.dda?.auto && (
        <p className="text-xs text-muted-foreground">Will be marked Dangerous Drug (DDA) from the file.</p>
      )}

      {autoNotes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {autoNotes.map((n) => n.label).join(" and ")} {autoNotes.length === 1 ? "is" : "are"} blank in the app and
          will be filled from the file.
        </p>
      )}
      {item.check.clashes.length > 0 && (
        <BarcodeClashFix item={item} fixes={barcodeFixes} onChange={onBarcodeFixesChange} />
      )}
    </div>
  );
}
