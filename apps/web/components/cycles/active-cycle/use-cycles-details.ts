/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
// plane imports
import type { TWorkItemFilterCondition } from "@plane/shared-state";
import { EIssuesStoreType } from "@plane/types";
// constants
import { CYCLE_ISSUES_WITH_PARAMS } from "@plane/constants";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssues } from "@/hooks/store/use-issues";
import { useWorkItemFilters } from "@/hooks/store/work-item-filters/use-work-item-filters";

interface IActiveCycleDetails {
  workspaceSlug: string;
  projectId: string;
  cycleId: string | null | undefined;
}

function getCycleFilterTarget(workspaceSlug: string, projectId: string, cycleId: string | null | undefined) {
  if (!workspaceSlug || !projectId || !cycleId) return null;
  return { workspaceSlug, projectId, cycleId };
}

function createCycleRequest(enabled: boolean, key: string, fetcher: () => unknown) {
  if (!enabled) return { key: null, fetcher: null };
  return { key, fetcher };
}

const useCyclesDetails = (props: IActiveCycleDetails) => {
  // props
  const { workspaceSlug, projectId, cycleId } = props;
  // router
  const router = useRouter();
  // store hooks
  const {
    issuesFilter: { updateFilterExpression },
    issues: { getActiveCycleById: getActiveCycleByIdFromIssue, fetchActiveCycleIssues },
  } = useIssues(EIssuesStoreType.CYCLE);
  const { updateFilterExpressionFromConditions } = useWorkItemFilters();

  const { fetchActiveCycleProgress, getCycleById, fetchActiveCycleAnalytics } = useCycle();
  // derived values
  const cycle = cycleId ? getCycleById(cycleId) : null;
  const activeCycleId = cycle?.id ?? "";
  const canFetch = Boolean(workspaceSlug && projectId && activeCycleId);

  // fetch cycle details
  const progressRequest = createCycleRequest(
    canFetch,
    `PROJECT_ACTIVE_CYCLE_${projectId}_PROGRESS_${activeCycleId}`,
    () => fetchActiveCycleProgress(workspaceSlug, projectId, activeCycleId)
  );
  useSWR(progressRequest.key, progressRequest.fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });

  const distributionRequest = createCycleRequest(
    canFetch && !cycle?.distribution,
    `PROJECT_ACTIVE_CYCLE_${projectId}_DURATION_${activeCycleId}`,
    () => fetchActiveCycleAnalytics(workspaceSlug, projectId, activeCycleId, "issues")
  );
  useSWR(distributionRequest.key, distributionRequest.fetcher);

  const estimateDistributionRequest = createCycleRequest(
    canFetch && !cycle?.estimate_distribution,
    `PROJECT_ACTIVE_CYCLE_${projectId}_ESTIMATE_DURATION_${activeCycleId}`,
    () => fetchActiveCycleAnalytics(workspaceSlug, projectId, activeCycleId, "points")
  );
  useSWR(estimateDistributionRequest.key, estimateDistributionRequest.fetcher);

  const issuesRequest = createCycleRequest(
    canFetch,
    CYCLE_ISSUES_WITH_PARAMS(activeCycleId, { priority: "urgent,high" }),
    () => fetchActiveCycleIssues(workspaceSlug, projectId, 30, activeCycleId)
  );
  useSWR(issuesRequest.key, issuesRequest.fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });

  const cycleIssueDetails = cycle?.id ? getActiveCycleByIdFromIssue(cycle.id) : { nextPageResults: false };

  const handleFiltersUpdate = useCallback(
    async (conditions: TWorkItemFilterCondition[]) => {
      const target = getCycleFilterTarget(workspaceSlug, projectId, cycleId);
      if (!target) return;

      await updateFilterExpressionFromConditions(
        EIssuesStoreType.CYCLE,
        target.cycleId,
        conditions,
        updateFilterExpression.bind(updateFilterExpression, target.workspaceSlug, target.projectId, target.cycleId)
      );

      router.push(`/${target.workspaceSlug}/projects/${target.projectId}/cycles/${target.cycleId}`);
    },
    [workspaceSlug, projectId, cycleId, updateFilterExpressionFromConditions, updateFilterExpression, router]
  );
  return {
    cycle,
    cycleId,
    router,
    handleFiltersUpdate,
    cycleIssueDetails,
  };
};
export default useCyclesDetails;
