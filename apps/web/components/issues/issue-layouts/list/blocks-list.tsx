/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useCallback, useLayoutEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { observer } from "mobx-react";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useWindowedRows } from "@plane/blocks/virtual-list";
// components
import type { TIssue, IIssueDisplayProperties, TIssueMap } from "@plane/types";
// hooks
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// types
import { IssueBlockRoot } from "./block-root";
import type { TRenderQuickActions } from "./list-view-types";

interface Props {
  issueIds: string[];
  issuesMap: TIssueMap;
  groupId: string;
  canEditProperties: (projectId: string | undefined) => boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  displayProperties: IIssueDisplayProperties | undefined;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  isDragAllowed: boolean;
  canDropOverIssue: boolean;
  selectionHelpers: TSelectionHelper;
}

export const IssueBlocksList = observer(function IssueBlocksList(props: Props) {
  const {
    issueIds,
    issuesMap,
    groupId,
    updateIssue,
    quickActions,
    displayProperties,
    canEditProperties,
    containerRef,
    selectionHelpers,
    isDragAllowed,
    canDropOverIssue,
  } = props;

  const contentRef = useRef<HTMLDivElement | null>(null);
  const virtualized = issueIds.length > 100;
  const getItemKey = useCallback((index: number) => issueIds[index], [issueIds]);
  const { virtualizer, scrollMargin } = useWindowedRows({
    count: issueIds.length,
    estimateSize: 49,
    getItemKey,
    scrollRef: containerRef,
    contentRef,
    enabled: virtualized,
  });
  const { getActiveEntityDetails } = useMultipleSelectStore();
  const active = getActiveEntityDetails();
  const activeIndex = active?.groupID === groupId ? issueIds.indexOf(active.entityID) : -1;
  useLayoutEffect(() => {
    if (virtualized && activeIndex >= 0) virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [virtualized, activeIndex, virtualizer]);
  const renderRow = (issueId: string, index: number) => (
    <IssueBlockRoot
      key={issueId}
      issueId={issueId}
      issuesMap={issuesMap}
      updateIssue={updateIssue}
      quickActions={quickActions}
      displayProperties={displayProperties}
      canEditProperties={canEditProperties}
      nestingLevel={0}
      spacingLeft={0}
      containerRef={containerRef}
      selectionHelpers={selectionHelpers}
      groupId={groupId}
      isLastChild={index === issueIds.length - 1}
      isDragAllowed={isDragAllowed}
      canDropOverIssue={canDropOverIssue}
      virtualized={virtualized}
    />
  );
  return (
    <div
      ref={contentRef}
      data-virtual-list={virtualized || undefined}
      className="relative w-full"
      style={virtualized ? { height: virtualizer.getTotalSize() } : undefined}
    >
      {virtualized
        ? virtualizer.getVirtualItems().map((row) => (
            <Fragment key={row.key}>
              <div
                data-index={row.index}
                data-virtual-index={row.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${row.start - scrollMargin}px)` }}
              >
                {renderRow(issueIds[row.index], row.index)}
              </div>
            </Fragment>
          ))
        : issueIds.map(renderRow)}
    </div>
  );
});
