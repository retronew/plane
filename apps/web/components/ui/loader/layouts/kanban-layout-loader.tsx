/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
import { range } from "lodash-es";
// plane ui
import { ContentWrapper } from "@plane/blocks/layout";
// plane utils
import { cn } from "@plane/utils";

export const KanbanIssueBlockLoader = forwardRef(function KanbanIssueBlockLoader(
  { cardHeight = 100, shouldAnimate = true }: { cardHeight?: number; shouldAnimate?: boolean },
  ref: React.ForwardedRef<HTMLSpanElement>
) {
  return (
    <span
      ref={ref}
      className={cn(`block rounded-lg border border-subtle bg-layer-2 p-3`, { "animate-pulse": shouldAnimate })}
      style={{ height: `${cardHeight}px` }}
    >
      <span className="mb-3 block h-3 w-16 rounded-sm bg-layer-1" />
      <span className="mb-2 block h-3.5 w-4/5 rounded-sm bg-layer-1" />
      <span className="mt-3 flex gap-2">
        <span className="h-6 w-16 rounded-lg bg-layer-1" />
        <span className="h-6 w-12 rounded-lg bg-layer-1" />
      </span>
    </span>
  );
});

export function KanbanColumnLoader({
  cardsInColumn = 3,
  ignoreHeader = false,
  cardHeight = 100,
  shouldAnimate = true,
}: {
  cardsInColumn?: number;
  ignoreHeader?: boolean;
  cardHeight?: number;
  shouldAnimate?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", !ignoreHeader && "w-[336px] shrink-0 rounded-xl bg-layer-1 p-2")}>
      {!ignoreHeader && (
        <div className="flex h-9 items-center justify-between px-1">
          <div className="item-center flex gap-3">
            <span className={cn("h-4 w-4 rounded-full bg-layer-2", { "animate-pulse": shouldAnimate })} />
            <span className={cn("h-3.5 w-20 rounded-sm bg-layer-2", { "animate-pulse": shouldAnimate })} />
          </div>
        </div>
      )}
      {range(cardsInColumn).map((cardIndex) => (
        <KanbanIssueBlockLoader key={cardIndex} cardHeight={cardHeight} shouldAnimate={shouldAnimate} />
      ))}
    </div>
  );
}

KanbanIssueBlockLoader.displayName = "KanbanIssueBlockLoader";

const SKELETON_COLUMNS = [
  { id: "first", count: 2 },
  { id: "second", count: 3 },
  { id: "third", count: 4 },
];
export function KanbanLayoutLoader() {
  return (
    <ContentWrapper className="h-full flex-row gap-4 overflow-hidden p-3!">
      {SKELETON_COLUMNS.map((column) => (
        <KanbanColumnLoader key={column.id} cardsInColumn={column.count} />
      ))}
    </ContentWrapper>
  );
}
