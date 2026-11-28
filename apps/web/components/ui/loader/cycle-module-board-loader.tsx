/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

export function CycleModuleBoardLayoutLoader() {
  return (
    <div className="h-full w-full motion-safe:animate-pulse">
      <div className="flex h-full w-full justify-between">
        <div className="3xl:grid-cols-4 grid h-full w-full auto-rows-max grid-cols-1 gap-4 overflow-y-auto px-page-x py-page-y transition-all lg:grid-cols-2 xl:grid-cols-3">
          {range(6).map((i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-xl border border-subtle bg-surface-1 text-13">
              <div className="flex h-[108px] flex-col justify-between bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-5 w-32 rounded-sm bg-layer-3" />
                  <div className="h-5 w-16 rounded-full bg-layer-3" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-3/4 rounded-sm bg-layer-3" />
                  <div className="h-3 w-1/2 rounded-sm bg-layer-3" />
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div className="h-1.5 w-full rounded-full bg-layer-3" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-5 rounded-full bg-layer-3" />
                    <div className="h-4 w-20 rounded-sm bg-layer-3" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-4 rounded-sm bg-layer-3" />
                    <div className="size-4 rounded-sm bg-layer-3" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
