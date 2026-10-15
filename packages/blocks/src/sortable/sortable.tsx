import type { ReactNode } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { AutoScroller } from "@dnd-kit/dom";
import { cn } from "@plane/utils";

export type SortableChange = {
  id: string;
  initialIndex: number;
  index: number;
  initialGroup?: string;
  group?: string;
};

/** Shared dnd-kit defaults: handle activation, pointer/touch/keyboard sensors and animated sorting. */
export function SortableProvider({
  children,
  onSortEnd,
  disabled = false,
}: {
  children: ReactNode;
  onSortEnd: (change: SortableChange) => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <DragDropProvider
      plugins={(defaults) => [...defaults, AutoScroller.configure({ threshold: 0.05, acceleration: 8 })]}
      onBeforeDragStart={(event) => {
        if (disabled) event.preventDefault();
      }}
      onDragEnd={async (event) => {
        const { source } = event.operation;
        if (event.canceled || !isSortable(source)) return;
        // Sorting changes order within a list; it must never change the item's group.
        if (source.initialGroup !== source.group || source.initialIndex === source.index) return;
        const { group, index } = source;
        const pending = event.suspend();
        try {
          await onSortEnd({
            id: String(source.id),
            initialIndex: source.initialIndex,
            index,
            initialGroup: source.initialGroup == null ? undefined : String(source.initialGroup),
            group: group == null ? undefined : String(group),
          });
          pending.resume();
        } catch {
          // Callers report persistence failures; abort restores dnd-kit's visual order.
          pending.abort();
        }
      }}
    >
      {children}
    </DragDropProvider>
  );
}

export function SortableItem({
  id,
  index,
  group,
  disabled = false,
  className,
  children,
}: {
  id: string;
  index: number;
  group?: string;
  disabled?: boolean | { draggable?: boolean; droppable?: boolean };
  className?: string;
  children: (props: { handleRef: (element: Element | null) => void; isDragging: boolean }) => ReactNode;
}) {
  const { ref, handleRef, isDragSource } = useSortable({
    id,
    index,
    group,
    disabled,
    transition: { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", idle: true },
  });
  return (
    <div
      ref={ref}
      data-sortable-id={id}
      data-dragging={isDragSource || undefined}
      className={cn(
        className,
        isDragSource && "shadow-sm z-20 rounded-md bg-layer-2 ring-1 ring-[color:var(--border-subtle)]/50"
      )}
    >
      {children({ handleRef, isDragging: isDragSource })}
    </div>
  );
}
