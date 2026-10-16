/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import type { AnalyticsTableDataMap, TAnalyticsTabsBase } from "@plane/types";
import { AsyncContent } from "@/components/common/async-content";
import { AnalyticsExportMenu } from "../export-menu";
import type { AnalyticsExportFormat } from "../export";
import { DataTable } from "./data-table";
import { TableLoader } from "./loader";
import type { TInsightTableFeatures } from "./table-features";
interface InsightTableProps<T extends Exclude<TAnalyticsTabsBase, "overview">> {
  analyticsType: T;
  data?: AnalyticsTableDataMap[T][];
  isLoading?: boolean;
  columns: ColumnDef<TInsightTableFeatures, AnalyticsTableDataMap[T]>[];
  columnsLabels?: Record<string, string>;
  headerText: string;
  title?: string;
  onExport?: (
    rows: Row<TInsightTableFeatures, AnalyticsTableDataMap[T]>[],
    format: AnalyticsExportFormat
  ) => void | Promise<void>;
}

export function InsightTable<T extends Exclude<TAnalyticsTabsBase, "overview">>(
  props: InsightTableProps<T>
): React.ReactElement {
  const { data, isLoading, columns, headerText, onExport, title } = props;

  return (
    <AsyncContent loading={!!isLoading} skeleton={<TableLoader columns={columns} rows={5} />} minHeight={270}>
      <DataTable
        title={title}
        columns={columns}
        data={data || []}
        searchPlaceholder={`${data?.length || 0} ${headerText}`}
        actions={(table: Table<TInsightTableFeatures, AnalyticsTableDataMap[T]>) => (
          <AnalyticsExportMenu
            disabled={!onExport || !table.getFilteredRowModel().rows.length}
            onExport={(format) => onExport?.(table.getFilteredRowModel().rows, format)}
          />
        )}
      />
    </AsyncContent>
  );
}
