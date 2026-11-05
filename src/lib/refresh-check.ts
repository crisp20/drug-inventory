// Decides when the app should ask the user to refresh the page.

export type RefreshReason = "update" | "idle" | "connection";

// A connection that stays down this long (e.g. the computer slept) needs a refresh
export const CONNECTION_LOST_MS = 60_000;
// The app's own timer runs every few seconds; a much longer gap means the device slept
export const SLEEP_GAP_MS = 2 * 60_000;

export type RefreshCheckInput = {
  now: number;
  // Last time the timer ran before this run
  lastTick: number;
  lastActivity: number;
  // 0 = off
  idleTimeoutMinutes: number;
  // When the connection to the backend dropped; null while connected
  disconnectedSince: number | null;
};

// Idle and connection checks (a new version is detected separately)
export function refreshReasonAt(
  input: RefreshCheckInput,
): RefreshReason | null {
  const { now, lastTick, lastActivity, idleTimeoutMinutes, disconnectedSince } =
    input;
  if (
    idleTimeoutMinutes > 0 &&
    now - lastActivity >= idleTimeoutMinutes * 60_000
  ) {
    return "idle";
  }
  if (
    disconnectedSince !== null &&
    now - disconnectedSince >= CONNECTION_LOST_MS
  ) {
    return "connection";
  }
  if (now - lastTick >= SLEEP_GAP_MS) return "connection";
  return null;
}

// Built files (e.g. /assets/index-AbC123.js) change name on every publish.
// Dev mode has no /assets/ scripts, so nothing is compared there.
export function builtScripts(doc: Document): string[] {
  return Array.from(doc.querySelectorAll("script[type='module'][src]"))
    .map((s) => s.getAttribute("src") ?? "")
    .filter((src) => src.includes("/assets/"));
}

export function isNewVersion(current: string[], latest: string[]): boolean {
  return (
    current.length > 0 &&
    latest.length > 0 &&
    latest.some((src) => !current.includes(src))
  );
}

// Fetches the published page and compares its built files with the ones running now
export async function checkForNewVersion(): Promise<boolean> {
  const current = builtScripts(document);
  if (current.length === 0) return false;
  const res = await fetch(`/?version-check=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) return false;
  const html = await res.text();
  const latest = builtScripts(
    new DOMParser().parseFromString(html, "text/html"),
  );
  return isNewVersion(current, latest);
}
