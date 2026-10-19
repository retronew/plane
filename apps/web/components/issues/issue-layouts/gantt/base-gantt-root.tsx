/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import React, { useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { ALL_ISSUES, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { EIssuesStoreType, IBlockUpdateData, TIssue } from "@plane/types";
import { EIssueLayoutTypes, GANTT_TIMELINE_TYPE } from "@plane/types";
import { renderFormattedPayloadDate } from "@plane/utils";
// components
import { TimeLineTypeContext } from "@/components/gantt-chart/contexts";
import { GanttChartRoot } from "@/components/gantt-chart/root";
import { IssueGanttSidebar } from "@/components/gantt-chart/sidebar/issues/sidebar";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useUserPermissions } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";
import { useBulkOperationStatus } from "@/hooks/use-bulk-operation-status";
// local imports
import { IssueLayoutHOC } from "../issue-layout-HOC";
import { GanttQuickAddIssueButton, QuickAddIssueRoot } from "../quick-add";
import { IssueGanttBlock } from "./blocks";
import { updateGanttIssueDates } from "./update-block-dates";

interface IBaseGanttRoot {
  canEditPropertiesBasedOnProject?: (projectId: string) => boolean;
  viewId?: string | undefined;
  isCompletedCycle?: boolean;
  isEpic?: boolean;
}

export type GanttStoreType =
  | EIssuesStoreType.GLOBAL
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.EPIC;

export const BaseGanttRoot = observer(function BaseGanttRoot(props: IBaseGanttRoot) {
  const { viewId, isCompletedCycle = false, isEpic = false, canEditPropertiesBasedOnProject } = props;
  const { t } = useTranslation();
  // router
  const { workspaceSlug, projectId } = useParams();

  const storeType = useIssueStoreType() as GanttStoreType;
  const { issues, issuesFilter, issueMap } = useIssues(storeType);
  const { fetchIssues, fetchNextIssues, updateIssue, quickAddIssue } = useIssuesActions(storeType);
  const { initGantt } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  // store hooks
  const { allowPermissions } = useUserPermissions();

  const appliedDisplayFilters = issuesFilter.issueFilters?.displayFilters;
  // plane web hooks
  const isBulkOperationsEnabled = useBulkOperationStatus();
  // derived values
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);

  useEffect(() => {
    if (issuesFilter.issueFilters?.displayFilters?.layout !== EIssueLayoutTypes.GANTT) return;
    fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, viewId);
  }, [fetchIssues, issuesFilter, appliedDisplayFilters?.layout, storeType, viewId]);

  useEffect(() => {
    initGantt();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- initialize the gantt store once on mount
  }, []);

  const issuesIds = (issues.groupedIssueIds?.[ALL_ISSUES] as string[]) ?? [];
  const nextPageResults = issues.getPaginationData(undefined, undefined)?.nextPageResults;

  const { enableIssueCreation } = issues?.viewFlags || {};

  const loadMoreIssues = useCallback(() => {
    fetchNextIssues();
  }, [fetchNextIssues]);

  const canEditBlock = useCallback(
    (blockId: string) => {
      const issue = issueMap[blockId];
      return (
        !isCompletedCycle &&
        !!issue?.project_id &&
        (canEditPropertiesBasedOnProject
          ? canEditPropertiesBasedOnProject(issue.project_id)
          : allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT))
      );
    },
    [issueMap, isCompletedCycle, canEditPropertiesBasedOnProject, allowPermissions]
  );

  const updateIssueBlockStructure = async (issue: TIssue, data: IBlockUpdateData) => {
    if (!workspaceSlug || !canEditBlock(issue.id)) return;

    const payload: any = { ...data };
    if (data.sort_order) payload.sort_order = data.sort_order.newSortOrder;

    if (updateIssue) await updateIssue(issue.project_id, issue.id, payload);
  };

  const isAllowed = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);
  const updateBlockDates = useCallback(
    (
      updates: {
        id: string;
        start_date?: string;
        target_date?: string;
      }[]
    ) => {
      return updateGanttIssueDates(updates, issueMap, canEditBlock, (issueProjectId, projectUpdates) =>
        issues.updateIssueDates(workspaceSlug.toString(), projectUpdates, issueProjectId)
      ).catch(() => {
        setToast({
          type: "error",
          title: t("toast.error"),
          message: t("web.error_while_updating_work_item_dates_please_try_again_later"),
        });
      });
    },
    [issues, issueMap, workspaceSlug, t, canEditBlock]
  );

  const quickAdd =
    projectId && enableIssueCreation && isAllowed && !isCompletedCycle ? (
      <QuickAddIssueRoot
        layout={EIssueLayoutTypes.GANTT}
        QuickAddButton={GanttQuickAddIssueButton}
        containerClassName="sticky bottom-0 z-[1]"
        prePopulatedData={{
          // react-doctor-disable-next-line react-doctor/rendering-hydration-mismatch-time -- web is a ssr:false SPA, so there is no server render to hydrate and the client-side time can never mismatch.
          start_date: renderFormattedPayloadDate(new Date()),
          target_date: renderFormattedPayloadDate(targetDate),
        }}
        quickAddCallback={quickAddIssue}
        isEpic={isEpic}
      />
    ) : undefined;

  const renderIssueBlock = useCallback(
    (data: TIssue) => <IssueGanttBlock issueId={data.id} isEpic={isEpic} />,
    [isEpic]
  );
  const renderSidebar = useCallback(
    (sidebarProps: ComponentProps<typeof IssueGanttSidebar>) => (
      <IssueGanttSidebar {...sidebarProps} showAllBlocks isEpic={isEpic} />
    ),
    [isEpic]
  );

  return (
    <IssueLayoutHOC layout={EIssueLayoutTypes.GANTT}>
      <TimeLineTypeContext.Provider value={GANTT_TIMELINE_TYPE.ISSUE}>
        <div className="h-full w-full">
          <GanttChartRoot
            border={false}
            title={isEpic ? t("epic.label", { count: 2 }) : t("issue.label", { count: 2 })}
            loaderTitle={isEpic ? t("epic.label", { count: 2 }) : t("issue.label", { count: 2 })}
            blockIds={issuesIds}
            blockUpdateHandler={updateIssueBlockStructure}
            blockToRender={renderIssueBlock}
            sidebarToRender={renderSidebar}
            enableBlockLeftResize={canEditBlock}
            enableBlockRightResize={canEditBlock}
            enableBlockMove={canEditBlock}
            enableReorder={appliedDisplayFilters?.order_by === "sort_order" && isAllowed}
            enableAddBlock={isAllowed}
            enableSelection={isBulkOperationsEnabled ? canEditBlock : false}
            quickAdd={quickAdd}
            loadMoreBlocks={loadMoreIssues}
            canLoadMoreBlocks={nextPageResults}
            updateBlockDates={updateBlockDates}
            showAllBlocks
            enableDependency={!!projectId}
            isEpic={isEpic}
          />
        </div>
      </TimeLineTypeContext.Provider>
    </IssueLayoutHOC>
  );
});
