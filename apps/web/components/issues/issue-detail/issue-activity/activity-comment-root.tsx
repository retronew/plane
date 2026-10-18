/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { ArrowNarrowRightOutline } from "@makeplane/propel/icons";
import { IntakeHistoryValue } from "./history-value";
import type { TIntakeActivityTab } from "./intake-tabs";
// plane imports
import type { E_SORT_ORDER, TActivityFilters, EActivityFilterType } from "@plane/constants";
import { BASE_ACTIVITY_FILTER_TYPES, filterActivityOnSelectedFilters } from "@plane/constants";
import type { TCommentsOperations } from "@plane/types";
// components
import { CommentCard } from "@/components/comments/card/root";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { IssueActivityItem } from "./activity/activity-list";
import { ActivityDisplayContext, IntakeActivityContext } from "./intake-activity-context";
import { IssueActivityLoader } from "./loader";

type TIssueActivityCommentRoot = {
  workspaceSlug: string;
  projectId: string;
  isIntakeIssue: boolean;
  intakeTab?: TIntakeActivityTab;
  variant?: "default" | "tabs";
  issueId: string;
  selectedFilters: TActivityFilters[];
  activityOperations: TCommentsOperations;
  showAccessSpecifier?: boolean;
  disabled?: boolean;
  sortOrder: E_SORT_ORDER;
};

export const IssueActivityCommentRoot = observer(function IssueActivityCommentRoot(props: TIssueActivityCommentRoot) {
  const {
    workspaceSlug,
    isIntakeIssue,
    intakeTab = "all",
    variant = "default",
    issueId,
    selectedFilters,
    activityOperations,
    showAccessSpecifier,
    projectId,
    disabled,
    sortOrder,
  } = props;
  const { t } = useTranslation();
  // store hooks
  const {
    activity: { getActivityAndCommentsByIssueId, getActivityById },
    comment: { getCommentById },
  } = useIssueDetail();
  // derived values
  const showTabs = isIntakeIssue || variant === "tabs";
  const activityAndComments = getActivityAndCommentsByIssueId(issueId, sortOrder);

  if (!activityAndComments) return <IssueActivityLoader />;

  const filteredActivityAndComments = filterActivityOnSelectedFilters(activityAndComments, selectedFilters).filter(
    (item) => {
      if (!showTabs || intakeTab === "all") return true;
      if (intakeTab === "comments") return item.activity_type === "COMMENT";
      if (item.activity_type === "COMMENT") return false;
      const activity = getActivityById(item.id);
      if (intakeTab === "transitions") return activity?.field === "state";
      if (intakeTab === "history") return activity?.old_value != null || activity?.new_value != null;
      return true;
    }
  );

  if (filteredActivityAndComments.length === 0) {
    if (!showTabs || intakeTab === "comments") return null;
    const emptyKey =
      intakeTab === "transitions" ? "no_transitions" : intakeTab === "history" ? "no_history" : "no_activity";
    return (
      <p className="py-8 text-center text-body-xs-regular text-tertiary">{t(`activity_empty_state.${emptyKey}`)}</p>
    );
  }

  return (
    <div>
      {filteredActivityAndComments.map((activityComment, index) => {
        const comment = getCommentById(activityComment.id);
        return activityComment.activity_type === "COMMENT" ? (
          <CommentCard
            key={activityComment.id}
            workspaceSlug={workspaceSlug}
            entityId={issueId}
            comment={comment}
            activityOperations={activityOperations}
            ends={
              showTabs && filteredActivityAndComments.length === 1
                ? "only"
                : index === 0
                  ? "top"
                  : index === filteredActivityAndComments.length - 1
                    ? "bottom"
                    : undefined
            }
            showAccessSpecifier={!!showAccessSpecifier}
            showCopyLinkOption={!isIntakeIssue}
            disabled={disabled}
            projectId={projectId}
            enableReplies
            isIntakeIssue={isIntakeIssue}
            variant={showTabs ? "compact" : "default"}
          />
        ) : BASE_ACTIVITY_FILTER_TYPES.includes(activityComment.activity_type as EActivityFilterType) ? (
          <div
            key={activityComment.id}
            className={
              showTabs
                ? "relative text-body-xs-regular [&>div.flex]:text-body-xs-regular [&>div.flex>div:last-child]:text-caption-sm-regular"
                : undefined
            }
          >
            {showTabs && filteredActivityAndComments.length > 1 && (
              <div aria-hidden className="absolute top-0 bottom-0 left-[13px] w-px bg-layer-3" />
            )}
            <ActivityDisplayContext.Provider value={showTabs}>
              <IntakeActivityContext.Provider value={isIntakeIssue}>
                <IssueActivityItem
                  activityId={activityComment.id}
                  ends={index === 0 ? "top" : index === filteredActivityAndComments.length - 1 ? "bottom" : undefined}
                />
              </IntakeActivityContext.Provider>
            </ActivityDisplayContext.Provider>
            {showTabs && intakeTab === "history" && (
              <div className="ml-10 flex min-w-0 items-center gap-3 pb-3 text-body-xs-regular text-secondary">
                {["old_value", "new_value"].map((key, valueIndex) => {
                  const activity = getActivityById(activityComment.id);
                  const value = activity?.[key as "old_value" | "new_value"];
                  return (
                    <span key={key} className="contents">
                      {valueIndex === 1 && <ArrowNarrowRightOutline className="size-3.5 shrink-0" aria-hidden />}
                      <IntakeHistoryValue field={activity?.field} value={value} />
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ) : null;
      })}
    </div>
  );
});
