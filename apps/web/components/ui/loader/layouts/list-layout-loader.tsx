/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
import { Row } from "@plane/blocks/layout";
import { cn } from "@plane/utils";

const titleWidths = ["34%", "48%", "26%", "42%", "30%", "52%"];
export const ListLoaderItemRow = forwardRef(function ListLoaderItemRow(
  {
    shouldAnimate = true,
    renderForPlaceHolder = false,
    defaultPropertyCount = 5,
    index = 0,
  }: { shouldAnimate?: boolean; renderForPlaceHolder?: boolean; defaultPropertyCount?: number; index?: number },
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const pillCount = Math.min(Math.max(defaultPropertyCount, 2), 6);
  return (
    <Row
      ref={ref}
      className={cn("flex h-11 min-w-0 items-center gap-3 py-0", {
        "bg-surface-1": renderForPlaceHolder,
        "border-b border-subtle": !renderForPlaceHolder,
        "motion-safe:animate-pulse": shouldAnimate,
      })}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="size-3.5 shrink-0 rounded-sm bg-layer-3" />
        <span className="w-20 shrink-0">
          <span className="block h-3 w-16 rounded-sm bg-layer-3" />
        </span>
        <span className="size-3.5 shrink-0 rounded-full bg-layer-3" />
        <span
          className="h-3.5 min-w-16 rounded-sm bg-layer-3"
          style={{ width: titleWidths[index % titleWidths.length] }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {Array.from({ length: pillCount }, (_, propertyIndex) => (
          <span
            key={propertyIndex}
            className={cn(
              "h-6 rounded-md bg-layer-3",
              propertyIndex < 3 ? "w-16" : propertyIndex === 3 ? "w-12" : "w-6"
            )}
          />
        ))}
        <span className="size-5 rounded-sm bg-layer-3" />
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
        <Row className="flex h-[45px] shrink-0 items-center gap-2 border-b border-subtle bg-surface-2">
          <span className="size-4 rounded-full bg-layer-3" />
          <span className="h-3.5 w-14 rounded-sm bg-layer-3" />
          <span className="ml-0.5 h-3 w-5 rounded-sm bg-layer-3" />
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
    <div className="skeleton-delayed flex size-full flex-col overflow-hidden bg-surface-1">
      <ListSection itemCount={15} grouped={grouped} propertyCount={propertyCount} />
    </div>
  );
}
