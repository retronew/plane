/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { CellData, Row, RowData, TableFeatures } from "@tanstack/react-table";
import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_equals,
  filterFn_inDateRange,
  filterFn_inNumberRange,
  filterFn_includesString,
  filterFn_weakEquals,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * TanStack Table v9 only ships the features a table declares. These are the ones the analytics
 * insight tables relied on from v8's all-in bundle. v8 also resolved `filterFn: "auto"` and
 * automatic sorting against every built-in function; v9 looks them up in the registries below, so
 * they hold each function the auto resolution can pick.
 */
export const insightTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  columnFacetingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filterFns: {
    includesString: filterFn_includesString,
    inNumberRange: filterFn_inNumberRange,
    equals: filterFn_equals,
    arrIncludes: filterFn_arrIncludes,
    inDateRange: filterFn_inDateRange,
    weakEquals: filterFn_weakEquals,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type TInsightTableFeatures = typeof insightTableFeatures;

declare module "@tanstack/react-table" {
  // oxlint-disable-next-line no-unused-vars -- the generics must match the declaration being merged
  interface ColumnMeta<in out TFeatures extends TableFeatures, in out TData extends RowData, TValue extends CellData> {
    export: {
      key: string;
      value: (row: Row<TFeatures, TData>) => string | number;
      label?: string;
    };
  }
}
