export function memberDisplayName(
  user: { display_name?: string; first_name?: string; last_name?: string; email?: string } | null | undefined,
  unknownUser: string
): string {
  return (
    user?.display_name?.trim() ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.email ||
    unknownUser
  );
}

export function reconcileSelectedMembers<T extends { member_id: string }>(
  ids: string[],
  previous: T[],
  create: (id: string) => T
): T[] {
  const existing = new Map(previous.map((member) => [member.member_id, member]));
  return [...new Set(ids)].map((id) => existing.get(id) ?? create(id));
}

export type MemberSelectionCandidate = { id: string; searchText: string; suspended: boolean };

export function getEligibleMemberIds(members: MemberSelectionCandidate[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  return members
    .filter((member) => !member.suspended && member.searchText.toLowerCase().includes(normalizedQuery))
    .map((member) => member.id);
}

export function toggleEligibleMembers(selectedIds: string[], eligibleIds: string[]): string[] {
  const selected = new Set(selectedIds);
  const eligible = new Set(eligibleIds);
  return eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id))
    ? selectedIds.filter((id) => !eligible.has(id))
    : [...new Set([...selectedIds, ...eligibleIds])];
}
