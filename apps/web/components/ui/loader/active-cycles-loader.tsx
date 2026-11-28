/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";
import { Loader } from "@plane/blocks/skeleton";

export function ActiveCyclesLoader({ count = 2 }: { count?: number }) {
  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-hidden px-page-x py-page-y">
      <Loader className="flex flex-col gap-4">
        {range(count).map((index) => (
          <div key={index} className="flex flex-col gap-4 rounded-xl border border-subtle-1 bg-surface-1 p-4 sm:p-5">
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Loader.Item width="24px" height="24px" className="shrink-0 rounded-md" />
                <Loader.Item width="180px" height="20px" />
                <Loader.Item width="72px" height="20px" className="rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <Loader.Item width="110px" height="16px" />
                <Loader.Item width="84px" height="28px" />
              </div>
            </div>

            {/* Body: left breakdown stats + right burndown chart */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-3 border-subtle lg:border-r lg:pr-6">
                <Loader.Item width="100%" height="10px" className="rounded-full" />
                {range(4).map((row) => (
                  <div key={row} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Loader.Item width="12px" height="12px" className="rounded-full" />
                      <Loader.Item width="96px" height="14px" />
                    </div>
                    <Loader.Item width="36px" height="14px" />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader.Item width="120px" height="28px" />
                  <Loader.Item width="80px" height="14px" />
                </div>
                <Loader.Item width="100%" height="210px" className="rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </Loader>
    </div>
  );
}
