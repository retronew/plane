/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";
import { range } from "lodash-es";
import { Row } from "@plane/blocks/layout";

export function SpreadsheetIssueRowLoader(props: { columnCount: number }) {
  return (
    <tr className="bg-surface-1">
      <td
        aria-label={translate("common.loading")}
        className="sticky left-0 z-[10] h-11 min-w-[512px] items-center border-r border-b border-subtle bg-surface-1"
      >
        <Row className="flex h-full items-center gap-3">
          <div className="h-3 w-16 rounded-md bg-layer-3" />
          <div className="h-3.5 w-52 rounded-md bg-layer-3" />
        </Row>
      </td>
      {range(props.columnCount).map((colIndex) => (
        <td
          aria-label={translate("common.loading")}
          key={colIndex}
          className="h-11 w-full min-w-[144px] border-r border-b border-subtle"
        >
          <div className="flex items-center justify-center gap-3 px-3">
            <div className="h-5 w-20 rounded-md bg-layer-3" />
          </div>
        </td>
      ))}
    </tr>
  );
}

export function SpreadsheetLayoutLoader({ columnCount = 5 }: { columnCount?: number }) {
  return (
    <div className="skeleton-delayed horizontal-scroll-enable h-full w-full overflow-y-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th
              aria-label={translate("common.loading")}
              className="h-11 min-w-[512px] border-r border-b border-subtle bg-surface-2 px-4 text-left"
            >
              <div className="h-3.5 w-28 rounded-sm bg-layer-3" />
            </th>
            {range(columnCount).map((index) => (
              <th
                aria-label={translate("common.loading")}
                key={index}
                className="h-11 w-full min-w-[144px] border-r border-b border-subtle bg-surface-2 px-3"
              >
                <div className="mx-auto h-3.5 w-16 rounded-sm bg-layer-3" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {range(12).map((rowIndex) => (
            <SpreadsheetIssueRowLoader key={rowIndex} columnCount={columnCount} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
