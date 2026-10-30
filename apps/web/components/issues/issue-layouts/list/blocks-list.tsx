/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useCallback, useLayoutEffect, useRef } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import { observer } from "mobx-react";
import { useProject } from "@/hooks/store/use-project";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useWindowedRows } from "@plane/blocks/virtual-list";
// components
import type { TIssue, IIssueDisplayProperties, TIssueMap } from "@plane/types";
// hooks
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// types
import { IssueBlockRoot } from "./block-root";
import { buildIssueHierarchy } from "./hierarchy";
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

  const { getProjectIdentifierById } = useProject();
  const identifierWidth = Math.max(
    50,
    ...issueIds.map((id) => {
      const issue = issuesMap[id];
      return issue ? `${getProjectIdentifierById(issue.project_id) ?? ""}-${issue.sequence_id}`.length * 8 + 4 : 0;
    })
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  const rows = buildIssueHierarchy(issueIds, issuesMap);
  const virtualized = rows.length > 100;
  const getItemKey = useCallback((index: number) => rows[index].id, [rows]);
  const { virtualizer, scrollMargin } = useWindowedRows({
    count: rows.length,
    estimateSize: 44,
    getItemKey,
    scrollRef: containerRef,
    contentRef,
    enabled: virtualized,
  });
  const { getActiveEntityDetails } = useMultipleSelectStore();
  const active = getActiveEntityDetails();
  const activeIndex = active?.groupID === groupId ? rows.findIndex((row) => row.id === active.entityID) : -1;
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
      treeBranches={rows[index].branches}
      hasTreeChildren={(rows[index + 1]?.level ?? 0) > rows[index].level}
      nestingLevel={rows[index].level}
      spacingLeft={rows[index].level * 24}
      containerRef={containerRef}
      selectionHelpers={selectionHelpers}
      groupId={groupId}
      isLastChild={index === rows.length - 1}
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
      style={
        {
          "--issue-list-identifier-width": `${identifierWidth}px`,
          ...(virtualized ? { height: virtualizer.getTotalSize() } : {}),
        } as CSSProperties
      }
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
                {renderRow(rows[row.index].id, row.index)}
              </div>
            </Fragment>
          ))
        : rows.map((row, index) => renderRow(row.id, index))}
    </div>
  );
});
