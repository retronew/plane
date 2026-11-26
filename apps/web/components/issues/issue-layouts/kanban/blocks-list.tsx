/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { TIssue, IIssueDisplayProperties, IIssueMap } from "@plane/types";
// local imports
import type { TRenderQuickActions } from "../list/list-view-types";
import { KanbanIssueBlock } from "./block";
import { createCardObserver } from "./card-viewport";
import { DeferredKanbanCard } from "./deferred-card";

interface IssueBlocksListProps {
  deferCards?: boolean;
  sub_group_id: string;
  groupId: string;
  /** dnd-kit column id of this list. */
  columnId: string;
  /** The card being dragged and the column it came from: it keeps that column's sortable id here. */
  activeIssueId: string | null;
  activeSourceColumnId: string | null;
  issuesMap: IIssueMap;
  issueIds: string[];
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  canEditProperties: (projectId: string | undefined) => boolean;
  canDragIssuesInCurrentGrouping: boolean;
}

export const KanbanIssueBlocksList = observer(function KanbanIssueBlocksList(props: IssueBlocksListProps) {
  const {
    sub_group_id,
    groupId,
    columnId,
    activeIssueId,
    activeSourceColumnId,
    issuesMap,
    issueIds,
    displayProperties,
    canDragIssuesInCurrentGrouping,
    updateIssue,
    quickActions,
    canEditProperties,
  } = props;

  const observe = useMemo(createCardObserver, []);
  // A portaled editor may take focus outside the card. Keep its owner until another card takes over.
  const [interactionOwner, setInteractionOwner] = useState<string | null>(null);

  return issueIds.map((issueId, index) => {
    if (!issueId) return null;
    const homeColumnId = issueId === activeIssueId && activeSourceColumnId ? activeSourceColumnId : columnId;
    const card = (
      <KanbanIssueBlock
        key={issueId}
        issueId={issueId}
        groupId={groupId}
        subGroupId={sub_group_id}
        issuesMap={issuesMap}
        displayProperties={displayProperties}
        updateIssue={updateIssue}
        quickActions={quickActions}
        draggableId={`${issueId}__${homeColumnId}`}
        index={index}
        columnId={columnId}
        canDragIssuesInCurrentGrouping={canDragIssuesInCurrentGrouping}
        canEditProperties={canEditProperties}
        hasRowWrapper={props.deferCards}
      />
    );
    if (!props.deferCards) return card;
    const issue = issuesMap[issueId];
    if (!issue) return null;
    return (
      <DeferredKanbanCard
        key={issueId}
        issueId={issueId}
        groupId={groupId}
        subGroupId={sub_group_id}
        name={issue.name}
        observe={observe}
        enabled={!issue.tempId}
        revealBeforePaint={index < 2}
        pinned={issueId === activeIssueId || issueId === interactionOwner}
        pin={setInteractionOwner}
      >
        {card}
      </DeferredKanbanCard>
    );
  });
});
