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
