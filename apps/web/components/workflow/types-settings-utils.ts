import type { TProjectIssueType } from "@plane/types";

export type TypesStatusFilter = "all" | "active" | "inactive";
export function filterIssueTypes(
  types: TProjectIssueType[],
  search: string,
  status: TypesStatusFilter,
  descending: boolean
) {
  const query = search.trim().toLocaleLowerCase();
  return (
    types
      .filter(
        (type) =>
          (!query || `${type.name} ${type.description ?? ""}`.toLocaleLowerCase().includes(query)) &&
          (status === "all" || type.is_active === (status === "active"))
      )
      // filter returns a fresh array; ES target does not include toSorted.
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => (descending ? -1 : 1) * a.name.localeCompare(b.name))
  );
}
export function groupIssueTypeLevels(types: TProjectIssueType[]) {
  const levels = new Map<number, TProjectIssueType[]>();
  for (const type of types) {
    const level = type.level ?? 0;
    levels.set(level, [...(levels.get(level) ?? []), type]);
  }
  // This sorts a newly allocated array; ES target does not include toSorted.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...levels].sort(([a], [b]) => b - a);
}
