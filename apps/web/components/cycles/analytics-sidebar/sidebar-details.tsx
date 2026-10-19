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
import type { ICycle, IUserLite, TProgressSnapshot } from "@plane/types";
// helpers
import { getFileURL } from "@plane/utils";
// store types
import type { IEstimate } from "@/store/estimates/estimate";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useMember } from "@/hooks/store/use-member";
// plane web constants

type Props = {
  projectId: string;
  cycleDetails: ICycle;
};

type TMemberDetailsGetter = (userId: string) => IUserLite | undefined;

type TCycleSidebarCounts = {
  isCompleted: boolean;
  cancelledIssues: number;
  issueCount: string;
  issueEstimatePointCount: string;
};

const getCycleSidebarCounts = (cycleDetails: ICycle): TCycleSidebarCounts => {
  const isCompleted = cycleDetails.status?.toLocaleLowerCase() === "completed";
  const counts =
    isCompleted && !isEmpty(cycleDetails.progress_snapshot) ? cycleDetails.progress_snapshot : cycleDetails;
  const cancelledIssues = counts?.cancelled_issues ?? 0;
  const issueCount = `${counts?.completed_issues ?? 0}/${Math.max(0, (counts?.total_issues ?? 0) - cancelledIssues)}`;
  const issueEstimatePointCount = `${counts?.completed_estimate_points ?? 0}/${counts?.total_estimate_points ?? 0}`;

  return { isCompleted, cancelledIssues, issueCount, issueEstimatePointCount };
};

const getActiveEstimate = (
  areEstimateEnabled: boolean,
  currentActiveEstimateId: string | undefined,
  estimateById: (estimateId: string) => IEstimate | undefined
) => (areEstimateEnabled && currentActiveEstimateId ? estimateById(currentActiveEstimateId) : undefined);

const getIsEstimatePointValid = (
  progressSnapshot: TProgressSnapshot | undefined,
  estimateType: IEstimate | undefined
) =>
  isEmpty(progressSnapshot)
    ? estimateType?.type === EEstimateSystem.POINTS
    : !isEmpty(progressSnapshot?.estimate_distribution);

function CycleSidebarDescription({ description }: { description?: string }) {
  if (!description) return null;

  return <TextArea size="lg" surface="inline" autoResize value={description} disabled />;
}

const CycleLeadProperty = observer(function CycleLeadProperty({ owner }: { owner: IUserLite | undefined }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-start gap-1">
      <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
        <UserAltOutline className="h-4 w-4" />
        <span className="text-14">{t("lead")}</span>
      </div>
      <div className="flex w-3/5 items-center rounded-xs">
        <div className="flex items-center gap-2.5">
          <Avatar
            alt={owner?.display_name}
            fallback={owner?.display_name?.[0]?.toUpperCase()}
            src={getFileURL(owner?.avatar_url ?? "")}
            size="xs"
          />
          <span className="text-13 text-secondary">{owner?.display_name}</span>
        </div>
      </div>
    </div>
  );
});

const CycleMembersProperty = observer(function CycleMembersProperty({
  assigneeIds,
  getUserDetails,
}: {
  assigneeIds: string[] | undefined;
  getUserDetails: TMemberDetailsGetter;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-start gap-1">
      <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
        <MembersOutline className="h-4 w-4" />
        <span className="text-14">{t("members")}</span>
      </div>
      <div className="flex w-3/5 items-center rounded-xs">
        <div className="flex items-center gap-2.5">
          {assigneeIds && assigneeIds.length > 0 ? (
            <>
              <AvatarGroup size="xs" max={2}>
                {assigneeIds.map((member) => {
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
  );
});

function CycleWorkItemsProperty({ issueCount, cancelledIssues }: { issueCount: string; cancelledIssues: number }) {
  const { t } = useTranslation();

  return (
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
  );
}

const CycleCreatedByProperty = observer(function CycleCreatedByProperty({
  creator,
}: {
  creator: IUserLite | undefined;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-start gap-1">
      <div className="flex w-2/5 items-center gap-2 text-tertiary">
        <UserAltOutline className="h-4 w-4" />
        <span className="text-14">{t("common.created_by")}</span>
      </div>
      <div className="flex w-3/5 items-center gap-2.5 text-13 text-secondary">
        {creator ? (
          <>
            <Avatar
              alt={creator.display_name}
              fallback={creator.display_name?.[0]?.toUpperCase()}
              src={getFileURL(creator.avatar_url ?? "")}
              size="xs"
            />
            <span>{creator.display_name}</span>
          </>
        ) : (
          <span>{t("none")}</span>
        )}
      </div>
    </div>
  );
});

function CyclePointsProperty({
  isEstimatePointValid,
  isCompleted,
  issueEstimatePointCount,
}: {
  isEstimatePointValid: boolean;
  isCompleted: boolean;
  issueEstimatePointCount: string;
}) {
  const { t } = useTranslation();

  if (!isEstimatePointValid || isCompleted) return null;

  return (
    <div className="flex items-center justify-start gap-1">
      <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
        <WorkItemsOutline className="h-4 w-4" />
        <span className="text-14">{t("points")}</span>
      </div>
      <div className="flex w-3/5 items-center">
        <span className="px-1.5 text-13 text-tertiary">{issueEstimatePointCount}</span>
      </div>
    </div>
  );
}

export const CycleSidebarDetails = observer(function CycleSidebarDetails(props: Props) {
  const { projectId, cycleDetails } = props;
  // hooks
  const { getUserDetails } = useMember();
  const { areEstimateEnabledByProjectId, currentActiveEstimateId, estimateById } = useProjectEstimates();
  const { t } = useTranslation();

  const areEstimateEnabled = Boolean(projectId && areEstimateEnabledByProjectId(projectId.toString()));
  const { isCompleted, cancelledIssues, issueCount, issueEstimatePointCount } = getCycleSidebarCounts(cycleDetails);
  const estimateType = getActiveEstimate(areEstimateEnabled, currentActiveEstimateId, estimateById);
  const cycleOwnerDetails = getUserDetails(cycleDetails.owned_by_id);
  const creatorDetails = cycleDetails.created_by ? getUserDetails(cycleDetails.created_by) : undefined;
  const isEstimatePointValid = getIsEstimatePointValid(cycleDetails.progress_snapshot, estimateType);

  return (
    <div className="flex w-full flex-col gap-5">
      <CycleSidebarDescription description={cycleDetails?.description} />

      <div className="flex flex-col gap-5 border-t border-subtle pt-6 pb-6">
        <h5 className="text-13 font-medium text-primary">{t("common.properties")}</h5>
        <CycleLeadProperty owner={cycleOwnerDetails} />
        <CycleMembersProperty assigneeIds={cycleDetails?.assignee_ids} getUserDetails={getUserDetails} />
        <CycleWorkItemsProperty issueCount={issueCount} cancelledIssues={cancelledIssues} />
        <CycleCreatedByProperty creator={creatorDetails} />

        {/**
         * NOTE: Render this section when estimate points of he projects is enabled and the estimate system is points
         */}
        <CyclePointsProperty
          isEstimatePointValid={isEstimatePointValid}
          isCompleted={isCompleted}
          issueEstimatePointCount={issueEstimatePointCount}
        />
      </div>
    </div>
  );
});
