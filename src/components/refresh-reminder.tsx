import {
  CloudOff,
  Clock,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useRefreshReminder } from "@/hooks/use-refresh-reminder.ts";
import { useUnsavedChangesApi } from "@/hooks/use-unsaved-changes.ts";
import type { RefreshReason } from "@/lib/refresh-check.ts";

const COPY: Record<
  RefreshReason,
  { icon: LucideIcon; title: string; description: string }
> = {
  update: {
    icon: Sparkles,
    title: "A new version of ACP Stock is ready",
    description:
      "Refresh to start using the latest version. Older screens may not save entries correctly.",
  },
  idle: {
    icon: Clock,
    title: "Please refresh to continue",
    description:
      "ACP Stock has not been used for a while. Refresh to make sure you see the latest stock levels.",
  },
  connection: {
    icon: CloudOff,
    title: "The connection was lost",
    description:
      "The app lost its connection (for example, the computer went to sleep). Refresh to make sure you see the latest stock levels.",
  },
};

// App-wide pop-up asking the user to refresh. It can't be closed, except to
// finish a half-filled entry first.
export default function RefreshReminder() {
  const { reason, open, snooze } = useRefreshReminder();
  const { hasUnsaved, clearAll } = useUnsavedChangesApi();
  if (!reason) return null;
  const copy = COPY[reason];
  const unsaved = open && hasUnsaved();

  const refresh = () => {
    // The user already agreed below, so skip the browser's own "Leave site?" prompt
    clearAll();
    window.location.reload();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground sm:mx-0">
            <copy.icon className="size-6" />
          </div>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {unsaved && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
            You have an entry that hasn't been recorded yet. Finish and record
            it first, or it will be lost when you refresh.
          </p>
        )}
        <AlertDialogFooter>
          {unsaved && (
            <Button
              variant="secondary"
              onClick={snooze}
              className="cursor-pointer"
            >
              Finish my entry first
            </Button>
          )}
          <Button
            variant={unsaved ? "destructive" : "default"}
            onClick={refresh}
            className="cursor-pointer"
          >
            <RefreshCw />
            {unsaved ? "Refresh and lose entry" : "Refresh now"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
