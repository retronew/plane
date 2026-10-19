import type { TAnalyticsDetailRow } from "@plane/types";

export function projectCompletion(rows: TAnalyticsDetailRow[]) {
  const completed = rows.reduce((sum, row) => sum + Number(row.completed ?? 0), 0);
  const effective = rows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.work_items ?? 0) - Number(row.cancelled ?? 0)),
    0
  );
  return effective ? Math.round((completed * 100) / effective) : 0;
}
