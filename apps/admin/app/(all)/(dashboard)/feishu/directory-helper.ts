import type { TFeishuDirectoryPreview, TFeishuDirectoryRow, TFeishuDirectorySelection } from "@/types/feishu";

export function canBindDirectory(preview: TFeishuDirectoryPreview, now = Date.now()): boolean {
  return preview.status === "complete" && Date.parse(preview.expires_at) > now;
}

export function directorySelections(
  preview: TFeishuDirectoryPreview,
  selected: string[],
  manualUsers: Record<string, string>,
  now = Date.now()
): TFeishuDirectorySelection[] {
  if (!canBindDirectory(preview, now)) return [];
  const users = new Set<string>();
  const selectedRows = new Set(selected);
  return preview.rows.flatMap((row) => {
    const userId = row.match_basis === "oidc" ? row.member_id : manualUsers[row.id] || row.member_id;
    if (
      !selectedRows.has(row.id) ||
      row.result ||
      row.match_basis === "identity_conflict" ||
      !userId ||
      users.has(userId)
    )
      return [];
    users.add(userId);
    return [{ row_id: row.id, ...(userId === row.member_id ? {} : { member_id: userId }) }];
  });
}

export function directoryRowStatus(
  row: TFeishuDirectoryRow,
  selected: boolean,
  skipped: boolean,
  manualUserId?: string
) {
  if (row.result) return row.result;
  if (row.match_basis === "identity_conflict") return "identity_conflict";
  if (skipped) return "skipped";
  if (!selected) return "pending";
  return manualUserId && manualUserId !== row.member_id ? "manual" : row.match_basis;
}

export function directorySummary(
  preview: TFeishuDirectoryPreview,
  selected: string[],
  skipped: string[],
  manual: Record<string, string>
) {
  const selectedSet = new Set(selected);
  const skippedSet = new Set(skipped);
  const counts = { automatic: 0, manual: 0, pending: 0, skipped: 0, existing: 0 };
  for (const row of preview.rows) {
    const status = directoryRowStatus(row, selectedSet.has(row.id), skippedSet.has(row.id), manual[row.id]);
    if (status === "already_bound") counts.existing++;
    else if (status === "pending" || status === "unmatched") counts.pending++;
    else if (status === "skipped") counts.skipped++;
    else if (status === "manual") counts.manual++;
    else if (status === "email" || status === "oidc") counts.automatic++;
  }
  return counts;
}

export function validDirectoryBatch(selections: TFeishuDirectorySelection[]): boolean {
  return selections.length > 0 && selections.length <= 20;
}
