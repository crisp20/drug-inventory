import { useState } from "react";
import { useConvex, usePaginatedQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { Download, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import PageHeader from "@/components/page-header.tsx";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import { errorMessage } from "@/lib/errors.ts";
import ActivityEntry from "./_components/activity-entry.tsx";
import LogFilterBar from "./_components/log-filter-bar.tsx";
import {
  downloadLogCsv,
  fetchAllEntries,
  MAX_EXPORT_ROWS,
} from "./_lib/export-log.ts";
import { useLogFilters, type LogQueryArgs } from "./_lib/log-filters.ts";

const PAGE = 50;

export default function LogPage() {
  const me = useCurrentUser();
  if (me === undefined) return null;
  if (!me || me.role !== "director") return <Navigate to="/" replace />;
  return <LogView />;
}

function LogView() {
  const { filters, setFilters, reset, isFiltered, args } = useLogFilters();
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Log"
          description="Every change made in ACP Stock, newest first."
        />
        <ExportButton args={args} />
      </div>
      <LogFilterBar
        value={filters}
        onChange={setFilters}
        onReset={reset}
        isFiltered={isFiltered}
      />
      <LogList args={args} isFiltered={isFiltered} onReset={reset} />
    </div>
  );
}

function ExportButton({ args }: { args: LogQueryArgs }) {
  const convex = useConvex();
  const [busy, setBusy] = useState(false);
  const handleExport = async () => {
    setBusy(true);
    try {
      const { entries, truncated } = await fetchAllEntries(convex, args);
      if (entries.length === 0) {
        toast("Nothing to download for these filters");
        return;
      }
      downloadLogCsv(entries);
      if (truncated) {
        toast.warning(
          `Only the newest ${MAX_EXPORT_ROWS.toLocaleString()} entries were included. Narrow the time period to get the rest.`,
        );
      }
    } catch (e) {
      toast.error(errorMessage(e, "Could not download the log"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => void handleExport()}
      disabled={busy}
    >
      {busy ? <Spinner /> : <Download className="size-4" />}
      Download CSV
    </Button>
  );
}

type ListProps = {
  args: LogQueryArgs;
  isFiltered: boolean;
  onReset: () => void;
};

function LogList({ args, isFiltered, onReset }: ListProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.activity.list,
    args,
    { initialNumItems: PAGE },
  );

  if (status === "LoadingFirstPage") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (status === "Exhausted" && results.length === 0) {
    return (
      <Empty className="rounded-xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ScrollText />
          </EmptyMedia>
          <EmptyTitle>
            {isFiltered ? "No matching activity" : "No activity yet"}
          </EmptyTitle>
          <EmptyDescription>
            {isFiltered
              ? "Try a longer time period or clear the filters."
              : "Changes to medicines, stock and users will appear here."}
          </EmptyDescription>
        </EmptyHeader>
        {isFiltered && (
          <Button size="sm" variant="secondary" onClick={onReset}>
            Clear filters
          </Button>
        )}
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {results.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {results.map((e) => (
            <ActivityEntry key={e._id} entry={e} />
          ))}
        </ul>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(PAGE)}
          >
            {status === "LoadingMore" && <Spinner />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
