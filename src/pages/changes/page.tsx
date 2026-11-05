import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code2, Database } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import PageHeader from "@/components/page-header.tsx";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import DiffDialog from "./_components/diff-dialog.tsx";
import { CHANGE_ENTRIES, hasDiff } from "./_lib/changes.ts";

// A database change is anything other than "None..." under the Database heading
function changesDatabase(body: string): boolean {
  const section =
    /\*\*Database\*\*\n([\s\S]*?)(\n\*\*|$)/.exec(body)?.[1] ?? "";
  return section.trim() !== "" && !/^- None\b/.test(section.trim());
}

export default function ChangesPage() {
  const me = useCurrentUser();
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const entries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return CHANGE_ENTRIES;
    return CHANGE_ENTRIES.filter((e) =>
      `${e.version} ${e.title} ${e.body}`.toLowerCase().includes(term),
    );
  }, [search]);

  if (me === undefined) return null;
  if (!me || me.role !== "director") return <Navigate to="/" replace />;
  const openTitle = CHANGE_ENTRIES.find((e) => e.version === open)?.title ?? "";

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="Changes"
        description="What changed in each version, for developers updating their own copy. Also in docs/CHANGELOG.md in the downloaded code."
      />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search changes, e.g. canister or settings"
        className="mb-6 h-11"
      />
      <div className="space-y-4">
        {entries.map((e) => (
          <article key={e.version} className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary px-2 py-0.5 text-sm font-bold text-primary-foreground">
                    {e.version}
                  </span>
                  {changesDatabase(e.body) && (
                    <span className="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                      <Database className="size-3.5" />
                      Database change
                    </span>
                  )}
                </div>
                <h2 className="pt-2 text-lg font-bold">{e.title}</h2>
              </div>
              {hasDiff(e.version) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen(e.version)}
                >
                  <Code2 />
                  View code changes
                </Button>
              )}
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert prose-code:break-words prose-code:before:content-none prose-code:after:content-none">
              <Markdown remarkPlugins={[remarkGfm]}>{e.body}</Markdown>
            </div>
          </article>
        ))}
        {entries.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No changes match your search.
          </p>
        )}
      </div>
      <DiffDialog
        version={open}
        title={openTitle}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
