// Reads docs/CHANGELOG.md and docs/changes/vN.diff for the admin Changes page.
import changelog from "../../../../docs/CHANGELOG.md?raw";

export type ChangeEntry = {
  version: string;
  title: string;
  body: string;
};

export type DiffLine = {
  kind: "add" | "remove" | "context" | "hunk";
  text: string;
};
export type DiffFile = {
  path: string;
  status: "new" | "deleted" | "changed";
  added: number;
  removed: number;
  lines: DiffLine[];
};

const diffLoaders = import.meta.glob<string>(
  "../../../../docs/changes/*.diff",
  {
    query: "?raw",
    import: "default",
  },
);

// The generated file lists are shown from the diff itself, so they are dropped here
const FILES_BLOCK = /<!-- files:v\d+ -->[\s\S]*?<!-- \/files -->/g;

export function parseChangelog(text: string): ChangeEntry[] {
  return text
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [heading, ...rest] = section.split("\n");
      const version = /^v\d+/.exec(heading)?.[0] ?? "";
      return {
        version,
        title: heading.replace(/^v\d+\s*·\s*/, ""),
        body: rest
          .join("\n")
          .replace(FILES_BLOCK, "")
          .replace(/\n---\s*$/, "")
          .trim(),
      };
    })
    .filter((e) => e.version);
}

export const CHANGE_ENTRIES = parseChangelog(changelog);

export function hasDiff(version: string): boolean {
  return `../../../../docs/changes/${version}.diff` in diffLoaders;
}

export async function loadDiff(version: string): Promise<string> {
  const load = diffLoaders[`../../../../docs/changes/${version}.diff`];
  return load ? await load() : "";
}

// Splits a unified diff into files with their added/removed/context lines
export function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let inBody = false;
  for (const line of diff.split("\n")) {
    const header = /^diff --git a\/.+? b\/(.+)$/.exec(line);
    if (header) {
      current = {
        path: header[1],
        status: "changed",
        added: 0,
        removed: 0,
        lines: [],
      };
      files.push(current);
      inBody = false;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("@@")) {
      inBody = true;
      current.lines.push({ kind: "hunk", text: line });
    } else if (!inBody) {
      if (line.startsWith("new file")) current.status = "new";
      else if (line.startsWith("deleted file")) current.status = "deleted";
    } else if (line.startsWith("+")) {
      current.added++;
      current.lines.push({ kind: "add", text: line.slice(1) });
    } else if (line.startsWith("-")) {
      current.removed++;
      current.lines.push({ kind: "remove", text: line.slice(1) });
    } else if (line.startsWith(" ")) {
      current.lines.push({ kind: "context", text: line.slice(1) });
    }
  }
  return files;
}
