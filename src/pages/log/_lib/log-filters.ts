import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { ActivityCategory } from "@/convex/lib/activity.ts";
import {
  ALL_TIME,
  periodRange,
  type Period,
} from "@/components/stock/movement-period.ts";
import type { DrugWithDetails } from "@/lib/drug-types.ts";

export type LogFilters = {
  period: Period;
  userId: Id<"users"> | "all";
  category: ActivityCategory | "all";
  medicine: DrugWithDetails | null;
};

export type LogQueryArgs = {
  category?: ActivityCategory;
  drugId?: Id<"drugs">;
  userId?: Id<"users">;
  since?: string;
  until?: string;
};

const CLEARED: LogFilters = {
  period: ALL_TIME,
  userId: "all",
  category: "all",
  medicine: null,
};

export function toQueryArgs(f: LogFilters): LogQueryArgs {
  return {
    ...periodRange(f.period),
    category: f.category === "all" ? undefined : f.category,
    drugId: f.medicine?._id,
    userId: f.userId === "all" ? undefined : f.userId,
  };
}

export function useLogFilters() {
  const [filters, setFilters] = useState(CLEARED);
  const isFiltered =
    filters.period.value !== "all" ||
    filters.userId !== "all" ||
    filters.category !== "all" ||
    filters.medicine !== null;
  return {
    filters,
    setFilters,
    reset: () => setFilters(CLEARED),
    isFiltered,
    args: toQueryArgs(filters),
  };
}
