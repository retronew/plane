/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

export function ViewListLoader() {
  return (
    <div className="skeleton-delayed flex h-full w-full flex-col">
      {range(8).map((i) => (
        <div key={i} className="border-b border-subtle">
          <div className="relative flex min-h-[52px] w-full items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="size-4 shrink-0 rounded-sm bg-layer-3" />
              <div className="h-4 w-44 rounded-sm bg-layer-3" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-20 rounded-sm bg-layer-3" />
              <div className="size-5 rounded-full bg-layer-3" />
              <div className="size-4 rounded-sm bg-layer-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
