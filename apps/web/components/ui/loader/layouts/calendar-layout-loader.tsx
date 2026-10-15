/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";

function CalendarDay({ index }: { index: number }) {
  const dataCount = index % 4 === 0 ? 1 : 0;
  const dataBlocks = range(dataCount).map((blockIndex) => (
    <span key={blockIndex} className="mb-2 h-[34px] w-full rounded-xl border border-subtle bg-layer-1" />
  ));

  return (
    <div className="flex min-h-[9rem] w-full flex-col">
      <div className="flex w-full items-center justify-end p-2">
        <span className="h-4 w-4 rounded-sm bg-layer-1" />
      </div>
      <div className="flex flex-col gap-2.5 p-2">{dataBlocks}</div>
    </div>
  );
}

export function CalendarLayoutLoader({
  showWeekends = false,
  layout = "month",
}: {
  showWeekends?: boolean;
  layout?: "month" | "week";
}) {
  const columns = showWeekends ? 7 : 5;
  return (
    <div className="h-full w-full animate-pulse overflow-y-auto bg-surface-1">
      <span
        className={`relative grid ${showWeekends ? "grid-cols-7" : "grid-cols-5"} divide-x-[0.5px] divide-subtle-1 text-13 font-medium`}
      >
        {range(columns).map((index) => (
          <span key={index} className="h-11 w-full bg-layer-1" />
        ))}
      </span>
      <div className="h-full w-full overflow-y-auto">
        <div className="grid h-full w-full grid-cols-1 divide-y-[0.5px] divide-subtle-1 overflow-y-auto">
          {range(layout === "week" ? 1 : 6).map((index) => (
            <div
              key={index}
              className={`grid ${showWeekends ? "grid-cols-7" : "grid-cols-5"} divide-x-[0.5px] divide-subtle-1`}
            >
              {range(columns).map((dayIndex) => (
                <CalendarDay key={dayIndex} index={dayIndex} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
