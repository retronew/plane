/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation, useTranslation } from "@plane/i18n";
import { ShieldCheck } from "lucide-react";
import { observer } from "mobx-react";
// hooks
import { StateOutline } from "@makeplane/propel/icons";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";
// icons

type TIssueStateActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueApprovalActivity = observer(function IssueApprovalActivity({
  activityId,
  ends,
}: TIssueStateActivity) {
  const {
    activity: { getActivityById },
  } = useIssueDetail();
  const { t } = useTranslation();
  const activity = getActivityById(activityId);
  if (!activity) return null;
  const action = ["requested", "approved", "rejected", "cancelled"].includes(activity.verb) ? activity.verb : "updated";
  return (
    <IssueActivityBlockComponent activityId={activityId} ends={ends} icon={<ShieldCheck className="size-4" />}>
      {t(`web.workflow_ui.approval_activity.${action}`)}
    </IssueActivityBlockComponent>
  );
});

export const IssueStateActivity = observer(function IssueStateActivity(props: TIssueStateActivity) {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<StateOutline className="h-4 w-4 flex-shrink-0 text-secondary" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        <Translation
          translationKey="web.activity.state"
          components={{
            value: (
              <span data-activity-part="" className="font-medium text-primary">
                {activity.new_value}
              </span>
            ),
            issue: showIssue ? (
              <IssueLink activityId={activityId} />
            ) : (
              <Translation translationKey="web.this_work_item" />
            ),
          }}
        />
      </>
    </IssueActivityBlockComponent>
  );
});
