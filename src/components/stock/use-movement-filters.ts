import { useState } from "react";
import type { MovementKind } from "@/convex/lib/stock.ts";
import type { MovementFilters } from "./movement-filter-bar.tsx";
import type { MovementLogExtra } from "./movement-log.tsx";
import { ALL_TIME, periodRange } from "./movement-period.ts";

export const CLEARED_FILTERS: MovementFilters = {
  period: ALL_TIME,
  userId: "all",
  reason: "all",
  medicine: null,
  packageId: "all",
};

// Filter state plus the server-side narrowing it maps to.
// `kind` undefined means Stock In and Stock Out together.
export function useMovementFilters(
  defaults: MovementFilters = CLEARED_FILTERS,
  kind?: MovementKind,
) {
  const [filters, setFilters] = useState(defaults);
  const isFiltered =
    filters.period.value !== "all" ||
    filters.userId !== "all" ||
    filters.reason !== "all" ||
    filters.medicine !== null;

  const extra: MovementLogExtra = {
    ...periodRange(filters.period),
    userId: filters.userId === "all" ? undefined : filters.userId,
    // Only Stock Out has reasons
    reason:
      kind !== "in" && filters.reason !== "all" ? filters.reason : undefined,
  };

  return {
    filters,
    setFilters,
    reset: () => setFilters(CLEARED_FILTERS),
    isFiltered,
    extra,
  };
}
