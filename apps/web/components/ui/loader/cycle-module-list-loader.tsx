/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

export function CycleModuleListLayoutLoader() {
  return (
    <div className="h-full overflow-y-auto motion-safe:animate-pulse">
      <div className="flex h-full w-full justify-between">
        <div className="flex h-full w-full flex-col overflow-y-auto">
          {range(5).map((i) => (
            <div
              key={i}
              className="flex w-full flex-col items-center justify-between gap-5 border-b border-subtle px-5 py-5 sm:flex-row"
            >
              <div className="relative flex w-full items-center justify-between gap-3 overflow-hidden">
                <div className="relative flex w-full items-center gap-3 overflow-hidden">
                  <div className="flex items-center gap-4 truncate">
                    <div className="size-9 shrink-0 rounded-full bg-layer-3" />
                    <div className="h-4 w-36 rounded-sm bg-layer-3" />
                  </div>
                </div>
                <div className="h-5 w-20 shrink-0 rounded-full bg-layer-3" />
              </div>
              <div className="relative flex w-full items-center justify-between gap-2.5 overflow-hidden sm:w-auto sm:shrink-0 sm:justify-end">
                <div className="relative flex shrink-0 items-center gap-3">
                  <div className="size-5 rounded-sm bg-layer-3" />
                  <div className="size-5 rounded-sm bg-layer-3" />
                  <div className="size-5 rounded-sm bg-layer-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
