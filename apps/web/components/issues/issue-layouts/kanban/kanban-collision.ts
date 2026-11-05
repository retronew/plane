import { defaultCollisionDetection, type CollisionDetector } from "@dnd-kit/collision";

/** Cross columns only when the lifted card's horizontal midpoint enters the column. */
export const kanbanCollisionDetection: CollisionDetector = (input) => {
  const { dragOperation, droppable } = input;
  const shape = dragOperation.shape?.current;
  if (!shape) return defaultCollisionDetection(input);

  const columnId = droppable.data.columnId;
  if (typeof columnId !== "string") return null;
  const column = document.getElementById(columnId);
  if (!column) return null;
  const bounds = column.getBoundingClientRect();
  const centerX = shape.center.x;
  // Half-open bounds give adjacent columns one unambiguous owner at their shared edge.
  if (centerX < bounds.left || centerX >= bounds.right) return null;

  // Preserve the library's existing card/column and vertical insertion hit testing,
  // restricted to the column containing the card's midpoint.
  return defaultCollisionDetection(input);
};
