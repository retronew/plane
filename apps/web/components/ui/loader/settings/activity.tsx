/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

const ROW_WIDTHS = ["w-52", "w-72", "w-64", "w-80", "w-56"];

export function ActivitySettingsLoader() {
  return (
    <div className="flex flex-col gap-3 motion-safe:animate-pulse">
      {range(10).map((i) => (
        <div key={i} className="relative flex h-12 items-center gap-3 border-b border-subtle">
          <div className="size-6 shrink-0 rounded-full bg-layer-3" />
          <div className={`h-4 ${ROW_WIDTHS[i % ROW_WIDTHS.length]} max-w-[75%] rounded-sm bg-layer-3`} />
        </div>
      ))}
    </div>
  );
}
