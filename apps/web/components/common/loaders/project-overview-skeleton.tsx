/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Loader } from "@plane/blocks/skeleton";

export function ProjectOverviewSkeleton() {
  return (
    <div className="flex min-h-full w-full flex-col bg-surface-1 lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <Loader className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
        {/* Main content column */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-hidden p-6 lg:p-8">
          {/* Header title + status */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader.Item width="32px" height="32px" className="shrink-0 rounded-md" />
              <Loader.Item width="240px" height="26px" />
            </div>
            <Loader.Item width="85%" height="14px" />
            <Loader.Item width="65%" height="14px" />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-4 border-b border-subtle pb-3">
            <Loader.Item width="72px" height="20px" />
            <Loader.Item width="72px" height="20px" />
            <Loader.Item width="72px" height="20px" />
          </div>

          {/* Progress summary card */}
          <div className="space-y-4 rounded-xl border border-subtle bg-surface-1 p-5">
            <div className="flex items-center justify-between">
              <Loader.Item width="130px" height="18px" />
              <Loader.Item width="70px" height="18px" />
            </div>
            <Loader.Item width="100%" height="10px" className="rounded-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <div key={index} className="space-y-2 rounded-lg border border-subtle p-3">
                  <Loader.Item width="60%" height="12px" />
                  <Loader.Item width="40%" height="20px" />
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity / updates */}
          <div className="space-y-3">
            <Loader.Item width="120px" height="16px" />
            {Array.from({ length: 4 }).map((_, index) => (
              // oxlint-disable-next-line react/no-array-index-key
              <div key={index} className="flex items-center gap-3 rounded-lg border border-subtle p-3">
                <Loader.Item width="28px" height="28px" className="shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Loader.Item width="70%" height="14px" />
                  <Loader.Item width="35%" height="12px" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right properties sidebar */}
        <div className="w-full shrink-0 space-y-6 border-t border-subtle p-6 lg:w-96 lg:border-t-0 lg:border-l">
          <Loader.Item width="100%" height="132px" className="rounded-xl" />
          <div className="space-y-4">
            <Loader.Item width="100px" height="16px" />
            {Array.from({ length: 5 }).map((_, index) => (
              // oxlint-disable-next-line react/no-array-index-key
              <div key={index} className="flex items-center justify-between gap-4">
                <Loader.Item width="88px" height="14px" />
                <Loader.Item width="132px" height="24px" />
              </div>
            ))}
          </div>
        </div>
      </Loader>
    </div>
  );
}
