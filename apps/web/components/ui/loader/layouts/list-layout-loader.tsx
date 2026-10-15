/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
import { Row } from "@plane/blocks/layout";
import { cn } from "@plane/utils";

const titleWidths = ["38%", "56%", "28%", "48%", "34%", "62%"];
export const ListLoaderItemRow = forwardRef(function ListLoaderItemRow(
  {
    shouldAnimate = true,
    renderForPlaceHolder = false,
    defaultPropertyCount = 6,
    index = 0,
  }: { shouldAnimate?: boolean; renderForPlaceHolder?: boolean; defaultPropertyCount?: number; index?: number },
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <Row
      ref={ref}
      className={cn("flex h-12 min-w-0 items-center gap-3 py-0", {
        "bg-surface-1": renderForPlaceHolder,
        "box-content border-b border-subtle": !renderForPlaceHolder,
        "motion-safe:animate-pulse": shouldAnimate,
      })}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-20 shrink-0 sm:w-22">
          <span className="block h-3 w-16 rounded-sm bg-layer-1" />
        </span>
        <span
          className="h-3.5 min-w-16 rounded-sm bg-layer-1"
          style={{ width: titleWidths[index % titleWidths.length] }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {Array.from({ length: defaultPropertyCount }, (_, propertyIndex) => (
          <span key={propertyIndex} className={cn("h-6 rounded-lg bg-layer-1", propertyIndex < 3 ? "w-16" : "w-6")} />
        ))}
        <span className="size-6 rounded-md bg-layer-1" />
      </div>
    </Row>
  );
});

function ListSection({
  itemCount,
  grouped,
  propertyCount,
}: {
  itemCount: number;
  grouped: boolean;
  propertyCount?: number;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      {grouped && (
        <Row className="flex h-[42px] shrink-0 items-center gap-2 border-b border-subtle bg-layer-1">
          <span className="size-4 rounded-full bg-layer-2" />
          <span className="h-3.5 w-16 rounded-sm bg-layer-2" />
          <span className="ml-1 h-3 w-4 rounded-sm bg-layer-2" />
        </Row>
      )}
      {Array.from({ length: itemCount }, (_, index) => (
        <ListLoaderItemRow key={index} index={index} shouldAnimate={false} defaultPropertyCount={propertyCount} />
      ))}
    </div>
  );
}

export function ListLayoutLoader({ grouped = true, propertyCount }: { grouped?: boolean; propertyCount?: number }) {
  return (
    <div className="flex size-full flex-col overflow-hidden bg-surface-1 motion-safe:animate-pulse">
      {(grouped ? [6, 4, 2] : [12]).map((itemCount) => (
        <ListSection key={itemCount} itemCount={itemCount} grouped={grouped} propertyCount={propertyCount} />
      ))}
    </div>
  );
}
