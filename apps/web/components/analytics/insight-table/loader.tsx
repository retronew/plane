/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@makeplane/propel/components/table";
import { Loader } from "@plane/blocks/skeleton";
import type { TInsightTableFeatures } from "./table-features";

interface TableSkeletonProps {
  columns: ColumnDef<TInsightTableFeatures, any>[];
  rows: number;
}

const getColumnKey = (column: ColumnDef<TInsightTableFeatures, any>) => column.id ?? String(column.header ?? "");

export function TableLoader({ columns, rows }: TableSkeletonProps) {
  const rowKeys = Array.from({ length: rows }, (_, rowIndex) => `skeleton-row-${rowIndex}`);

  return (
    <Table variant="table">
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={getColumnKey(column)}
              pinned="none"
              label={typeof column.header === "string" ? column.header : ""}
              render={
                // TableHead supplies the accessible column label.
                // oxlint-disable-next-line jsx-a11y/control-has-associated-label
                <th className="h-9! py-1!" />
              }
            />
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rowKeys.map((rowKey) => (
          <TableRow key={rowKey}>
            {columns.map((column) => (
              <TableCell key={getColumnKey(column)} pinned="none" padding="cell">
                <Loader.Item height="20px" width="100%" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
