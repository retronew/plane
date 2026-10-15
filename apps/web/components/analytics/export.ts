/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { download, generateCsv, mkConfig } from "export-to-csv";
import type { TInsightTableFeatures } from "./insight-table/table-features";

export const csvConfig = (workspaceSlug: string) =>
  mkConfig({
    fieldSeparator: ",",
    filename: `${workspaceSlug}-analytics`,
    decimalSeparator: ".",
    useKeysAsHeaders: true,
  });

export type AnalyticsExportFormat = "csv" | "json";

export const getExportRows = <T extends RowData>(
  rows: Row<TInsightTableFeatures, T>[],
  columns: ColumnDef<TInsightTableFeatures, T>[]
) =>
  rows.map((row) => {
    const exportColumns = columns.map((col) => col.meta?.export);
    const cells = exportColumns.reduce((acc: Record<string, string | number>, col) => {
      if (col) {
        const cell = col?.value(row) ?? "-";
        acc[col.label ?? col.key] = cell;
      }
      return acc;
    }, {});
    return cells;
  });

export const exportAnalytics = <T extends RowData>(
  rows: Row<TInsightTableFeatures, T>[],
  columns: ColumnDef<TInsightTableFeatures, T>[],
  workspaceSlug: string,
  format: AnalyticsExportFormat
) => {
  const rowData = getExportRows(rows, columns);
  if (format === "json") {
    const blob = new Blob([JSON.stringify(rowData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workspaceSlug}-analytics.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }
  // Spreadsheet software interprets leading operators as formulas; preserve them as text.
  const safeRows = rowData.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "string" && /^[=+@\-\t\r]/.test(value) ? `'${value}` : value,
      ])
    )
  );
  const csv = generateCsv(csvConfig(workspaceSlug))(safeRows);
  download(csvConfig(workspaceSlug))(csv);
};
