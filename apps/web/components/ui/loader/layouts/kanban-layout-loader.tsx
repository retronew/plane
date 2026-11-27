/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ContentWrapper } from "@plane/blocks/layout";
import type { IIssueDisplayProperties } from "@plane/types";
import { splitKanbanCardProperties } from "@/components/issues/issue-layouts/kanban/card-layout";

const defaultProperties: IIssueDisplayProperties = {
  key: true,
  state: true,
  labels: true,
  priority: true,
  assignee: true,
  due_date: true,
};

type CardProps = { displayProperties?: IIssueDisplayProperties };

export function KanbanIssueBlockLoader({ displayProperties = defaultProperties }: CardProps) {
  const { body, showLabels, showStateIcon, showFooterProperties } = splitKanbanCardProperties(displayProperties);
  const bodyCount =
    Number(showLabels) + Object.entries(body ?? {}).filter(([key, enabled]) => key !== "key" && enabled).length;
  return (
    <div
      data-kanban-card-skeleton=""
      aria-hidden="true"
      className="space-y-2 rounded-xl border border-subtle bg-surface-1 p-2.5 pb-2 shadow-raised-100 motion-safe:animate-pulse"
    >
      <div className="flex min-h-6 items-center gap-1.5">
        {displayProperties.key && <span className="h-3 w-14 rounded-sm bg-layer-3" />}
        {displayProperties.priority && <span className="h-5 w-10 rounded-lg bg-layer-3" />}
      </div>
      <div className="flex min-h-5 items-center gap-1.5">
        {showStateIcon && <span className="size-4 rounded-full bg-layer-3" />}
        <span className="h-3.5 w-3/5 rounded-sm bg-layer-3" />
      </div>
      {bodyCount > 0 && (
        <div data-kanban-skeleton-properties="" className="flex flex-wrap gap-1.5">
          {["w-16", "w-20", "w-14", "w-12", "w-16", "w-14"].slice(0, bodyCount).map((width, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- Fixed decorative slots.
            <span key={index} className={`h-6 rounded-lg bg-layer-3 ${width}`} />
          ))}
        </div>
      )}
      {(displayProperties.assignee || showFooterProperties) && (
        <div
          data-kanban-skeleton-footer=""
          className="flex min-h-6 items-center justify-between border-t border-subtle pt-1.5"
        >
          {displayProperties.assignee && <span className="size-5 rounded-full bg-layer-3" />}
          {showFooterProperties && <span className="ms-auto h-5 w-14 rounded-lg bg-layer-3" />}
        </div>
      )}
    </div>
  );
}

const columns = ["first", "second", "third", "fourth", "fifth"];
const cards = ["first", "second", "third"];

export function KanbanLayoutLoader({ displayProperties }: CardProps) {
  return (
    <div
      aria-hidden="true"
      className="horizontal-scrollbar pointer-events-none scrollbar-md h-full overflow-x-auto overflow-y-hidden bg-surface-1"
      inert
    >
      <ContentWrapper className="h-full w-max! min-w-full flex-row gap-4 overflow-hidden p-4!">
        {columns.map((column) => (
          <div
            key={column}
            className="flex h-full w-[336px] shrink-0 flex-col rounded-xl border border-subtle bg-surface-2 p-2"
          >
            <div className="flex h-[34px] shrink-0 items-center gap-1 px-3 motion-safe:animate-pulse">
              <span className="size-5 rounded-sm bg-layer-3" />
              <span className="h-3.5 w-16 rounded-sm bg-layer-3" />
              <span className="ms-2 size-3 rounded-sm bg-layer-3" />
            </div>
            <div className="vertical-scrollbar scrollbar-md min-h-0 flex-1 [scrollbar-gutter:stable_both-edges] space-y-2 overflow-hidden pt-2">
              {cards.map((card) => (
                <KanbanIssueBlockLoader key={card} displayProperties={displayProperties} />
              ))}
            </div>
          </div>
        ))}
      </ContentWrapper>
    </div>
  );
}
