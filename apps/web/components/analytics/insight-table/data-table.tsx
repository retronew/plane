/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnVisibilityState,
  RowData,
  SortingState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { flexRender, useTable } from "@tanstack/react-table";

import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
// plane package imports
import { Table, TableBody, TableHeader, TableRow } from "@makeplane/propel/components/table";
import { TableCell, TableHead } from "@makeplane/propel/elements/table";

import type { TInsightTableFeatures } from "./table-features";
import { insightTableFeatures } from "./table-features";
// plane web components

interface DataTableProps<TData extends RowData> {
  // `any` value type: one table's columns hold different cell types, and useTable takes them as one array.
  columns: ColumnDef<TInsightTableFeatures, TData, any>[];
  data: TData[];
  searchPlaceholder: string;
  title?: string;
  actions?: (table: TanstackTable<TInsightTableFeatures, TData>) => React.ReactNode;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  searchPlaceholder,
  actions,
  title,
}: DataTableProps<TData>) {
  const [rowSelection, _setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, _setSorting] = React.useState<SortingState>([]);
  const { t } = useTranslation();

  const table = useTable({
    features: insightTableFeatures,
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <div className="space-y-4">
      <div className="flex min-h-7 w-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          {title && <h2 className="text-16 font-medium text-primary">{title}</h2>}
          <span className="text-12 whitespace-nowrap text-tertiary">{searchPlaceholder}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ExpandableSearch
            size="md"
            aria-label={t("search")}
            placeholder={t("search")}
            clearLabel={t("common.clear")}
            value={String(table.getAllLeafColumns()[0]?.getFilterValue() ?? "")}
            onValueChange={(value) => table.getAllLeafColumns()[0]?.setFilterValue(value ?? "")}
          />
          {actions && actions(table)}
        </div>
      </div>

      <div className="rounded-md">
        <Table variant="table">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    variant="table"
                    align={
                      data.some(
                        (row) =>
                          typeof (row as Record<string, unknown>)[
                            (header.column.columnDef as { accessorKey?: string }).accessorKey ?? ""
                          ] === "number"
                      )
                        ? "end"
                        : "start"
                    }
                    pinned="none"
                    render={
                      // TableHead fills this render template with its accessible header text.
                      // oxlint-disable-next-line jsx-a11y/control-has-associated-label
                      <th className={`h-9! py-1! whitespace-nowrap${title ? " first:pl-3 last:pr-3" : ""}`} />
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : (flexRender(header.column.columnDef.header, header.getContext()) as any)}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      variant="table"
                      pinned="none"
                      padding="cell"
                      render={
                        title ? (
                          // TableCell fills this render template with the cell content below.
                          // oxlint-disable-next-line jsx-a11y/control-has-associated-label
                          <td className="h-10! first:pl-3 last:pr-3" />
                        ) : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext()) as any}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} variant="table" pinned="none" padding="trigger">
                  <EmptyStateCompact
                    assetKey="unknown"
                    assetClassName="size-20"
                    rootClassName="border border-subtle px-5 py-10 md:py-20 md:px-20"
                    title={t("common.no_data_available")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
