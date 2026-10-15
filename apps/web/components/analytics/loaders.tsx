/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Loader } from "@plane/blocks/skeleton";

export function ProjectInsightsLoader() {
  return <ChartLoader />;
}
export function ChartLoader({ height = 288 }: { height?: number }) {
  return (
    <div style={{ height }}>
      <Loader className="flex h-full w-full items-end gap-5 border-b border-subtle px-6 pt-8 pb-5">
        {[40, 65, 48, 82, 56, 72, 50].map((barHeight) => (
          <Loader.Item key={barHeight} width="100%" height={`${barHeight}%`} className="rounded-t-md" />
        ))}
      </Loader>
    </div>
  );
}
export function AnalyticsDetailsLoader() {
  return (
    <div className="space-y-8">
      <Loader className="grid grid-cols-2 gap-5 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((key) => (
          <div className="space-y-3" key={key}>
            <Loader.Item width="80px" height="14px" />
            <Loader.Item width="42px" height="28px" />
          </div>
        ))}
      </Loader>
      <ChartLoader />
      <Loader className="space-y-4">
        {[0, 1, 2, 3].map((key) => (
          <Loader.Item key={key} height="32px" width="100%" />
        ))}
      </Loader>
    </div>
  );
}
