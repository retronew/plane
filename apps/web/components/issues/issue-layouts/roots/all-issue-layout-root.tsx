/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { EIssueFilterType, ISSUE_DISPLAY_FILTERS_BY_PAGE } from "@plane/constants";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { EIssueLayoutTypes } from "@plane/types";
import { EIssuesStoreType, STATIC_VIEW_TYPES } from "@plane/types";
// assets
// components
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { WorkspaceActiveLayout } from "@/components/views/helper";
import { WorkspaceLevelWorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/workspace-level";
import { WorkItemFiltersRow } from "@/components/work-item-filters/filters-row";
// hooks
import { useGlobalView } from "@/hooks/store/use-global-view";
import { useIssues } from "@/hooks/store/use-issues";
import { useAppRouter } from "@/hooks/use-app-router";
import { IssuesStoreContext } from "@/hooks/use-issue-layout-store";
import { useWorkspaceIssueProperties } from "@/hooks/use-workspace-issue-properties";
import { translate } from "@plane/i18n";

const toOptionalString = (value: string | string[] | undefined) => (value ? value.toString() : undefined);

const getGlobalViewsKey = (workspaceSlug?: string) =>
  workspaceSlug ? `WORKSPACE_GLOBAL_VIEWS_${workspaceSlug}` : null;

const getGlobalViewIssuesKey = (workspaceSlug?: string, globalViewId?: string) =>
  workspaceSlug && globalViewId ? `WORKSPACE_GLOBAL_VIEW_ISSUES_${workspaceSlug}_${globalViewId}` : null;

const shouldShowMissingView = (
  isLoading: boolean,
  globalViewsLoading: boolean,
  issuesLoading: boolean,
  viewDetails: unknown,
  isDefaultView: boolean
) => !isLoading && !globalViewsLoading && !issuesLoading && !viewDetails && !isDefaultView;

type Props = {
  isDefaultView: boolean;
  isLoading?: boolean;
  toggleLoading: (value: boolean) => void;
};

export const AllIssueLayoutRoot = observer(function AllIssueLayoutRoot(props: Props) {
  const { isDefaultView, isLoading = false, toggleLoading } = props;
  // router
  const router = useAppRouter();
  const { workspaceSlug: routerWorkspaceSlug, globalViewId: routerGlobalViewId } = useParams();
  const workspaceSlug = toOptionalString(routerWorkspaceSlug);
  const globalViewId = toOptionalString(routerGlobalViewId);
  // search params
  const searchParams = useSearchParams();
  // store hooks
  const {
    issuesFilter: { filters, fetchFilters, updateFilterExpression, updateFilters, requestedLayouts },
    issues: { fetchNextIssues },
  } = useIssues(EIssuesStoreType.GLOBAL);
  const { fetchAllGlobalViews, getViewDetailsById } = useGlobalView();
  // Derived values
  const viewDetails = globalViewId ? getViewDetailsById(globalViewId) : undefined;
  const workItemFilters = globalViewId ? filters?.[globalViewId] : undefined;
  const activeLayout =
    (globalViewId ? requestedLayouts[globalViewId] : undefined) ?? workItemFilters?.displayFilters?.layout;
  const handleLayoutCommit = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (workspaceSlug && globalViewId && layout !== workItemFilters?.displayFilters?.layout) {
        void updateFilters(workspaceSlug, undefined, EIssueFilterType.DISPLAY_FILTERS, { layout }, globalViewId);
      }
    },
    [workspaceSlug, globalViewId, updateFilters, workItemFilters?.displayFilters?.layout]
  );
  // Determine initial work item filters based on view type and availability
  const initialWorkItemFilters = useMemo(() => {
    if (!globalViewId) return undefined;

    const isStaticView = STATIC_VIEW_TYPES.includes(globalViewId);
    const hasViewDetails = Boolean(viewDetails);

    if (!isStaticView && !hasViewDetails) return undefined;

    return {
      displayFilters: workItemFilters?.displayFilters,
      displayProperties: workItemFilters?.displayProperties,
      kanbanFilters: workItemFilters?.kanbanFilters,
      richFilters: viewDetails?.rich_filters ?? {},
    };
  }, [globalViewId, viewDetails, workItemFilters]);

  // Custom hooks
  useWorkspaceIssueProperties(workspaceSlug);

  // Route filters
  const routeFilters: { [key: string]: string } = {};
  searchParams.forEach((value: string, key: string) => {
    routeFilters[key] = value;
  });

  // Fetch next pages callback
  const fetchNextPages = useCallback(() => {
    if (workspaceSlug && globalViewId) fetchNextIssues(workspaceSlug, globalViewId);
  }, [fetchNextIssues, workspaceSlug, globalViewId]);

  // Fetch global views
  const { isLoading: globalViewsLoading } = useSWR(
    getGlobalViewsKey(workspaceSlug),
    async () => {
      if (workspaceSlug) {
        await fetchAllGlobalViews(workspaceSlug);
      }
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  // Fetch issues
  const { isLoading: issuesLoading } = useSWR(
    getGlobalViewIssuesKey(workspaceSlug, globalViewId),
    async () => {
      if (workspaceSlug && globalViewId) {
        toggleLoading(true);
        try {
          await fetchFilters(workspaceSlug, globalViewId);
        } finally {
          toggleLoading(false);
        }
      }
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  // Empty state
  if (shouldShowMissingView(isLoading, globalViewsLoading, issuesLoading, viewDetails, isDefaultView)) {
    return (
      <EmptyStateDetailed
        title={translate("web.view_does_not_exist")}
        description={translate("web.the_view_you_are_looking_for_does_not_exist_or_you_don_t_hav")}
        assetKey="view"
        actions={[
          {
            label: translate("web.go_to_all_work_items"),
            onClick: () => router.push(`/${workspaceSlug}/workspace-views/all-issues`),
            variant: "primary",
          },
        ]}
      />
    );
  }

  if (!workspaceSlug || !globalViewId) return null;
  return (
    <IssuesStoreContext.Provider value={EIssuesStoreType.GLOBAL}>
      <WorkspaceLevelWorkItemFiltersHOC
        enableSaveView
        saveViewOptions={{
          label: translate("web.save_as"),
        }}
        enableUpdateView
        entityId={globalViewId}
        entityType={EIssuesStoreType.GLOBAL}
        filtersToShowByLayout={ISSUE_DISPLAY_FILTERS_BY_PAGE.workspace_issues.filters}
        initialWorkItemFilters={initialWorkItemFilters}
        updateFilters={updateFilterExpression.bind(updateFilterExpression, workspaceSlug, globalViewId)}
        workspaceSlug={workspaceSlug}
      >
        {({ filter: globalWorkItemsFilter }) => (
          <div className="h-full overflow-hidden bg-surface-1">
            <div className="flex h-full w-full flex-col border-b border-strong">
              {globalWorkItemsFilter && <WorkItemFiltersRow filter={globalWorkItemsFilter} />}
              <WorkspaceActiveLayout
                activeLayout={activeLayout ?? EIssueLayoutTypes.SPREADSHEET}
                onLayoutCommit={handleLayoutCommit}
                isDefaultView={isDefaultView}
                isLoading={isLoading}
                toggleLoading={toggleLoading}
                workspaceSlug={workspaceSlug}
                globalViewId={globalViewId}
                routeFilters={routeFilters}
                fetchNextPages={fetchNextPages}
                globalViewsLoading={globalViewsLoading}
                issuesLoading={issuesLoading}
              />
            </div>
            {/* peek overview */}
            <IssuePeekOverview />
          </div>
        )}
      </WorkspaceLevelWorkItemFiltersHOC>
    </IssuesStoreContext.Provider>
  );
});
