// Narrows any index range ending in occurredAt to [since, until]
export type OccurredAtRange<R> = {
  gte(
    field: "occurredAt",
    value: string,
  ): {
    lte(field: "occurredAt", value: string): R;
  } & R;
  lte(field: "occurredAt", value: string): R;
} & R;

export function withinPeriod<R>(
  q: OccurredAtRange<R>,
  since: string | undefined,
  until: string | undefined,
): R {
  if (since && until)
    return q.gte("occurredAt", since).lte("occurredAt", until);
  if (since) return q.gte("occurredAt", since);
  if (until) return q.lte("occurredAt", until);
  return q;
}
