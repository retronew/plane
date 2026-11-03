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
import { StateGroupIcon } from "@plane/blocks/icons";
import { useProjectState } from "@/hooks/store/use-project-state";
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
  const { getStateById } = useProjectState();
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  const state = activity.new_identifier ? getStateById(activity.new_identifier) : undefined;
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
              <span
                data-activity-part=""
                className="inline-flex items-center gap-1 rounded-sm bg-layer-1 px-1.5 py-0.5 align-middle text-caption-md-medium text-primary"
              >
                {state && (
                  <StateGroupIcon
                    stateGroup={state.group}
                    color={state.color}
                    icon={state.icon}
                    className="size-3.5 shrink-0"
                  />
                )}
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
