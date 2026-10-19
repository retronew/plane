/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import { isEmpty } from "lodash-es";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
// plane imports
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDownOutline, ChevronUpOutline } from "@makeplane/propel/icons";
import { useTranslation, translate } from "@plane/i18n";
import type { TWorkItemFilterCondition } from "@plane/shared-state";
import type {
  ICycle,
  TCycleDistribution,
  TCycleEstimateDistribution,
  TCycleEstimateType,
  TCyclePlotType,
  TProgressSnapshot,
} from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { getDate } from "@plane/utils";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
// plane web components
import { useWorkItemFilters } from "@/hooks/store/work-item-filters/use-work-item-filters";
// local imports
import type { TSelectedFilterProgressStats } from "@/components/core/sidebar/progress-stats/shared";
import { CycleProgressStats } from "./progress-stats";
import { SidebarChart } from "./sidebar-chart";

type TCycleAnalyticsProgress = {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
};
type Options = {
  value: string;
  label: string;
};

export const cycleEstimateOptions: Options[] = [
  {
    value: "issues",
    get label() {
      return translate("web.work_items_af8f");
    },
  },
  {
    value: "points",
    get label() {
      return translate("web.title_estimates");
    },
  },
];
export const cycleChartOptions: Options[] = [
  {
    value: "burndown",
    get label() {
      return translate("web.burn_down");
    },
  },
  {
    value: "burnup",
    get label() {
      return translate("web.burn_up");
    },
  },
];

export const validateCycleSnapshot = (cycleDetails: ICycle | null): ICycle | null => {
  if (!cycleDetails || cycleDetails === null) return cycleDetails;

  const updatedCycleDetails: any = { ...cycleDetails };
  if (!isEmpty(cycleDetails.progress_snapshot)) {
    Object.keys(cycleDetails.progress_snapshot || {}).forEach((key) => {
      const currentKey = key as keyof TProgressSnapshot;
      if (!isEmpty(cycleDetails.progress_snapshot) && !isEmpty(updatedCycleDetails)) {
        updatedCycleDetails[currentKey as keyof ICycle] = cycleDetails?.progress_snapshot?.[currentKey];
      }
    });
  }
  return updatedCycleDetails;
};

const getGroupedIssueCounts = (
  cycleDetails: ICycle | null,
  estimateType: TCycleEstimateType
): Record<string, number> => ({
  backlog: estimateType === "points" ? cycleDetails?.backlog_estimate_points || 0 : cycleDetails?.backlog_issues || 0,
  unstarted:
    estimateType === "points" ? cycleDetails?.unstarted_estimate_points || 0 : cycleDetails?.unstarted_issues || 0,
  started: estimateType === "points" ? cycleDetails?.started_estimate_points || 0 : cycleDetails?.started_issues || 0,
  completed:
    estimateType === "points" ? cycleDetails?.completed_estimate_points || 0 : cycleDetails?.completed_issues || 0,
  cancelled:
    estimateType === "points" ? cycleDetails?.cancelled_estimate_points || 0 : cycleDetails?.cancelled_issues || 0,
});

const getChartDistributionData = (
  cycleDetails: ICycle | null,
  estimateType: TCycleEstimateType
): TCycleDistribution | TCycleEstimateDistribution | undefined =>
  estimateType === "points" ? cycleDetails?.estimate_distribution : cycleDetails?.distribution || undefined;

const getTotalIssuesCount = (cycleDetails: ICycle | null, estimateType: TCycleEstimateType) =>
  estimateType === "points" ? cycleDetails?.total_estimate_points || 0 : cycleDetails?.total_issues || 0;

const getIsCycleDateValid = (cycleStartDate: Date | undefined, cycleEndDate: Date | undefined) => {
  if (!cycleStartDate || !cycleEndDate) return false;
  return cycleStartDate <= new Date() && cycleEndDate >= cycleStartDate;
};

type TCycleProgressSectionProps = {
  isCycleDateValid: boolean;
  progressTitle: ReactNode;
  progressBody: ReactNode;
};

function CycleProgressSection(props: TCycleProgressSectionProps) {
  const { isCycleDateValid, progressTitle, progressBody } = props;

  if (!isCycleDateValid) {
    return (
      <div className="flex flex-col">
        <div className="relative flex w-full items-center justify-between gap-2">{progressTitle}</div>
        {progressBody}
      </div>
    );
  }

  return (
    <Collapsible.Root defaultOpen className="flex flex-col">
      <Collapsible.Trigger className="group relative flex w-full items-center justify-between gap-2">
        {progressTitle}
        <span className="ml-auto">
          <ChevronUpOutline className="hidden h-3.5 w-3.5 group-data-[panel-open]:block" aria-hidden="true" />
          <ChevronDownOutline className="h-3.5 w-3.5 group-data-[panel-open]:hidden" aria-hidden="true" />
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel>{progressBody}</Collapsible.Panel>
    </Collapsible.Root>
  );
}

type TCycleProgressBodyProps = {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
  cycleStartDate: Date | undefined;
  cycleEndDate: Date | undefined;
  isCycleDateValid: boolean;
  chartDistributionData: TCycleDistribution | TCycleEstimateDistribution | undefined;
  groupedIssues: Record<string, number>;
  handleFiltersUpdate: (condition: TWorkItemFilterCondition) => void;
  isEditable: boolean;
  plotType: TCyclePlotType;
  selectedFilters: TSelectedFilterProgressStats;
  totalIssuesCount: number;
};

function CycleProgressBody(props: TCycleProgressBodyProps) {
  const {
    workspaceSlug,
    projectId,
    cycleId,
    cycleStartDate,
    cycleEndDate,
    isCycleDateValid,
    chartDistributionData,
    groupedIssues,
    handleFiltersUpdate,
    isEditable,
    plotType,
    selectedFilters,
    totalIssuesCount,
  } = props;
  // plane hooks
  const { t } = useTranslation();

  if (!cycleStartDate || !cycleEndDate) {
    return (
      <div className="flex flex-col divide-y divide-subtle-1">
        <div className="my-2 w-full rounded-md bg-surface-2 px-2 py-2 text-13 text-tertiary">{t("no_data_yet")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-subtle-1">
      <>
        {isCycleDateValid && <SidebarChart workspaceSlug={workspaceSlug} projectId={projectId} cycleId={cycleId} />}
        {/* progress detailed view */}
        {chartDistributionData && (
          <div className="w-full py-4">
            <CycleProgressStats
              cycleId={cycleId}
              distribution={chartDistributionData}
              groupedIssues={groupedIssues}
              handleFiltersUpdate={handleFiltersUpdate}
              isEditable={isEditable}
              plotType={plotType}
              selectedFilters={selectedFilters}
              totalIssuesCount={totalIssuesCount}
            />
          </div>
        )}
      </>
    </div>
  );
}

export const CycleAnalyticsProgress = observer(function CycleAnalyticsProgress(props: TCycleAnalyticsProgress) {
  // props
  const { workspaceSlug, projectId, cycleId } = props;
  // router
  const searchParams = useSearchParams();
  const peekCycle = searchParams.get("peekCycle") || undefined;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { getPlotTypeByCycleId, getEstimateTypeByCycleId, getCycleById } = useCycle();
  const { getFilter, updateFilterValueFromSidebar } = useWorkItemFilters();
  // derived values
  const cycleFilter = getFilter(EIssuesStoreType.CYCLE, cycleId);
  const selectedAssignees = cycleFilter?.findFirstConditionByPropertyAndOperator("assignee_id", "in");
  const selectedLabels = cycleFilter?.findFirstConditionByPropertyAndOperator("label_id", "in");
  const selectedStateGroups = cycleFilter?.findFirstConditionByPropertyAndOperator("state_group", "in");
  const cycleDetails = validateCycleSnapshot(getCycleById(cycleId));
  const plotType: TCyclePlotType = getPlotTypeByCycleId(cycleId);
  const estimateType = getEstimateTypeByCycleId(cycleId);
  const chartDistributionData = getChartDistributionData(cycleDetails, estimateType);
  const groupedIssues = useMemo(() => getGroupedIssueCounts(cycleDetails, estimateType), [estimateType, cycleDetails]);
  const cycleStartDate = getDate(cycleDetails?.start_date);
  const cycleEndDate = getDate(cycleDetails?.end_date);
  const isCycleDateValid = getIsCycleDateValid(cycleStartDate, cycleEndDate);
  const totalIssuesCount = getTotalIssuesCount(cycleDetails, estimateType);

  if (!cycleDetails) return <></>;

  const progressTitle = (
    <span className="text-13 font-medium text-secondary">{t("project_cycles.active_cycle.progress")}</span>
  );

  return (
    <div className="space-y-4 border-t border-subtle py-5">
      {/* progress bar header */}
      <CycleProgressSection
        isCycleDateValid={isCycleDateValid}
        progressTitle={progressTitle}
        progressBody={
          <CycleProgressBody
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            cycleId={cycleId}
            cycleStartDate={cycleStartDate}
            cycleEndDate={cycleEndDate}
            isCycleDateValid={isCycleDateValid}
            chartDistributionData={chartDistributionData}
            groupedIssues={groupedIssues}
            handleFiltersUpdate={updateFilterValueFromSidebar.bind(
              updateFilterValueFromSidebar,
              EIssuesStoreType.CYCLE,
              cycleId
            )}
            isEditable={Boolean(!peekCycle) && cycleFilter !== undefined}
            plotType={plotType}
            selectedFilters={{
              assignees: selectedAssignees,
              labels: selectedLabels,
              stateGroups: selectedStateGroups,
            }}
            totalIssuesCount={totalIssuesCount}
          />
        }
      />
    </div>
  );
});
