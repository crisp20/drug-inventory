import {
  endOfDay,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";

export const PERIODS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom dates" },
] as const;

export type PeriodValue = (typeof PERIODS)[number]["value"];

// Custom range: calendar days (YYYY-MM-DD) in the user's local time zone
export type Period = { value: PeriodValue; from: string; to: string };

export const ALL_TIME: Period = { value: "all", from: "", to: "" };

function localDay(day: string): Date | null {
  const d = parseISO(day);
  return isValid(d) ? d : null;
}

// UTC start/end instants for the chosen period (local days → ISO strings)
export function periodRange(
  period: Period,
  now: Date = new Date(),
): { since?: string; until?: string } {
  switch (period.value) {
    case "all":
      return {};
    case "today":
      return { since: startOfDay(now).toISOString() };
    case "7d":
      return { since: startOfDay(subDays(now, 6)).toISOString() };
    case "30d":
      return { since: startOfDay(subDays(now, 29)).toISOString() };
    case "month":
      return { since: startOfMonth(now).toISOString() };
    case "custom": {
      const from = localDay(period.from);
      const to = localDay(period.to);
      return {
        since: from ? startOfDay(from).toISOString() : undefined,
        until: to ? endOfDay(to).toISOString() : undefined,
      };
    }
  }
}
