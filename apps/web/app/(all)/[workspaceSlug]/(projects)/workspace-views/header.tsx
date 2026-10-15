/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EIssueFilterType, ISSUE_DISPLAY_FILTERS_BY_PAGE, DEFAULT_GLOBAL_VIEWS_LIST } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Badge } from "@makeplane/propel/components/badge";
import { Button } from "@makeplane/propel/components/button";
import { ViewsOutline } from "@makeplane/propel/icons";
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
import { EIssuesStoreType, EIssueLayoutTypes } from "@plane/types";
import type { BreadcrumbNavigationItem } from "@plane/blocks/breadcrumb";
import { Breadcrumbs, BreadcrumbNavigationSelect } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import {
  DisplayFiltersSelection,
  FiltersDropdown,
  LayoutSelection,
  MobileLayoutSelection,
} from "@/components/issues/issue-layouts/filters";
import { WorkItemFiltersToggle } from "@/components/work-item-filters/filters-toggle";
import { DefaultWorkspaceViewQuickActions } from "@/components/workspace/views/default-view-quick-action";
import { CreateUpdateWorkspaceViewModal } from "@/components/workspace/views/modal";
import { WorkspaceViewQuickActions } from "@/components/workspace/views/quick-action";
// hooks
import { useGlobalView } from "@/hooks/store/use-global-view";
import { useIssues } from "@/hooks/store/use-issues";
import { useAppRouter } from "@/hooks/use-app-router";

export const GlobalIssuesHeader = observer(function GlobalIssuesHeader() {
  // states
  const [createViewModal, setCreateViewModal] = useState(false);
  // router
  const router = useAppRouter();
  const { workspaceSlug, globalViewId: routerGlobalViewId } = useParams();
  const globalViewId = routerGlobalViewId ? routerGlobalViewId.toString() : undefined;
  // store hooks
  const {
    issuesFilter: { filters, updateFilters, requestedLayouts, requestLayout },
    issues: { getGroupIssueCount, getIssueLoader },
  } = useIssues(EIssuesStoreType.GLOBAL);
  const { getViewDetailsById, currentWorkspaceViews } = useGlobalView();
  const { t } = useTranslation();

  const issueFilters = globalViewId ? filters[globalViewId.toString()] : undefined;

  const activeLayout =
    (globalViewId ? requestedLayouts[globalViewId] : undefined) ??
    issueFilters?.displayFilters?.layout ??
    EIssueLayoutTypes.SPREADSHEET;
  const issueCount = getGroupIssueCount(undefined, undefined, false);
  const viewDetails = globalViewId ? getViewDetailsById(globalViewId) : undefined;

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !globalViewId) return;
      updateFilters(
        workspaceSlug.toString(),
        undefined,
        EIssueFilterType.DISPLAY_FILTERS,
        updatedDisplayFilter,
        globalViewId
      );
    },
    [workspaceSlug, updateFilters, globalViewId]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !globalViewId) return;
      updateFilters(workspaceSlug.toString(), undefined, EIssueFilterType.DISPLAY_PROPERTIES, property, globalViewId);
    },
    [workspaceSlug, updateFilters, globalViewId]
  );

  const isLocked = viewDetails?.is_locked;

  const isDefaultView = DEFAULT_GLOBAL_VIEWS_LIST.find((view) => view.key === globalViewId);

  const defaultViewDetails = DEFAULT_GLOBAL_VIEWS_LIST.find((view) => view.key === globalViewId);

  const defaultOptions = DEFAULT_GLOBAL_VIEWS_LIST.map<BreadcrumbNavigationItem>((view) => ({
    key: view.key,
    label: t(view.i18n_label),
    icon: <ViewsOutline className="size-4 shrink-0" />,
  }));

  const workspaceOptions = (currentWorkspaceViews || []).map<BreadcrumbNavigationItem | undefined>((view) => {
    const _view = getViewDetailsById(view);
    if (!_view) return;
    return {
      key: _view.id,
      label: _view.name,
      icon: <ViewsOutline className="size-4 shrink-0" />,
    };
  });

  const switcherOptions = [...defaultOptions, ...workspaceOptions].filter(
    (option): option is BreadcrumbNavigationItem => option !== undefined
  );
  const currentLayoutFilters = useMemo(() => {
    const layout = activeLayout ?? EIssueLayoutTypes.SPREADSHEET;
    return ISSUE_DISPLAY_FILTERS_BY_PAGE.workspace_issues.layoutOptions[layout];
  }, [activeLayout]);

  return (
    <>
      <CreateUpdateWorkspaceViewModal isOpen={createViewModal} onClose={() => setCreateViewModal(false)} />
      <Header>
        <Header.LeftItem className="max-w-none min-w-0 flex-1 flex-nowrap">
          <Breadcrumbs
            collapseBreakpoint={1024}
            className="[&_li:last-child]:min-w-0 [&_li:not(:last-child)]:shrink-0 [&>nav]:max-w-full [&>nav]:min-w-0"
          >
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink label={t("views")} icon={<ViewsOutline className="h-4 w-4 text-tertiary" />} />
              }
            />
            <Breadcrumbs.Item
              component={
                <div className="flex min-w-0 items-center gap-1 [&>div]:w-auto">
                  <BreadcrumbNavigationSelect
                    selectedItemKey={globalViewId || ""}
                    navigationItems={switcherOptions}
                    onChange={(value: string) => {
                      router.push(`/${workspaceSlug}/workspace-views/${value}`);
                    }}
                    label={viewDetails?.name ?? t(defaultViewDetails?.i18n_label ?? "")}
                    icon={<ViewsOutline className="size-4 shrink-0 text-tertiary" />}
                    placeholder={t("views")}
                    searchPlaceholder={t("common.search.label")}
                    emptyMessage={t("common.search.no_matches_found")}
                    triggerClassName="min-w-0 max-w-full gap-2 [&>.line-clamp-1]:min-w-0 [&>.line-clamp-1]:max-w-none"
                    fitOptionLabels
                    isLast
                  />
                  {issueCount !== undefined && getIssueLoader() !== "init-loader" && (
                    <Badge size="xs" variant="brand" label={String(issueCount)} />
                  )}
                </div>
              }
              isLast
            />
          </Breadcrumbs>
        </Header.LeftItem>

        <Header.RightItem className="shrink-0 items-center">
          <div className="hidden md:block">
            <LayoutSelection
              layouts={[
                EIssueLayoutTypes.LIST,
                EIssueLayoutTypes.KANBAN,
                EIssueLayoutTypes.CALENDAR,
                EIssueLayoutTypes.SPREADSHEET,
                EIssueLayoutTypes.GANTT,
              ]}
              selectedLayout={activeLayout}
              onChange={(layout) => {
                if (globalViewId) requestLayout(globalViewId, layout);
              }}
            />
          </div>
          <div className="flex md:hidden">
            <MobileLayoutSelection
              layouts={[
                EIssueLayoutTypes.LIST,
                EIssueLayoutTypes.KANBAN,
                EIssueLayoutTypes.CALENDAR,
                EIssueLayoutTypes.SPREADSHEET,
                EIssueLayoutTypes.GANTT,
              ]}
              activeLayout={activeLayout}
              onChange={(layout) => {
                if (globalViewId) requestLayout(globalViewId, layout);
              }}
            />
          </div>
          {globalViewId && <WorkItemFiltersToggle entityType={EIssuesStoreType.GLOBAL} entityId={globalViewId} />}
          {!isLocked && (
            <FiltersDropdown displayMenu title={t("common.display")} placement="bottom-end">
              <DisplayFiltersSelection
                layoutDisplayFiltersOptions={currentLayoutFilters}
                displayFilters={issueFilters?.displayFilters ?? {}}
                handleDisplayFiltersUpdate={handleDisplayFilters}
                displayProperties={issueFilters?.displayProperties ?? {}}
                handleDisplayPropertiesUpdate={handleDisplayProperties}
              />
            </FiltersDropdown>
          )}
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={t("workspace_views.add_view")}
            onClick={() => setCreateViewModal(true)}
          />
          <div className="hidden md:block">
            {viewDetails && <WorkspaceViewQuickActions workspaceSlug={workspaceSlug?.toString()} view={viewDetails} />}
            {isDefaultView && defaultViewDetails && (
              <DefaultWorkspaceViewQuickActions workspaceSlug={workspaceSlug?.toString()} view={defaultViewDetails} />
            )}
          </div>
        </Header.RightItem>
      </Header>
    </>
  );
});
