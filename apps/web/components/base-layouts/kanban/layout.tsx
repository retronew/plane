/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useRef } from "react";
import type { IBaseLayoutsKanbanItem, IBaseLayoutsKanbanProps } from "@plane/types";
import { cn } from "@plane/utils";
import { LayoutScrollArea } from "../scroll-area";
import { BaseKanbanGroup } from "./group";

export const BaseKanbanLayout = observer(function BaseKanbanLayout<T extends IBaseLayoutsKanbanItem>(
  props: IBaseLayoutsKanbanProps<T>
) {
  const {
    items,
    groups,
    groupedItemIds,
    renderItem,
    renderGroupHeader,
    onDrop,
    canDrag,
    className,
    groupClassName,
    showEmptyGroups = true,
    enableDragDrop = false,
    loadMoreItems,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <LayoutScrollArea
      axis="horizontal"
      viewportRef={containerRef}
      className={cn("h-full w-full bg-surface-2", className)}
      contentClassName="flex h-full w-max min-w-full gap-4 p-4"
    >
      {groups.map((group) => {
        const itemIds = groupedItemIds[group.id] || [];

        if (!showEmptyGroups && itemIds.length === 0) return null;

        return (
          <BaseKanbanGroup
            key={group.id}
            group={group}
            itemIds={itemIds}
            items={items}
            renderItem={renderItem}
            renderGroupHeader={renderGroupHeader}
            enableDragDrop={enableDragDrop}
            onDrop={onDrop}
            canDrag={canDrag}
            groupClassName={groupClassName}
            loadMoreItems={loadMoreItems}
          />
        );
      })}
    </LayoutScrollArea>
  );
});
