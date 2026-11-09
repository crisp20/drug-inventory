#!/usr/bin/env node
// Keeps docs/CHANGELOG.md file lists in sync with docs/changes/vN.diff.
//
//   node docs/update-changelog.mjs            refresh every "files" block
//   node docs/update-changelog.mjs v51 HEAD   first save the uncommitted changes
//                                             against HEAD as docs/changes/v51.diff
//
// Each entry in CHANGELOG.md has a block like:
//   <!-- files:v51 -->
//   <!-- /files -->
// which this script fills with every changed file and its added/removed line counts.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = dirname(fileURLToPath(import.meta.url));
const CHANGES = join(DOCS, "changes");
const LOG = join(DOCS, "CHANGELOG.md");

// Generated or bulky files that a developer never edits by hand
const EXCLUDE = [
  "convex/_generated",
  "src/components/ui",
  "pnpm-lock.yaml",
  "docs",
  "tmp-photos",
  "tmp-import",
  "tmp-pdf",
  "convex/drugImportSeedData.ts",
];

const [version, base] = process.argv.slice(2);
if (version) {
  if (!/^v\d+$/.test(version) || !base) {
    console.error("Usage: node docs/update-changelog.mjs v51 HEAD");
    process.exit(1);
  }
  const diff = execFileSync(
    "git",
    [
      "diff",
      "--no-color",
      base,
      "--",
      ".",
      ...EXCLUDE.map((p) => `:(exclude)${p}`),
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  // New files are not in git yet, so add them as full "added" diffs
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--", "src", "convex", "public", "index.html"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((f) => f && !EXCLUDE.some((p) => f.startsWith(p)));
  const added = untracked.map((f) => {
    const lines = readFileSync(f, "utf8").replace(/\n$/, "").split("\n");
    return [
      `diff --git a/${f} b/${f}`,
      "new file mode 100644",
      "--- /dev/null",
      `+++ b/${f}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map((l) => `+${l}`),
    ].join("\n");
  });
  writeFileSync(join(CHANGES, `${version}.diff`), [diff, ...added].join("\n"));
  console.log(`Saved docs/changes/${version}.diff`);
}

// Per-file added/removed line counts from a unified diff
function fileStats(diff) {
  const files = [];
  let current = null;
  for (const line of diff.split("\n")) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) {
      current = { path: header[2], added: 0, removed: 0, status: "changed" };
      files.push(current);
    } else if (!current) continue;
    else if (line.startsWith("new file")) current.status = "new";
    else if (line.startsWith("deleted file")) current.status = "deleted";
    else if (line.startsWith("rename from ")) current.from = line.slice(12);
    else if (line.startsWith("+") && !line.startsWith("+++")) current.added++;
    else if (line.startsWith("-") && !line.startsWith("---")) current.removed++;
  }
  return files;
}

function filesBlock(v) {
  const path = join(CHANGES, `${v}.diff`);
  if (!existsSync(path)) return "_No code diff saved for this version._";
  const files = fileStats(readFileSync(path, "utf8"));
  if (files.length === 0) return "_No code changes._";
  const rows = files.map((f) => {
    const note =
      f.status === "new" ? " (new)" : f.status === "deleted" ? " (deleted)" : f.from ? ` (renamed from \`${f.from}\`)` : "";
    return `- \`${f.path}\`${note} +${f.added} -${f.removed}`;
  });
  return [
    `<details><summary>All files changed (${files.length}) · code: docs/changes/${v}.diff</summary>`,
    "",
    ...rows,
    "",
    "</details>",
  ].join("\n");
}

const log = readFileSync(LOG, "utf8").replace(
  /<!-- files:(v\d+) -->[\s\S]*?<!-- \/files -->/g,
  (_, v) => `<!-- files:${v} -->\n${filesBlock(v)}\n<!-- /files -->`,
);
writeFileSync(LOG, log);
console.log("Updated docs/CHANGELOG.md");
