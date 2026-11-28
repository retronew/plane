/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";
import { Row } from "@plane/blocks/layout";
import { BLOCK_HEIGHT, SIDEBAR_WIDTH } from "@/components/gantt-chart/constants";

export function GanttLayoutListItemLoader() {
  return (
    <div className="flex w-full items-center gap-4 px-6" style={{ height: `${BLOCK_HEIGHT}px` }}>
      <div className="h-5 w-8 rounded-sm bg-layer-3" />
      <div className="h-3.5 w-52 rounded-sm bg-layer-3" />
    </div>
  );
}

export function GanttLayoutLoader() {
  return (
    <div className="skeleton-delayed flex h-full flex-col overflow-x-auto">
      <div className="flex min-h-11 w-full items-center gap-3 border-b border-subtle px-4">
        <div className="h-6 w-20 rounded-sm bg-layer-3" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-6 w-16 rounded-sm bg-layer-3" />
          <div className="h-6 w-16 rounded-sm bg-layer-3" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="h-full shrink-0 border-r border-subtle" style={{ width: SIDEBAR_WIDTH }}>
          <Row className="flex h-11 items-center border-b border-subtle py-2">
            <div className="flex w-full items-center justify-between">
              <div className="h-4 w-16 rounded-sm bg-layer-3" />
              <div className="h-4 w-14 rounded-sm bg-layer-3" />
            </div>
          </Row>
          <Row className="flex w-full flex-col gap-0 py-0">
            {range(6).map((index) => (
              <div key={index} className="flex h-11 w-full items-center gap-3">
                <div className="size-4 shrink-0 rounded-sm bg-layer-3" />
                <div className="h-4 w-48 rounded-sm bg-layer-3" />
              </div>
            ))}
          </Row>
        </div>
        <div className="h-full min-w-0 flex-1 overflow-hidden border-r border-subtle">
          <div className="flex h-11 items-center justify-between gap-3 border-b border-subtle px-4">
            {range(10).map((index) => (
              <div key={index} className="h-4 w-10 shrink-0 rounded-sm bg-layer-3" />
            ))}
          </div>
          <div className="flex w-full flex-col gap-0 px-4">
            {range(6).map((index) => (
              <div
                key={index}
                className="flex h-11 w-full items-center gap-3"
                style={{ paddingLeft: `${40 + (index % 3) * 60}px` }}
              >
                <div className="h-6 w-44 rounded-sm bg-layer-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
