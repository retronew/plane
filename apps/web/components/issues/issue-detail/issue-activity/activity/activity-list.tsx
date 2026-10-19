/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactElement } from "react";
import { observer } from "mobx-react";
// helpers
import { getValidKeysFromObject } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useTimeLineRelationOptions } from "@/components/relations";
// local components
import {
  IssueDefaultActivity,
  IssueNameActivity,
  IssueDescriptionActivity,
  IssueStateActivity,
  IssueApprovalActivity,
  IssueAssigneeActivity,
  IssuePriorityActivity,
  IssueEstimateActivity,
  IssueParentActivity,
  IssueRelationActivity,
  IssueStartDateActivity,
  IssueTargetDateActivity,
  IssueCycleActivity,
  IssueModuleActivity,
  IssueLabelActivity,
  IssueLinkActivity,
  IssueAttachmentActivity,
  IssueArchivedAtActivity,
  IssueInboxActivity,
} from "./actions";

type TIssueActivityItem = {
  activityId: string;
  ends: "top" | "bottom" | undefined;
};

type TActivityRenderer = (props: TIssueActivityItem) => ReactElement;

const renderDefaultActivity: TActivityRenderer = (props) => <IssueDefaultActivity {...props} />;

const renderRelationActivity: TActivityRenderer = (props) => <IssueRelationActivity {...props} />;

const ACTIVITY_RENDERERS: Record<string, TActivityRenderer> = {
  state: (props) => <IssueStateActivity {...props} showIssue={false} />,
  approval: (props) => <IssueApprovalActivity {...props} />,
  name: (props) => <IssueNameActivity {...props} />,
  description: (props) => <IssueDescriptionActivity {...props} showIssue={false} />,
  assignees: (props) => <IssueAssigneeActivity {...props} showIssue={false} />,
  priority: (props) => <IssuePriorityActivity {...props} showIssue={false} />,
  estimate_points: (props) => <IssueEstimateActivity {...props} showIssue={false} />,
  estimate_categories: (props) => <IssueEstimateActivity {...props} showIssue={false} />,
  // This key handles all the older recorded activities for estimates.
  // Field changed from "estimate_point" -> `estimate_${estimate_type}`
  estimate_point: (props) => <IssueEstimateActivity {...props} showIssue={false} />,
  parent: (props) => <IssueParentActivity {...props} showIssue={false} />,
  start_date: (props) => <IssueStartDateActivity {...props} showIssue={false} />,
  target_date: (props) => <IssueTargetDateActivity {...props} showIssue={false} />,
  cycles: (props) => <IssueCycleActivity {...props} />,
  modules: (props) => <IssueModuleActivity {...props} />,
  labels: (props) => <IssueLabelActivity {...props} showIssue={false} />,
  link: (props) => <IssueLinkActivity {...props} showIssue={false} />,
  attachment: (props) => <IssueAttachmentActivity {...props} showIssue={false} />,
  archived_at: (props) => <IssueArchivedAtActivity {...props} />,
  intake: (props) => <IssueInboxActivity {...props} />,
  inbox: (props) => <IssueInboxActivity {...props} />,
};

function getActivityRenderer(activityField: string | null | undefined, activityRelations: string[]) {
  if (activityField === null) return renderDefaultActivity;
  if (activityField === undefined || activityRelations.includes(activityField)) return renderRelationActivity;
  return ACTIVITY_RENDERERS[activityField] ?? null;
}

export const IssueActivityItem = observer(function IssueActivityItem(props: TIssueActivityItem) {
  const { activityId, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
    // oxlint-disable-next-line no-empty-pattern
    comment: {},
  } = useIssueDetail();
  const ISSUE_RELATION_OPTIONS = useTimeLineRelationOptions();
  const activityRelations = getValidKeysFromObject(ISSUE_RELATION_OPTIONS);

  const activityField = getActivityById(activityId)?.field;
  const renderActivity = getActivityRenderer(activityField, activityRelations);

  return renderActivity ? renderActivity({ activityId, ends }) : null;
});
