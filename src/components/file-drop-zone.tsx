import { useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";

type FileDropZoneProps = {
  icon: ReactNode;
  label: string;
  hint: string;
  readingLabel: string;
  reading: boolean;
  /** Value for the file input's accept attribute */
  accept: string;
  multiple?: boolean;
  /** Optional check on each file; rejected files show `rejectMessage` */
  isAccepted?: (file: File) => boolean;
  rejectMessage?: string;
  onFiles: (files: File[]) => void;
};

/** Dashed area that accepts files by click or drag and drop */
export default function FileDropZone({
  icon,
  label,
  hint,
  readingLabel,
  reading,
  accept,
  multiple = false,
  isAccepted,
  rejectMessage = "This file type is not supported",
  onFiles,
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const pick = (list: FileList | null) => {
    const all = list ? [...list] : [];
    if (all.length === 0) return;
    if (!multiple && all.length > 1) toast.info("Only the first file is used");
    const chosen = multiple ? all : all.slice(0, 1);
    const files = isAccepted ? chosen.filter(isAccepted) : chosen;
    if (files.length === 0) {
      toast.error(rejectMessage);
      return;
    }
    onFiles(files);
  };

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    // preventDefault is required for the browser to allow a drop here
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    // Ignore leave events fired when moving over child elements
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files);
  };

  return (
    <label
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/40",
        dragging && "border-primary bg-primary/10",
        reading && "pointer-events-none opacity-60",
      )}
    >
      {reading ? <Spinner /> : icon}
      <div className="font-semibold">
        {reading ? readingLabel : dragging ? `Drop the ${multiple ? "files" : "file"} here` : label}
      </div>
      <div className="text-sm text-muted-foreground">{hint}</div>
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
