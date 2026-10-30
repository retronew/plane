/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { DeleteOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";
// hooks
import { useKanbanView } from "@/hooks/store/use-kanban-view";
// local imports
import { useKanbanTrashDroppable } from "./kanban-dnd";
import { translate } from "@plane/i18n";

// Isolated from BaseKanBanRoot so a drag start/end re-renders only this banner, not the whole board.
// The drop itself is handled by the board's dnd provider, which asks to delete the dropped card.
export const KanbanDeleteDropZone = observer(function KanbanDeleteDropZone() {
  // store hooks
  const { isDragging } = useKanbanView();
  // dnd-kit target
  const { ref: deleteAreaRef, isDropTarget: isDragOverDelete } = useKanbanTrashDroppable();

  return (
    // A floating pill that slides in while a card is dragged and turns solid red once the card is
    // over it, so the destructive target reads clearly without shouting at rest.
    <div
      ref={deleteAreaRef}
      className={cn(
        "fixed top-3 left-1/2 flex -translate-x-1/2 justify-center p-2 transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:duration-100",
        isDragging ? "z-40 translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full border py-2 ps-2 pe-4 text-body-sm-medium shadow-raised-300 transition-[background-color,border-color,color,scale] duration-150 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:duration-75",
          isDragOverDelete
            ? "scale-105 border-transparent bg-danger-primary text-on-color"
            : "border-subtle bg-layer-2 text-secondary"
        )}
      >
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full",
            isDragOverDelete ? "bg-white/20 text-on-color" : "bg-danger-subtle text-danger-primary"
          )}
        >
          <DeleteOutline className="size-4" />
        </span>
        {translate("web.drop_here_to_delete")}
      </div>
    </div>
  );
});
