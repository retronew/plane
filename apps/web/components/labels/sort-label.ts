import type { SortableChange } from "@plane/blocks/sortable";
import type { IIssueLabel } from "@plane/types";

export const ROOT_LABEL_GROUP = "root-labels";

/** Keep parent membership fixed and compute position from neighbors after removing the moved label. */
export function getSortedLabelPayload(labels: IIssueLabel[], change: SortableChange): Partial<IIssueLabel> | undefined {
  if (!change.group || change.group !== change.initialGroup || change.index === change.initialIndex) return;
  const siblings = labels.filter((entry) => (entry.parent ?? ROOT_LABEL_GROUP) === change.group);
  if (siblings[change.initialIndex]?.id !== change.id) return;
  const remaining = siblings.filter((entry) => entry.id !== change.id);
  if (change.index < 0 || change.index > remaining.length) return;
  const before = remaining[change.index - 1]?.sort_order;
  const after = remaining[change.index]?.sort_order;
  return {
    sort_order:
      before != null && after != null
        ? (before + after) / 2
        : before != null
          ? before + 10000
          : after != null
            ? after - 10000
            : 65535,
  };
}
