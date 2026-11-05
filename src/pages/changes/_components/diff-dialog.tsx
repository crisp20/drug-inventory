import { useState } from "react";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { ChevronRight, FileCode2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { loadDiff, parseDiff, type DiffFile } from "../_lib/changes.ts";

const LINE_STYLE = {
  add: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  remove: "bg-red-500/15 text-red-900 dark:text-red-200",
  context: "text-muted-foreground",
  hunk: "bg-secondary text-secondary-foreground",
} as const;
const LINE_MARK = { add: "+", remove: "-", context: " ", hunk: "" } as const;

function FileDiff({ file }: { file: DiffFile }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 bg-muted px-3 py-2 text-left text-sm hover:bg-secondary"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate font-mono font-semibold">
          {file.path}
        </span>
        {file.status !== "changed" && (
          <span className="rounded bg-background px-1.5 py-0.5 text-xs capitalize">
            {file.status}
          </span>
        )}
        <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          +{file.added}
        </span>
        <span className="shrink-0 text-xs font-semibold text-red-700 dark:text-red-300">
          -{file.removed}
        </span>
      </button>
      {open && (
        <pre className="max-h-[60vh] overflow-auto text-xs leading-5">
          {file.lines.map((l, i) => (
            <div
              key={i}
              className={cn("whitespace-pre px-3", LINE_STYLE[l.kind])}
            >
              <span className="inline-block w-4 select-none opacity-60">
                {LINE_MARK[l.kind]}
              </span>
              {l.text}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

function DiffBody({ version }: { version: string }) {
  const { data, isPending, isError } = useTanstackQuery({
    queryKey: ["change-diff", version],
    queryFn: async () => parseDiff(await loadDiff(version)),
    staleTime: Infinity,
  });
  if (isPending)
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  if (isError || data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No code changes saved for this version.
      </p>
    );
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {data.length} file(s). Green lines were added, red lines removed. Tap a
        file to see its lines.
      </p>
      {data.map((f) => (
        <FileDiff key={f.path} file={f} />
      ))}
    </div>
  );
}

export default function DiffDialog({
  version,
  title,
  onClose,
}: {
  version: string | null;
  title: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={version !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="size-5" />
            Code changes in {version}
          </DialogTitle>
          <DialogDescription>
            {title}. The same lines are in docs/changes/{version}.diff in the
            downloaded code.
          </DialogDescription>
        </DialogHeader>
        {version && <DiffBody version={version} />}
      </DialogContent>
    </Dialog>
  );
}
