/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { IntakeActivityTabs } from "./intake-tabs";
import type { TIntakeActivityTab } from "./intake-tabs";
import uniq from "lodash-es/uniq";
import { observer } from "mobx-react";
// plane package imports
import type { TActivityFilters } from "@plane/constants";
import { E_SORT_ORDER, defaultActivityFilters } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
// i18n
import { useTranslation } from "@plane/i18n";
//types
import type { TFileSignedURLResponse, TIssueComment } from "@plane/types";
// components
import { CommentCreate } from "@/components/comments/comment-create";
// hooks
import { useProject } from "@/hooks/store/use-project";
// local imports
import { IssueActivityCommentRoot } from "./activity-comment-root";
import { useWorkItemCommentOperations } from "./helper";
import { ActivitySortRoot } from "./sort-root";
import { ActivityFilterRoot } from "./filter-root";

type TIssueActivity = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
  isIntakeIssue?: boolean;
  variant?: "default" | "tabs";
};

export type TActivityOperations = {
  createComment: (data: Partial<TIssueComment>) => Promise<TIssueComment>;
  updateComment: (commentId: string, data: Partial<TIssueComment>) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  uploadCommentAsset: (blockId: string, file: File, commentId?: string) => Promise<TFileSignedURLResponse>;
};

function canCreateComment(disabled: boolean, showTabs: boolean, tab: TIntakeActivityTab) {
  return !disabled && (!showTabs || tab === "all" || tab === "comments");
}

function isCommentComposerBeforeActivities(showTabs: boolean, sortOrder: E_SORT_ORDER) {
  return !showTabs && sortOrder === E_SORT_ORDER.DESC;
}

function toggleActivityFilter(selected: TActivityFilters[] | null | undefined, filter: TActivityFilters) {
  if (!selected) return undefined;
  if (!selected.includes(filter)) return uniq([...selected, filter]);
  if (selected.length === 1) return undefined;
  return selected.filter((value) => value !== filter);
}

function ActivityHeader({
  showTabs,
  intakeTab,
  setIntakeTab,
  sortOrder,
  toggleSort,
  selectedFilters,
  toggleFilter,
  projectId,
}: {
  showTabs: boolean;
  intakeTab: TIntakeActivityTab;
  setIntakeTab: (value: TIntakeActivityTab) => void;
  sortOrder: E_SORT_ORDER;
  toggleSort: () => void;
  selectedFilters: TActivityFilters[];
  toggleFilter: (value: TActivityFilters) => void;
  projectId: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      {showTabs ? (
        <IntakeActivityTabs value={intakeTab} onChange={setIntakeTab} />
      ) : (
        <div className="text-h5-medium text-primary">{t("common.activity")}</div>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <ActivitySortRoot sortOrder={sortOrder} toggleSort={toggleSort} />
        {!showTabs && (
          <ActivityFilterRoot selectedFilters={selectedFilters} toggleFilter={toggleFilter} projectId={projectId} />
        )}
      </div>
    </div>
  );
}

export const IssueActivity = observer(function IssueActivity(props: TIssueActivity) {
  const { workspaceSlug, projectId, issueId, disabled = false, isIntakeIssue = false, variant = "default" } = props;
  const showTabs = isIntakeIssue || variant === "tabs";
  const [intakeTab, setIntakeTab] = useState<TIntakeActivityTab>("all");
  // hooks
  const { setValue: setFilterValue, storedValue: selectedFilters } = useLocalStorage(
    "issue_activity_filters",
    defaultActivityFilters
  );
  const { setValue: setSortOrder, storedValue: sortOrder } = useLocalStorage(
    isIntakeIssue ? "intake_activity_sort_order" : "activity_sort_order",
    isIntakeIssue ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC
  );

  const { getProjectById } = useProject();

  // toggle filter
  const toggleFilter = (filter: TActivityFilters) => {
    const next = toggleActivityFilter(selectedFilters, filter);
    if (next) setFilterValue(next);
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === E_SORT_ORDER.ASC ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC);
  };

  // helper hooks
  const activityOperations = useWorkItemCommentOperations(workspaceSlug, projectId, issueId);

  const project = getProjectById(projectId);
  const renderCommentCreationBox = useMemo(
    () => (
      <CommentCreate
        workspaceSlug={workspaceSlug}
        entityId={issueId}
        activityOperations={activityOperations}
        showToolbarInitially
        variant={showTabs ? "compact" : "default"}
        isIntakeIssue={isIntakeIssue}
        projectId={projectId}
      />
    ),
    [workspaceSlug, issueId, activityOperations, projectId, isIntakeIssue, showTabs]
  );
  if (!project) return <></>;
  const effectiveSortOrder = sortOrder ?? (isIntakeIssue ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC);
  const showCommentCreation = canCreateComment(disabled, showTabs, intakeTab);
  const composerBeforeActivities = isCommentComposerBeforeActivities(showTabs, effectiveSortOrder);

  return (
    <div className="space-y-4">
      {/* header */}
      <ActivityHeader
        showTabs={showTabs}
        intakeTab={intakeTab}
        setIntakeTab={setIntakeTab}
        sortOrder={effectiveSortOrder}
        toggleSort={toggleSortOrder}
        selectedFilters={selectedFilters || defaultActivityFilters}
        toggleFilter={toggleFilter}
        projectId={projectId}
      />

      {/* rendering activity */}
      <div className="space-y-3">
        <div className="min-h-[200px]">
          <div className="space-y-3">
            {showCommentCreation && composerBeforeActivities && renderCommentCreationBox}
            <IssueActivityCommentRoot
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              isIntakeIssue={isIntakeIssue}
              intakeTab={intakeTab}
              variant={variant}
              issueId={issueId}
              selectedFilters={showTabs ? defaultActivityFilters : selectedFilters || defaultActivityFilters}
              activityOperations={activityOperations}
              showAccessSpecifier={!!project.anchor}
              disabled={disabled}
              sortOrder={effectiveSortOrder}
            />
            {showCommentCreation && !composerBeforeActivities && renderCommentCreationBox}
          </div>
        </div>
      </div>
    </div>
  );
});
