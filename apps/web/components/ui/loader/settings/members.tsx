/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

export function MembersSettingsLoader() {
  return (
    <div className="divide-y-[0.5px] divide-subtle motion-safe:animate-pulse">
      {range(5).map((i) => (
        <div key={i} className="group grid grid-cols-5 items-center justify-evenly px-3 py-4">
          <div className="col-span-2 flex items-center gap-x-2.5">
            <div className="size-6 shrink-0 rounded-full bg-layer-3" />
            <div className="h-4 w-28 rounded-sm bg-layer-3" />
          </div>
          <div className="h-4 w-24 rounded-sm bg-layer-3" />
          <div className="h-4 w-20 rounded-sm bg-layer-3" />
          <div className="h-4 w-28 rounded-sm bg-layer-3" />
        </div>
      ))}
    </div>
  );
}
