/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

export function PagesLoader() {
  return (
    <div className="flex h-full flex-col space-y-5 overflow-hidden p-6 motion-safe:animate-pulse">
      <div className="flex justify-between gap-4">
        <div className="h-6 w-28 rounded-sm bg-layer-3" />
      </div>
      <div className="flex items-center gap-3">
        {range(5).map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-layer-3" />
        ))}
      </div>
      <div className="divide-y divide-subtle-1">
        {range(5).map((i) => (
          <div key={i} className="flex h-12 w-full items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <div className="size-4 rounded-sm bg-layer-3" />
              <div className="h-4 w-40 rounded-sm bg-layer-3" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 rounded-sm bg-layer-3" />
              <div className="size-5 rounded-full bg-layer-3" />
              <div className="size-5 rounded-sm bg-layer-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
