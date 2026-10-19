import { parseISO } from "date-fns";

export function parseCustomAnalyticsRange(value: string | null) {
  const match = value?.match(/^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  const from = parseISO(match[1]),
    to = parseISO(match[2]);
  return Number.isNaN(+from) || Number.isNaN(+to) || from > to ? null : { from, to };
}
