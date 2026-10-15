/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import { observer } from "mobx-react";
import { PriorityOutline } from "@makeplane/propel/icons";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";

type TIssuePriorityActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssuePriorityActivity = observer(function IssuePriorityActivity(props: TIssuePriorityActivity) {
  const { activityId, showIssue = true, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<PriorityOutline className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        <Translation
          translationKey="web.activity.priority"
          components={{
            value: (
              <span data-activity-part="" className="font-medium text-primary">
                <Translation translationKey={activity.new_value || "none"} />
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
