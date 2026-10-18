import type { SortableChange } from "@plane/blocks/sortable";

type ProjectOrder = { id: string; sort_order: number | null };

/** Insert next to the visible destination, retaining the order of every hidden project. */
export function getSidebarProjectSortOrder(
  change: SortableChange,
  visibleIds: string[],
  projects: ProjectOrder[],
  group: string
): number | undefined {
  const { id, initialIndex, index } = change;
  if (
    change.group !== group ||
    change.initialGroup !== group ||
    initialIndex === index ||
    visibleIds[initialIndex] !== id ||
    index < 0 ||
    index >= visibleIds.length ||
    !Number.isInteger(index) ||
    !projects.some((project) => project.id === id && project.sort_order !== null)
  )
    return undefined;
  const destination = visibleIds[index];
  const remaining = projects.filter((project) => project.id !== id);
  const destinationIndex = remaining.findIndex((project) => project.id === destination);
  if (destinationIndex < 0) return undefined;
  const insertionIndex = destinationIndex + (index > initialIndex ? 1 : 0);
  const previous = remaining[insertionIndex - 1]?.sort_order;
  const next = remaining[insertionIndex]?.sort_order;
  if (previous == null && next == null) return undefined;
  if (previous == null) return next! - 10000;
  if (next == null) return previous + 10000;
  const order = (previous + next) / 2;
  return order > previous && order < next ? order : undefined;
}
