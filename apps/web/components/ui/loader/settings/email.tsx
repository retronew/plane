/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

export function EmailSettingsLoader() {
  return (
    <div className="mx-auto mt-8 h-full w-full overflow-y-auto px-6 pb-8 motion-safe:animate-pulse lg:px-20">
      <div className="mb-2 flex flex-col gap-2 border-b border-subtle pt-6 pb-6">
        <div className="h-7 w-40 rounded-sm bg-layer-3" />
        <div className="h-5 w-96 max-w-full rounded-sm bg-layer-3" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center py-3">
          <div className="h-7 w-32 rounded-sm bg-layer-3" />
        </div>
        {range(4).map((i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2 py-3">
              <div className="h-5 w-32 rounded-sm bg-layer-3" />
              <div className="h-4 w-80 max-w-full rounded-sm bg-layer-3" />
            </div>
            <div className="flex items-center">
              <div className="size-5 rounded-sm bg-layer-3" />
            </div>
          </div>
        ))}
        <div className="flex items-center py-10">
          <div className="h-8 w-32 rounded-sm bg-layer-3" />
        </div>
      </div>
    </div>
  );
}
