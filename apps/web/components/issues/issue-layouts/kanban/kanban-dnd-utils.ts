/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { GroupDropLocation } from "../utils";

/** Issue ids per column (`${groupId}__${subGroupId}`), in the order the board shows them. */
export type TKanbanColumnOrder = Record<string, string[]>;

/** Droppable id of the "drop here to delete" zone. */
export const KANBAN_TRASH_ID = "issue-trash-box";

export const getKanbanColumnId = (groupId: string, subGroupId: string) => `${groupId}__${subGroupId}`;

/**
 * Moves `issueId` in the preview order: before `overIssueId` when hovering a card (after it when the
 * card sits below in the same column, so dragging down passes it), or to the end of `columnId` when
 * hovering the column itself. `fromColumnId` is where the card sits now: an issue can show in several
 * columns when grouped by a multi-value property, so it can't be looked up by id. Returns the same object when nothing changes, so React can bail out.
 */
export function moveIssueInOrder(
  order: TKanbanColumnOrder,
  issueId: string,
  fromColumnId: string,
  target: { columnId: string; overIssueId?: string }
): TKanbanColumnOrder {
  const toList = order[target.columnId];
  if (!order[fromColumnId]?.includes(issueId) || !toList || target.overIssueId === issueId) return order;
  // already listed in the target column (multi-value grouping): nothing to move into
  if (fromColumnId !== target.columnId && toList.includes(issueId)) return order;

  const fromList = order[fromColumnId];
  const fromIndex = fromList.indexOf(issueId);
  const without = fromList.filter((id) => id !== issueId);
  const baseList = fromColumnId === target.columnId ? without : toList;

  let toIndex = baseList.length;
  if (target.overIssueId) {
    const overIndex = baseList.indexOf(target.overIssueId);
    if (overIndex === -1) return order;
    const isMovingDownInColumn = fromColumnId === target.columnId && fromIndex <= toList.indexOf(target.overIssueId);
    toIndex = isMovingDownInColumn ? overIndex + 1 : overIndex;
  } else if (fromColumnId === target.columnId) {
    // hovering the column of the card itself (its empty tail) keeps the card where it is
    return order;
  }

  const nextToList = [...baseList.slice(0, toIndex), issueId, ...baseList.slice(toIndex)];
  if (fromColumnId === target.columnId && nextToList.every((id, index) => id === fromList[index])) return order;

  return {
    ...order,
    [fromColumnId]: fromColumnId === target.columnId ? nextToList : without,
    [target.columnId]: nextToList,
  };
}

/**
 * The destination the existing drop handler expects, read off where the card sits in the preview:
 * before the card that now follows it, or after the last card when it ended at the bottom.
 */
export function getKanbanDropDestination(
  order: TKanbanColumnOrder,
  issueId: string,
  column: { columnId: string; groupId: string; subGroupId?: string; canReorder: boolean }
): GroupDropLocation {
  const list = order[column.columnId] ?? [];
  const index = list.indexOf(issueId);
  const next = index === -1 ? undefined : list[index + 1];
  const previous = index > 0 ? list[index - 1] : undefined;
  const anchor = column.canReorder ? (next ?? previous) : undefined;

  return {
    columnId: column.columnId,
    groupId: column.groupId,
    subGroupId: column.subGroupId,
    id: anchor,
    insertAfter: !!anchor && anchor === previous && !next,
  };
}

/** Largest lean of a lifted card, in degrees, reached on a quick sideways fling. */
export const KANBAN_DRAG_TILT_MAX_DEG = 3;
/** Degrees of lean per px/ms of sideways speed: an ordinary drag (~1 px/ms) leans about 2.5°. */
const KANBAN_DRAG_TILT_PER_VELOCITY = 2.5;
/** Time constant of the lean easing toward its target, in ms (~23% of the way per 60fps frame). */
const KANBAN_DRAG_TILT_EASE_MS = 60;

/**
 * The lean a dragged card is heading for at a given sideways speed (px/ms). It trails the motion like
 * a card held by its top edge: moving right lifts its right side (counter-clockwise, negative), moving
 * left lifts its left side; standing still is level.
 */
export function getKanbanDragTiltTarget(velocityX: number): number {
  const deg = -velocityX * KANBAN_DRAG_TILT_PER_VELOCITY;
  return Math.max(-KANBAN_DRAG_TILT_MAX_DEG, Math.min(KANBAN_DRAG_TILT_MAX_DEG, deg)) || 0;
}

/** One frame of the lean easing from `current` toward `target`, `elapsedMs` after the last frame. */
export function stepKanbanDragTilt(current: number, target: number, elapsedMs: number): number {
  const next = current + (target - current) * (1 - Math.exp(-Math.max(elapsedMs, 0) / KANBAN_DRAG_TILT_EASE_MS));
  return Math.abs(next - target) < 0.02 ? target : next;
}
