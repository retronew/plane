/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";
// ui
import { Loader } from "@plane/blocks/skeleton";

export function HomeLoader() {
  return (
    <Loader className="flex flex-col gap-7 py-4">
      {/* Quick links section */}
      <div className="space-y-3">
        <Loader.Item height="18px" width="110px" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {range(3).map((index) => (
            <div key={index} className="flex h-14 items-center gap-3 rounded-xl border border-subtle bg-surface-1 p-3">
              <Loader.Item height="28px" width="28px" className="shrink-0 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Loader.Item height="13px" width="75%" />
                <Loader.Item height="10px" width="45%" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity section */}
      <div className="space-y-3">
        <Loader.Item height="18px" width="130px" />
        <div className="divide-y divide-subtle rounded-xl border border-subtle bg-surface-1">
          {range(4).map((index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-3">
              <Loader.Item height="20px" width="20px" className="shrink-0 rounded-sm" />
              <Loader.Item height="14px" width={`${45 + (index % 3) * 14}%`} />
              <Loader.Item height="12px" width="64px" className="ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Stickies section */}
      <div className="space-y-3">
        <Loader.Item height="18px" width="96px" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4">
          {range(3).map((index) => (
            <div key={index} className="space-y-3 rounded-xl border border-subtle bg-surface-1 p-4">
              <Loader.Item height="16px" width="65%" />
              <Loader.Item height="12px" width="100%" />
              <Loader.Item height="12px" width="80%" />
            </div>
          ))}
        </div>
      </div>
    </Loader>
  );
}
