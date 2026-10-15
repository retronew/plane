import type { SortableChange } from "@plane/blocks/sortable";
import type { IState } from "@plane/types";

/** Insert between neighbors, excluding the moved state so both upward and downward moves are stable. */
export function getSortedStatePayload(
  groups: Record<string, IState[]>,
  change: SortableChange
): Partial<IState> | undefined {
  const { id, initialGroup, group, initialIndex, index } = change;
  if (!initialGroup || initialGroup !== group || !groups[group]) return;
  const original = groups[initialGroup];
  if (original.length <= 1 || original[initialIndex]?.id !== id) return;
  if (initialGroup === group && initialIndex === index) return;
  const remaining = groups[group].filter((state) => state.id !== id);
  if (index < 0 || index > remaining.length) return;
  const before = remaining[index - 1]?.sequence;
  const after = remaining[index]?.sequence;
  const step = 65535;
  const sequence =
    before != null && after != null
      ? (before + after) / 2
      : before != null
        ? before + step
        : after != null
          ? after - step
          : step;
  return { group: group as IState["group"], sequence };
}
