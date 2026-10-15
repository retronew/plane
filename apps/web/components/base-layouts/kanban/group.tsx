/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import type { IBaseLayoutsKanbanItem, IBaseLayoutsKanbanGroupProps } from "@plane/types";
import { cn } from "@plane/utils";
import { useGroupDropTarget } from "../hooks/use-group-drop-target";
import { LayoutScrollArea } from "../scroll-area";
import { GroupHeader } from "./group-header";
import { BaseKanbanItem } from "./item";

export const BaseKanbanGroup = observer(function BaseKanbanGroup<T extends IBaseLayoutsKanbanItem>(
  props: IBaseLayoutsKanbanGroupProps<T>
) {
  const {
    group,
    itemIds,
    items,
    renderItem,
    renderGroupHeader,
    enableDragDrop = false,
    onDrop,
    canDrag,
    groupClassName,
    loadMoreItems: _loadMoreItems,
  } = props;

  const { t } = useTranslation();
  const { groupRef, isDraggingOver } = useGroupDropTarget({
    groupId: group.id,
    enableDragDrop,
    onDrop,
  });

  return (
    <div
      data-kanban-column={group.id}
      ref={groupRef}
      className={cn(
        "relative flex h-full min-h-0 w-[336px] shrink-0 flex-col overflow-hidden rounded-xl bg-layer-1 p-2",
        {
          "bg-layer-1": isDraggingOver,
        },
        groupClassName
      )}
    >
      {/* Group Header */}
      <div data-kanban-header="" className="relative z-[2] w-full shrink-0 bg-layer-1 px-1">
        {renderGroupHeader ? (
          renderGroupHeader({ group, itemCount: itemIds.length })
        ) : (
          <GroupHeader group={group} itemCount={itemIds.length} />
        )}
      </div>

      {/* Group Items */}
      <LayoutScrollArea axis="vertical" className="-mr-2 flex-1" contentClassName="pr-2">
        <div className="flex flex-col gap-2 py-2">
          {itemIds.map((itemId, index) => {
            const item = items[itemId];
            if (!item) return null;

            return (
              <BaseKanbanItem
                key={itemId}
                item={item}
                index={index}
                groupId={group.id}
                renderItem={renderItem}
                enableDragDrop={enableDragDrop}
                canDrag={canDrag}
                onDrop={onDrop}
                isLast={index === itemIds.length - 1}
              />
            );
          })}

          {itemIds.length === 0 && (
            <div className="flex items-center justify-center py-8 text-13 text-tertiary">
              {t("common.no_items_in_this_group")}
            </div>
          )}
        </div>
      </LayoutScrollArea>

      {isDraggingOver && enableDragDrop && (
        <div className="absolute top-0 left-0 z-[2] flex h-full w-full items-center justify-center rounded-xl border-[1px] border-strong bg-layer-1/85 text-13 font-medium text-tertiary">
          <div className="my-8 flex flex-col items-center rounded-sm p-3 text-secondary">
            {t("common.drop_here_to_move")}
          </div>
        </div>
      )}
    </div>
  );
});
