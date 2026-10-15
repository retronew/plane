/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  IBaseLayoutsBaseItem,
  IBaseLayoutsBaseProps,
  IBaseLayoutsBaseGroupProps,
  IBaseLayoutsBaseItemProps,
  IGroupHeaderProps,
} from "./base";
import type { ReactNode } from "react";

type KanbanHeaderProps = Omit<IGroupHeaderProps, "isCollapsed" | "onToggleGroup">;

export type IBaseLayoutsKanbanItem = IBaseLayoutsBaseItem;

// Main Kanban Layout Props

export interface IBaseLayoutsKanbanProps<T extends IBaseLayoutsKanbanItem> extends Omit<
  IBaseLayoutsBaseProps<T>,
  "collapsedGroups" | "onToggleGroup" | "renderGroupHeader"
> {
  renderGroupHeader?: (props: KanbanHeaderProps) => ReactNode;
  groupClassName?: string;
}

// Kanban Column/Group Props

export interface IBaseLayoutsKanbanGroupProps<T extends IBaseLayoutsKanbanItem> extends Omit<
  IBaseLayoutsBaseGroupProps<T>,
  "isCollapsed" | "onToggleGroup" | "renderGroupHeader"
> {
  renderGroupHeader?: (props: KanbanHeaderProps) => ReactNode;
  groupClassName?: string;
}

// Kanban Card/Item Props

export type IBaseLayoutsKanbanItemProps<T extends IBaseLayoutsKanbanItem> = IBaseLayoutsBaseItemProps<T>;
