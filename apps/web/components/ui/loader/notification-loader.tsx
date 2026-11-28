/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

export function NotificationsLoader() {
  return (
    <div className="divide-y divide-subtle overflow-hidden motion-safe:animate-pulse">
      {range(6).map((i) => (
        <div key={i} className="flex w-full items-center gap-3.5 p-3.5">
          <div className="size-10 shrink-0 rounded-full bg-layer-3" />
          <div className="flex w-full flex-col gap-2">
            <div className="h-4 w-3/4 rounded-sm bg-layer-3" />
            <div className="flex w-full items-center justify-between gap-2">
              <div className="h-3.5 w-28 rounded-sm bg-layer-3" />
              <div className="h-3.5 w-14 rounded-sm bg-layer-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
