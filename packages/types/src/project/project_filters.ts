/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TProjectOrderByOptions =
  | "sort_order"
  | "name"
  | "-name"
  | "created_at"
  | "-created_at"
  | "members_length"
  | "-members_length";

export type TProjectLayout = "gallery" | "board" | "list" | "timeline";

export type TProjectGrouping = "status" | "state_group" | "priority" | "created_by" | "labels";

export type TProjectDisplayFilters = {
  group_by?: TProjectGrouping;
  layout?: TProjectLayout;
  my_projects?: boolean;
  archived_projects?: boolean;
  order_by?: TProjectOrderByOptions;
};

export type TProjectAppliedDisplayFilterKeys = "my_projects" | "archived_projects";

export type TProjectFilters = {
  priority?: string[];
  status?: string[];
  labels?: string[];
  access?: string[] | null;
  lead?: string[] | null;
  members?: string[] | null;
  created_at?: string[] | null;
};

export type TProjectStoredFilters = {
  display_filters?: TProjectDisplayFilters;
  filters?: TProjectFilters;
};
