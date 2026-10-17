/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { isEmpty } from "lodash-es";
import { observer } from "mobx-react";
import { MembersOutline, UserAltOutline, WorkItemsOutline } from "@makeplane/propel/icons";
// plane types
import { EEstimateSystem } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Avatar } from "@makeplane/propel/components/avatar";
import { AvatarGroup } from "@makeplane/propel/components/avatar-group";
import { TextArea } from "@makeplane/propel/components/text-area";
import type { ICycle } from "@plane/types";
// helpers
import { getFileURL } from "@plane/utils";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useMember } from "@/hooks/store/use-member";
// plane web constants

type Props = {
  projectId: string;
  cycleDetails: ICycle;
};

export const CycleSidebarDetails = observer(function CycleSidebarDetails(props: Props) {
  const { projectId, cycleDetails } = props;
  // hooks
  const { getUserDetails } = useMember();
  const { areEstimateEnabledByProjectId, currentActiveEstimateId, estimateById } = useProjectEstimates();
  const { t } = useTranslation();

  const areEstimateEnabled = projectId && areEstimateEnabledByProjectId(projectId.toString());
  const cycleStatus = cycleDetails?.status?.toLocaleLowerCase();
  const isCompleted = cycleStatus === "completed";

  const counts =
    isCompleted && !isEmpty(cycleDetails.progress_snapshot) ? cycleDetails.progress_snapshot : cycleDetails;
  const cancelledIssues = counts?.cancelled_issues ?? 0;
  const issueCount = `${counts?.completed_issues ?? 0}/${Math.max(0, (counts?.total_issues ?? 0) - cancelledIssues)}`;
  const estimateType = areEstimateEnabled && currentActiveEstimateId && estimateById(currentActiveEstimateId);
  const cycleOwnerDetails = getUserDetails(cycleDetails.owned_by_id);
  const creatorDetails = cycleDetails.created_by ? getUserDetails(cycleDetails.created_by) : undefined;

  const isEstimatePointValid = isEmpty(cycleDetails.progress_snapshot)
    ? Boolean(estimateType && estimateType.type === EEstimateSystem.POINTS)
    : !isEmpty(cycleDetails.progress_snapshot?.estimate_distribution);
  const issueEstimatePointCount = `${counts?.completed_estimate_points ?? 0}/${counts?.total_estimate_points ?? 0}`;
  return (
    <div className="flex w-full flex-col gap-5">
      {cycleDetails?.description && (
        <TextArea size="lg" surface="inline" autoResize value={cycleDetails.description} disabled />
      )}

      <div className="flex flex-col gap-5 border-t border-subtle pt-6 pb-6">
        <h5 className="text-13 font-medium text-primary">{t("common.properties")}</h5>
        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <UserAltOutline className="h-4 w-4" />
            <span className="text-14">{t("lead")}</span>
          </div>
          <div className="flex w-3/5 items-center rounded-xs">
            <div className="flex items-center gap-2.5">
              <Avatar
                alt={cycleOwnerDetails?.display_name}
                fallback={cycleOwnerDetails?.display_name?.[0]?.toUpperCase()}
                src={getFileURL(cycleOwnerDetails?.avatar_url ?? "")}
                size="xs"
              />
              <span className="text-13 text-secondary">{cycleOwnerDetails?.display_name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <MembersOutline className="h-4 w-4" />
            <span className="text-14">{t("members")}</span>
          </div>
          <div className="flex w-3/5 items-center rounded-xs">
            <div className="flex items-center gap-2.5">
              {cycleDetails?.assignee_ids && cycleDetails.assignee_ids.length > 0 ? (
                <>
                  <AvatarGroup size="xs" max={2}>
                    {cycleDetails.assignee_ids.map((member) => {
                      const memberDetails = getUserDetails(member);
                      return (
                        <Avatar
                          key={member}
                          alt={memberDetails?.display_name ?? ""}
                          src={getFileURL(memberDetails?.avatar_url ?? "")}
                        />
                      );
                    })}
                  </AvatarGroup>
                </>
              ) : (
                <span className="px-1.5 text-13 text-tertiary">{t("none")}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <WorkItemsOutline className="h-4 w-4" />
            <span className="text-14">{t("work_items")}</span>
          </div>
          <div className="flex w-3/5 items-center">
            <span className="text-13 text-secondary">
              {issueCount}
              {cancelledIssues > 0 && (
                <span className="ml-1">{t("project_cycles.cancelled_count", { count: cancelledIssues })}</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center gap-2 text-tertiary">
            <UserAltOutline className="h-4 w-4" />
            <span className="text-14">{t("common.created_by")}</span>
          </div>
          <div className="flex w-3/5 items-center gap-2.5 text-13 text-secondary">
            {creatorDetails ? (
              <>
                <Avatar
                  alt={creatorDetails.display_name}
                  fallback={creatorDetails.display_name?.[0]?.toUpperCase()}
                  src={getFileURL(creatorDetails.avatar_url ?? "")}
                  size="xs"
                />
                <span>{creatorDetails.display_name}</span>
              </>
            ) : (
              <span>{t("none")}</span>
            )}
          </div>
        </div>

        {/**
         * NOTE: Render this section when estimate points of he projects is enabled and the estimate system is points
         */}
        {isEstimatePointValid && !isCompleted && (
          <div className="flex items-center justify-start gap-1">
            <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
              <WorkItemsOutline className="h-4 w-4" />
              <span className="text-14">{t("points")}</span>
            </div>
            <div className="flex w-3/5 items-center">
              <span className="px-1.5 text-13 text-tertiary">{issueEstimatePointCount}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
