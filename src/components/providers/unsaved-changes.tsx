import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useConfirm } from "@/hooks/use-confirm.ts";
import { UnsavedChangesContext, type UnsavedChangesApi } from "@/hooks/use-unsaved-changes.ts";

// Tracks forms with unsaved changes so closing or leaving asks first
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();
  const dirtyRef = useRef(new Set<string>());

  // Browser refresh / tab close: show the browser's own "Leave site?" prompt
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const value = useMemo<UnsavedChangesApi>(
    () => ({
      register: (id) => {
        dirtyRef.current.add(id);
        return () => {
          dirtyRef.current.delete(id);
        };
      },
      hasUnsaved: () => dirtyRef.current.size > 0,
      confirmDiscard: async () =>
        dirtyRef.current.size === 0 ||
        (await confirm({
          title: "Discard unsaved changes?",
          description: "You have changes that haven't been saved. If you leave now, they will be lost.",
          confirmLabel: "Discard changes",
          cancelLabel: "Keep editing",
          destructive: true,
        })),
    }),
    [confirm],
  );

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}
