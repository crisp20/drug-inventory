import { createContext, useContext, useEffect, useId } from "react";

export type UnsavedChangesApi = {
  register: (id: string) => () => void;
  hasUnsaved: () => boolean;
  // Resolves true when there is nothing unsaved or the user agrees to discard it
  confirmDiscard: () => Promise<boolean>;
};

export const UnsavedChangesContext = createContext<UnsavedChangesApi | null>(null);

export function useUnsavedChangesApi(): UnsavedChangesApi {
  const api = useContext(UnsavedChangesContext);
  if (!api) throw new Error("useUnsavedChangesApi must be used inside UnsavedChangesProvider");
  return api;
}

// Marks the calling form as having unsaved changes while `dirty` is true
export function useUnsavedChanges(dirty: boolean) {
  const { register } = useUnsavedChangesApi();
  const id = useId();
  useEffect(() => (dirty ? register(id) : undefined), [register, dirty, id]);
}

export function useConfirmDiscard() {
  return useUnsavedChangesApi().confirmDiscard;
}
