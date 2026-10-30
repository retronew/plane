/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AutoScroller, KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
// plane imports
import { setToast } from "@plane/blocks/toast";
import { translate } from "@plane/i18n";
import type { TIssueOrderByOptions } from "@plane/types";
// hooks
import { useKanbanView } from "@/hooks/store/use-kanban-view";
// local imports
import scrollIntoView from "smooth-scroll-into-view-if-needed";
import type { GroupDropLocation } from "../utils";
import { getIssueBlockId } from "../utils";
import type { TKanbanColumnOrder } from "./kanban-dnd-utils";
import {
  KANBAN_TRASH_ID,
  getKanbanDragTiltTarget,
  stepKanbanDragTilt,
  getKanbanDropDestination,
  moveIssueInOrder,
} from "./kanban-dnd-utils";

/** CSS variable carrying the lifted card's current tilt (see `getKanbanDragTilt`). */
export const KANBAN_DRAG_TILT_VAR = "--kanban-drag-tilt";

const applyTilt = (deg: number) =>
  document.documentElement.style.setProperty(KANBAN_DRAG_TILT_VAR, `${deg.toFixed(2)}deg`);

/** Card and column motion: the slide siblings make while a card passes, shared with the drop settle. */
const KANBAN_SORT_TRANSITION = { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)", idle: true } as const;

type TKanbanCardData = { kind: "card"; issueId: string; columnId: string };
type TKanbanColumnData = { kind: "column"; columnId: string };

type TKanbanColumnEntry = {
  groupId: string;
  subGroupId: string;
  issueIds: string[];
  /** Whether a drop may pick a position in this column (manual ordering); otherwise only the column. */
  canReorder: boolean;
  /** Why a drop into this column is refused: `undefined` allows it, `null` refuses silently. */
  getDropError: () => string | null | undefined;
};

type TKanbanDndContext = {
  /** Issue order per column while a card is dragged; `null` when the board shows the store order. */
  previewOrder: TKanbanColumnOrder | null;
  activeIssueId: string | null;
  /** Column the dragged card started in — its sortable id stays tied to it while it travels. */
  activeSourceColumnId: string | null;
  overColumnId: string | null;
  registerColumn: (columnId: string, entry: TKanbanColumnEntry) => () => void;
};

const KanbanDndContext = createContext<TKanbanDndContext | null>(null);

const useKanbanDndContext = () => {
  const context = useContext(KanbanDndContext);
  if (!context) throw new Error("Kanban drag and drop hooks must be used inside KanbanDndProvider");
  return context;
};

type TKanbanDndProviderProps = {
  children: ReactNode;
  orderBy: TIssueOrderByOptions | undefined;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  onRequestDelete: (issueId: string) => void;
};

/**
 * dnd-kit for the board. Cards are sortables grouped by column; while one is dragged the board renders
 * a preview order that moves the card between and within columns, so the cards around it slide aside
 * (dnd-kit animates every index change). The store is only written once, on drop, through the same
 * `handleOnDrop` the rest of the app uses. Moving the card in React state during `onDragOver` (the
 * controlled pattern from dnd-kit's multi-list guide) keeps dnd-kit from reparenting React-owned
 * nodes across columns itself.
 */
export function KanbanDndProvider(props: TKanbanDndProviderProps) {
  const { children, orderBy, handleOnDrop, onRequestDelete } = props;
  // store hooks
  const { setIsDragging } = useKanbanView();
  // refs
  const columnsRef = useRef(new Map<string, TKanbanColumnEntry>());
  const previewRef = useRef<TKanbanColumnOrder | null>(null);
  const activeRef = useRef<{ issueId: string; sourceColumnId: string; columnId: string } | null>(null);
  // states
  const [previewOrder, setPreviewOrderState] = useState<TKanbanColumnOrder | null>(null);
  const [active, setActive] = useState<{ issueId: string; sourceColumnId: string } | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const setPreviewOrder = useCallback((order: TKanbanColumnOrder | null) => {
    previewRef.current = order;
    setPreviewOrderState(order);
  }, []);

  const registerColumn = useCallback((columnId: string, entry: TKanbanColumnEntry) => {
    columnsRef.current.set(columnId, entry);
    return () => {
      if (columnsRef.current.get(columnId) === entry) columnsRef.current.delete(columnId);
    };
  }, []);

  // Lean of the lifted card, driven by its sideways speed: it trails the motion up to a few degrees
  // and eases back to level as the pointer slows or stops. Eased every animation frame and written as
  // a CSS variable on the root, because the dragged card remounts each time it changes columns.
  const tiltRef = useRef({ x: 0, time: 0, velocity: 0, angle: 0, frame: 0 });
  const stopTilt = useCallback(() => {
    cancelAnimationFrame(tiltRef.current.frame);
    tiltRef.current.frame = 0;
    tiltRef.current.angle = 0;
  }, []);
  const trackTilt = (x: number, isStart = false) => {
    const tilt = tiltRef.current;
    const now = performance.now();
    if (isStart) {
      stopTilt();
      Object.assign(tilt, { x, time: now, velocity: 0 });
      applyTilt(0);
      let last = now;
      const tick = (frameTime: number) => {
        // a pointer that has stopped moving has no speed, so the card settles level
        if (frameTime - tilt.time > 50) tilt.velocity = 0;
        const next = stepKanbanDragTilt(tilt.angle, getKanbanDragTiltTarget(tilt.velocity), frameTime - last);
        last = frameTime;
        if (next !== tilt.angle) {
          tilt.angle = next;
          applyTilt(next);
        }
        tilt.frame = requestAnimationFrame(tick);
      };
      tilt.frame = requestAnimationFrame(tick);
      return;
    }
    const elapsed = now - tilt.time;
    if (elapsed <= 0) return;
    // smooth the raw speed a little, so one jittery pointer event cannot jerk the card
    tilt.velocity = tilt.velocity * 0.6 + ((x - tilt.x) / elapsed) * 0.4;
    tilt.x = x;
    tilt.time = now;
  };
  useEffect(() => stopTilt, [stopTilt]);

  const resetDrag = useCallback(() => {
    stopTilt();
    document.documentElement.style.removeProperty(KANBAN_DRAG_TILT_VAR);
    activeRef.current = null;
    setActive(null);
    setOverColumnId(null);
    setPreviewOrder(null);
    setIsDragging(false);
  }, [setIsDragging, setPreviewOrder, stopTilt]);

  const context = useMemo<TKanbanDndContext>(
    () => ({
      previewOrder,
      activeIssueId: active?.issueId ?? null,
      activeSourceColumnId: active?.sourceColumnId ?? null,
      overColumnId,
      registerColumn,
    }),
    [previewOrder, active, overColumnId, registerColumn]
  );

  return (
    <KanbanDndContext.Provider value={context}>
      <DragDropProvider
        plugins={(defaults) => [...defaults, AutoScroller.configure({ threshold: 0.08, acceleration: 10 })]}
        onDragStart={(event) => {
          const data = event.operation.source?.data as TKanbanCardData | undefined;
          if (data?.kind !== "card") return;
          const order: TKanbanColumnOrder = {};
          for (const [columnId, entry] of columnsRef.current) order[columnId] = [...entry.issueIds];
          activeRef.current = { issueId: data.issueId, sourceColumnId: data.columnId, columnId: data.columnId };
          setActive({ issueId: data.issueId, sourceColumnId: data.columnId });
          setOverColumnId(data.columnId);
          setPreviewOrder(order);
          setIsDragging(true);
          trackTilt(event.operation.position.current.x, true);
        }}
        onDragMove={(event) => trackTilt(event.operation.position.current.x)}
        onDragOver={(event) => {
          // the preview order below moves the card; dnd-kit sees React re-index the sortables and skips
          // its own optimistic DOM move, so React keeps owning the nodes across columns
          const current = activeRef.current;
          const order = previewRef.current;
          const target = event.operation.target;
          if (!current || !order || !target || target.id === KANBAN_TRASH_ID) return;

          const targetData = target.data as TKanbanCardData | TKanbanColumnData | undefined;
          if (!targetData) return;
          const columnId = targetData.columnId;
          const column = columnsRef.current.get(columnId);
          if (!column) return;
          // a column sorted by a rule (not by hand) re-sorts the card on drop, so its cards never make
          // room for it: stop dnd-kit's own optimistic sorting there; only the source gap closes
          if (!column.canReorder) event.preventDefault();
          setOverColumnId(columnId);

          // a column that only accepts the card (not a position) takes it at the end
          const overIssueId = targetData.kind === "card" && column.canReorder ? targetData.issueId : undefined;
          const next = moveIssueInOrder(order, current.issueId, current.columnId, { columnId, overIssueId });
          if (next === order) return;
          current.columnId = columnId;
          setPreviewOrder(next);
        }}
        onDragEnd={(event) => {
          // level the card as it lands; the card's rotate transition carries it there
          stopTilt();
          applyTilt(0);
          const current = activeRef.current;
          const order = previewRef.current;
          const target = event.operation.target;
          if (!current || !order || event.canceled) {
            resetDrag();
            return;
          }

          if (target?.id === KANBAN_TRASH_ID) {
            resetDrag();
            onRequestDelete(current.issueId);
            return;
          }

          const sourceColumn = columnsRef.current.get(current.sourceColumnId);
          const destinationColumn = columnsRef.current.get(current.columnId);
          const isSameColumn = current.columnId === current.sourceColumnId;
          const isUnmoved =
            isSameColumn && (order[current.columnId] ?? []).every((id, index) => id === sourceColumn?.issueIds[index]);
          if (!sourceColumn || !destinationColumn || isUnmoved || (isSameColumn && !destinationColumn.canReorder)) {
            resetDrag();
            return;
          }

          const dropError = destinationColumn.getDropError();
          if (dropError !== undefined) {
            resetDrag();
            if (dropError) setToast({ type: "warning", title: translate("common.warning"), message: dropError });
            return;
          }

          const source: GroupDropLocation = {
            columnId: current.sourceColumnId,
            groupId: sourceColumn.groupId,
            subGroupId: sourceColumn.subGroupId,
            id: current.issueId,
          };
          const destination = getKanbanDropDestination(order, current.issueId, {
            columnId: current.columnId,
            groupId: destinationColumn.groupId,
            subGroupId: destinationColumn.subGroupId,
            canReorder: destinationColumn.canReorder,
          });
          // keep showing the preview until the store has the new order, so the card doesn't snap back
          void handleOnDrop(source, destination).finally(() => {
            resetDrag();
            // no landing flash: the drop animation already shows where the card went. A column sorted by
            // a rule may have moved it out of view, so follow it there.
            if (orderBy !== "sort_order") {
              const blockId = getIssueBlockId(current.issueId, destinationColumn.groupId, destinationColumn.subGroupId);
              setTimeout(() => {
                const element = document.getElementById(blockId);
                if (element) void scrollIntoView(element, { behavior: "smooth", block: "center", duration: 1500 });
              }, 200);
            }
          });
        }}
      >
        {children}
      </DragDropProvider>
    </KanbanDndContext.Provider>
  );
}

const cardSensors = [
  PointerSensor.configure({
    // a press on the card opens it; only a deliberate move (or a held touch) starts a drag
    activationConstraints: (event) =>
      event.pointerType === "touch"
        ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
        : [new PointerActivationConstraints.Distance({ value: 5 })],
  }),
  KeyboardSensor,
];

/**
 * The card side: a sortable grouped by the column it is rendered in now; its `id` stays the one it
 * had before the drag so dnd-kit keeps tracking the same card as it changes columns.
 */
export function useKanbanSortableCard(input: {
  id: string;
  index: number;
  columnId: string;
  issueId: string;
  disabled: boolean;
}) {
  const { id, index, columnId, issueId, disabled } = input;
  return useSortable<TKanbanCardData>({
    id,
    index,
    group: columnId,
    type: "issue",
    accept: "issue",
    data: { kind: "card", issueId, columnId },
    disabled,
    sensors: cardSensors,
    transition: KANBAN_SORT_TRANSITION,
  });
}

/**
 * The column side: registers the column with the board, accepts cards (so an empty column is a
 * target too) and returns the ids to render — the preview order while a card is dragged.
 */
export function useKanbanColumnDnd(input: {
  columnId: string;
  groupId: string;
  subGroupId: string;
  issueIds: string[];
  canReorder: boolean;
  getDropError: () => string | null | undefined;
}) {
  const { columnId, groupId, subGroupId, issueIds, canReorder, getDropError } = input;
  const { previewOrder, activeIssueId, activeSourceColumnId, overColumnId, registerColumn } = useKanbanDndContext();
  // the latest validator, without re-registering the column on every render
  const getDropErrorRef = useRef(getDropError);
  useLayoutEffect(() => {
    getDropErrorRef.current = getDropError;
  });

  useEffect(
    () =>
      registerColumn(columnId, {
        groupId,
        subGroupId,
        issueIds,
        canReorder,
        getDropError: () => getDropErrorRef.current(),
      }),
    [registerColumn, columnId, groupId, subGroupId, issueIds, canReorder]
  );

  const { ref } = useDroppable<TKanbanColumnData>({
    id: columnId,
    type: "column",
    accept: "issue",
    // cards inside the column win over the column itself
    collisionPriority: 1,
    data: { kind: "column", columnId },
  });

  return {
    ref,
    issueIds: previewOrder?.[columnId] ?? issueIds,
    activeIssueId,
    activeSourceColumnId,
    isDragActive: activeIssueId !== null,
    isDraggingOverColumn: overColumnId === columnId,
  };
}

/** The "drop here to delete" zone as a dnd-kit target. */
export function useKanbanTrashDroppable() {
  return useDroppable({ id: KANBAN_TRASH_ID, accept: "issue" });
}
