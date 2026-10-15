/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cloneDeep } from "lodash-es";
import { ISSUE_DISPLAY_FILTERS_BY_PAGE } from "@plane/constants";
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, TWorkItemFilterExpression } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { getComputedDisplayFilters } from "@plane/utils";

/** Keep inactive layout preferences; only correct settings required by the selected layout. */
export function getWorkspaceViewDisplayFilters(
  filters: IIssueDisplayFilterOptions = {},
  requestedLayout?: EIssueLayoutTypes
): IIssueDisplayFilterOptions {
  const layouts = ISSUE_DISPLAY_FILTERS_BY_PAGE.workspace_issues.layoutOptions;
  const candidate = requestedLayout ?? filters.layout ?? EIssueLayoutTypes.SPREADSHEET;
  const layout = layouts[candidate] ? candidate : EIssueLayoutTypes.SPREADSHEET;
  const defaults = getComputedDisplayFilters({ layout: EIssueLayoutTypes.SPREADSHEET, order_by: "-created_at" });
  const next = { ...defaults, ...cloneDeep(filters), layout, calendar: { ...defaults.calendar, ...filters.calendar } };
  if (!next.order_by || next.order_by === "sort_order") next.order_by = "-created_at";
  if (next.group_by === "state") next.group_by = "state_detail.group";
  const groups = layouts[layout].display_filters.group_by;
  if (groups?.length && !groups.includes(next.group_by ?? null))
    next.group_by = groups.includes(null) ? null : groups[0];
  if (layout === EIssueLayoutTypes.KANBAN) {
    const subgroups = layouts[layout].display_filters.sub_group_by;
    if (next.sub_group_by === next.group_by || !subgroups?.includes(next.sub_group_by ?? null))
      next.sub_group_by = null;
  }
  return next;
}

/** Read at the save action, then detach everything from the source page's reactive state. */
export function getWorkspaceViewFilterSnapshot(
  expression: TWorkItemFilterExpression,
  displayFilters?: IIssueDisplayFilterOptions,
  displayProperties?: IIssueDisplayProperties,
  requestedLayout?: EIssueLayoutTypes
) {
  return {
    rich_filters: cloneDeep(expression),
    display_filters: getWorkspaceViewDisplayFilters(displayFilters, requestedLayout),
    display_properties: cloneDeep(displayProperties),
  };
}
