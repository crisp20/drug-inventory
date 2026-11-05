import { formatPackageForm } from "@/convex/lib/barcode.ts";
import type { ImportPackage } from "@/convex/lib/drugImport.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import type { ReviewItem } from "../_hooks/use-drug-import.ts";

export type Choice = "keep" | "file";

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

export default function ImportConflictCard({
  item,
  choice,
  onChoose,
}: {
  item: ReviewItem;
  choice: Choice;
  onChoose: (c: Choice) => void;
}) {
  const diff = item.check.diff;
  if (!diff) return null;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{item.drug.name}</div>
          <div className="text-xs text-muted-foreground">
            Drug ID {item.drug.drugId} · row {item.drug.row}
          </div>
        </div>
        <div className="flex gap-1">
          <ChoiceButton active={choice === "keep"} onClick={() => onChoose("keep")}>
            Keep current
          </ChoiceButton>
          <ChoiceButton active={choice === "file"} onClick={() => onChoose("file")}>
            Use file
          </ChoiceButton>
        </div>
      </div>

      {diff.fields.length > 0 && (
        <div className="overflow-hidden rounded-lg border text-sm">
          <div className="grid grid-cols-[7rem_1fr_1fr] bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span />
            <span>Current</span>
            <span>In file</span>
          </div>
          {diff.fields.map((f) => (
            <div key={f.label} className="grid grid-cols-[7rem_1fr_1fr] gap-2 border-t px-2 py-1.5">
              <span className="text-muted-foreground">{f.label}</span>
              <span className={cn("min-w-0 break-words", choice === "file" && "line-through opacity-60")}>
                {f.current || "(blank)"}
              </span>
              <span className={cn("min-w-0 break-words font-medium", choice === "keep" && "opacity-60")}>
                {f.file || "(blank)"}
              </span>
            </div>
          ))}
        </div>
      )}

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
      {item.check.clashes.length > 0 && <ClashNote item={item} />}
    </div>
  );
}

export function ClashNote({ item }: { item: ReviewItem }) {
  return (
    <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
      {item.check.clashes
        .map((c) => `Barcode ${c.barcode} already belongs to ${c.otherName} (${c.otherDrugId})`)
        .join("; ")}
      . It will be skipped.
    </p>
  );
}
