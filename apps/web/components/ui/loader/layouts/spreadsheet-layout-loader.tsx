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
          <span className="h-3 w-16 animate-pulse rounded-lg bg-layer-1" />
          <span className={`h-3.5 w-52 animate-pulse rounded-lg bg-layer-1`} />
        </Row>
      </td>
      {range(props.columnCount).map((colIndex) => (
        <td
          aria-label={translate("common.loading")}
          key={colIndex}
          className="h-11 w-full min-w-[144px] border-r border-b border-subtle"
        >
          <div className="flex items-center justify-center gap-3 px-3">
            <span className="h-6 w-20 animate-pulse rounded-lg bg-layer-1" />
          </div>
        </td>
      ))}
    </tr>
  );
}

export function SpreadsheetLayoutLoader({ columnCount = 5 }: { columnCount?: number }) {
  return (
    <div className="horizontal-scroll-enable h-full w-full overflow-y-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th
              aria-label={translate("common.loading")}
              className="h-11 min-w-[512px] animate-pulse border-r border-b border-subtle bg-surface-2"
            />
            {range(columnCount).map((index) => (
              <th
                aria-label={translate("common.loading")}
                key={index}
                className="h-11 w-full min-w-[144px] animate-pulse border-r border-b border-subtle bg-surface-2"
              />
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
