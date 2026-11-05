import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useUnsavedChangesApi } from "@/hooks/use-unsaved-changes.ts";
import {
  checkForNewVersion,
  refreshReasonAt,
  type RefreshReason,
} from "@/lib/refresh-check.ts";

const TICK_MS = 5_000;
// Look for a newly published version every 5 minutes (and whenever the tab comes back)
const VERSION_CHECK_MS = 5 * 60_000;
// "Finish my entry first" hides the reminder for this long
export const SNOOZE_MS = 2 * 60_000;

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
] as const;

// Watches for a new publish, the admin's idle time and a dropped connection.
// Once a reason is found it stays until the page is refreshed.
export function useRefreshReminder() {
  const convex = useConvex();
  const { hasUnsaved } = useUnsavedChangesApi();
  const settings = useQuery(api.settings.get, {});
  const idleTimeoutMinutes = settings?.idleTimeoutMinutes ?? 0;
  const [reason, setReason] = useState<RefreshReason | null>(null);
  const [open, setOpen] = useState(false);
  const reasonRef = useRef<RefreshReason | null>(null);
  const snoozeUntilRef = useRef(0);

  // Timers, browser events and the backend connection are external systems
  useEffect(() => {
    let lastTick = Date.now();
    let lastActivity = Date.now();
    let lastVersionCheck = Date.now();
    let disconnectedSince: number | null = null;

    const flag = (r: RefreshReason) => {
      if (!reasonRef.current) {
        reasonRef.current = r;
        setReason(r);
      }
      if (Date.now() >= snoozeUntilRef.current) setOpen(true);
    };

    const versionCheck = () => {
      lastVersionCheck = Date.now();
      checkForNewVersion()
        .then((isNew) => isNew && flag("update"))
        .catch(() => undefined);
    };

    const tick = () => {
      const now = Date.now();
      const r = refreshReasonAt({
        now,
        lastTick,
        lastActivity,
        idleTimeoutMinutes,
        disconnectedSince,
      });
      lastTick = now;
      if (r) flag(r);
      // Snoozed to finish an entry: come back once it's recorded, or after the snooze
      else if (
        reasonRef.current &&
        (now >= snoozeUntilRef.current || !hasUnsaved())
      )
        setOpen(true);
      if (now - lastVersionCheck >= VERSION_CHECK_MS) versionCheck();
    };

    // Check first, so touching the screen after the idle limit still asks to refresh
    const onActivity = () => {
      tick();
      lastActivity = Date.now();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      tick();
      versionCheck();
    };

    const unsubscribe = convex.subscribeToConnectionState((s) => {
      if (!s.hasEverConnected) return;
      if (s.isWebSocketConnected) disconnectedSince = null;
      else disconnectedSince ??= Date.now();
    });
    const interval = window.setInterval(tick, TICK_MS);
    for (const e of ACTIVITY_EVENTS)
      window.addEventListener(e, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      for (const e of ACTIVITY_EVENTS)
        window.removeEventListener(e, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [convex, idleTimeoutMinutes, hasUnsaved]);

  const snooze = useCallback(() => {
    snoozeUntilRef.current = Date.now() + SNOOZE_MS;
    setOpen(false);
  }, []);

  return { reason, open, snooze };
}
