/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

export function InboxSidebarLoader() {
  return (
    <div className="flex flex-col motion-safe:animate-pulse">
      {range(6).map((index) => (
        <div key={index} className="flex h-[105px] flex-col justify-between border-b border-subtle p-4">
          <div className="flex flex-col gap-2">
            <div className="h-4 w-16 rounded-sm bg-layer-3" />
            <div className="h-4 w-40 rounded-sm bg-layer-3" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 rounded-sm bg-layer-3" />
            <div className="size-2 rounded-full bg-layer-3" />
            <div className="h-4 w-16 rounded-sm bg-layer-3" />
            <div className="h-4 w-16 rounded-sm bg-layer-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
