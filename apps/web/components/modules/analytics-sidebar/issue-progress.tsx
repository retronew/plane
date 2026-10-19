/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { WarningCircleOutline } from "@makeplane/propel/icons";
import { EEstimateSystem } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type {
  TModuleCompletionChartDistribution,
  TModuleDistribution,
  TModuleEstimateDistribution,
  TModulePlotType,
} from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import type { TWorkItemFilterCondition } from "@plane/shared-state";
import { Select } from "@plane/blocks/select";
import { Spinner } from "@plane/blocks/spinner";
// components
// constants
// helpers
import { getDate } from "@plane/utils";
import ProgressChart from "@/components/core/sidebar/progress-chart";
import type { TSelectedFilterProgressStats } from "@/components/core/sidebar/progress-stats/shared";
import { ModuleProgressStats } from "@/components/modules";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useModule } from "@/hooks/store/use-module";
import { useWorkItemFilters } from "@/hooks/store/work-item-filters/use-work-item-filters";
// plane web constants
type TModuleAnalyticsProgress = {
  workspaceSlug: string;
  projectId: string;
  moduleId: string;
};

type PlotTypeOption = { value: string; i18n_label: string };

type ModuleDetails = ReturnType<ReturnType<typeof useModule>["getModuleById"]>;
type Translate = ReturnType<typeof useTranslation>["t"];
type ModuleFetchers = {
  fetchModuleDetails: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<unknown>;
  fetchArchivedModuleDetails: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<unknown>;
};
type ModuleDateState = {
  startDate: ReturnType<typeof getDate>;
  endDate: ReturnType<typeof getDate>;
  isValid: boolean;
  hasBothDates: boolean;
};
type GroupedIssues = {
  backlog: number;
  unstarted: number;
  started: number;
  completed: number;
  cancelled: number;
};

const moduleBurnDownChartOptions: PlotTypeOption[] = [
  { value: "burndown", i18n_label: "issues" },
  { value: "points", i18n_label: "points" },
];

function getGroupedIssueCounts(moduleDetails: ModuleDetails, plotType: TModulePlotType): GroupedIssues {
  if (!moduleDetails) return { backlog: 0, unstarted: 0, started: 0, completed: 0, cancelled: 0 };
  const points = plotType === "points";
  return {
    backlog: (points ? moduleDetails.backlog_estimate_points : moduleDetails.backlog_issues) || 0,
    unstarted: (points ? moduleDetails.unstarted_estimate_points : moduleDetails.unstarted_issues) || 0,
    started: (points ? moduleDetails.started_estimate_points : moduleDetails.started_issues) || 0,
    completed: (points ? moduleDetails.completed_estimate_points : moduleDetails.completed_issues) || 0,
    cancelled: (points ? moduleDetails.cancelled_estimate_points : moduleDetails.cancelled_issues) || 0,
  };
}

function getChartDistribution(
  moduleDetails: ModuleDetails,
  plotType: TModulePlotType
): TModuleDistribution | TModuleEstimateDistribution | undefined {
  if (!moduleDetails) return undefined;
  return plotType === "points" ? moduleDetails.estimate_distribution : moduleDetails.distribution || undefined;
}

function getProgressPercentage(
  moduleDetails: ModuleDetails,
  plotType: TModulePlotType,
  effectivePoints: number,
  effectiveIssues: number
) {
  if (!moduleDetails) return 0;
  const completed =
    plotType === "points" ? moduleDetails.completed_estimate_points || 0 : moduleDetails.completed_issues || 0;
  const total = plotType === "points" ? effectivePoints : effectiveIssues;
  if (completed === 0 || total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function getEffectiveCounts(moduleDetails: ModuleDetails) {
  const totalIssues = moduleDetails?.total_issues || 0;
  const totalEstimatePoints = moduleDetails?.total_estimate_points || 0;
  return {
    completedIssues: moduleDetails?.completed_issues || 0,
    completedEstimatePoints: moduleDetails?.completed_estimate_points || 0,
    totalIssues,
    totalEstimatePoints,
    effectiveIssues: Math.max(0, totalIssues - (moduleDetails?.cancelled_issues || 0)),
    effectivePoints: Math.max(0, totalEstimatePoints - (moduleDetails?.cancelled_estimate_points || 0)),
  };
}

function getModuleDateState(moduleDetails: ModuleDetails): ModuleDateState {
  const startDate = getDate(moduleDetails?.start_date);
  const endDate = getDate(moduleDetails?.target_date);
  const isStartValid = Boolean(startDate && startDate <= new Date());
  const isEndValid = Boolean(startDate && endDate && endDate >= startDate);
  return {
    startDate,
    endDate,
    isValid: isStartValid && isEndValid,
    hasBothDates: Boolean(moduleDetails?.start_date && moduleDetails?.target_date),
  };
}

function getModuleTarget(workspaceSlug: string, projectId: string, moduleId: string) {
  if (!workspaceSlug || !projectId || !moduleId) return null;
  return { workspaceSlug, projectId, moduleId };
}

async function loadModuleDetails(
  target: { workspaceSlug: string; projectId: string; moduleId: string },
  isArchived: boolean,
  fetchers: ModuleFetchers
) {
  if (isArchived) return fetchers.fetchArchivedModuleDetails(target.workspaceSlug, target.projectId, target.moduleId);
  return fetchers.fetchModuleDetails(target.workspaceSlug, target.projectId, target.moduleId);
}

function getEstimateDetails(
  enabled: boolean,
  activeEstimateId: string | null | undefined,
  estimateById: (id: string) => ReturnType<ReturnType<typeof useProjectEstimates>["estimateById"]>
) {
  if (!enabled || !activeEstimateId) return undefined;
  return estimateById(activeEstimateId);
}

function PlotTypeSelect({
  plotType,
  onChange,
  t,
}: {
  plotType: TModulePlotType;
  onChange: (value: TModulePlotType) => void;
  t: Translate;
}) {
  const selected = moduleBurnDownChartOptions.find((option) => option.value === plotType);
  return (
    <Select<PlotTypeOption>
      getValues={() => moduleBurnDownChartOptions}
      value={selected ?? null}
      onChange={(value) => void onChange(value as TModulePlotType)}
      getOptionValue={(option) => option.value}
      getOptionLabel={(option) => t(option.i18n_label)}
      showSearch={false}
      pinSelected={false}
    >
      <Select.Trigger variant="select-md" className="w-auto">
        <span>{t(selected?.i18n_label || "none")}</span>
      </Select.Trigger>
    </Select>
  );
}

function ModuleProgressBody({
  plotType,
  completionChartData,
  chartDistributionData,
  groupedIssues,
  updateFilterValueFromSidebar,
  isEditable,
  moduleId,
  selectedFilters,
  totalIssuesCount,
  effectiveIssues,
  effectivePoints,
  dateState,
  t,
}: {
  plotType: TModulePlotType;
  completionChartData: TModuleCompletionChartDistribution | undefined;
  chartDistributionData: TModuleDistribution | TModuleEstimateDistribution | undefined;
  groupedIssues: GroupedIssues;
  updateFilterValueFromSidebar: (condition: TWorkItemFilterCondition) => void;
  isEditable: boolean;
  moduleId: string;
  selectedFilters: TSelectedFilterProgressStats;
  totalIssuesCount: number;
  effectiveIssues: number;
  effectivePoints: number;
  dateState: ModuleDateState;
  t: Translate;
}) {
  return (
    <div className="space-y-4">
      {/* progress burndown chart */}
      <div>
        {dateState.startDate && dateState.endDate && completionChartData && (
          <Fragment>
            {plotType === "points" ? (
              <ProgressChart distribution={completionChartData} totalIssues={effectivePoints} plotTitle={"points"} />
            ) : (
              <ProgressChart
                distribution={completionChartData}
                totalIssues={effectiveIssues}
                plotTitle={t("web.work_items_2")}
              />
            )}
          </Fragment>
        )}
      </div>

      {/* progress detailed view */}
      {chartDistributionData && (
        <div className="w-full border-t border-subtle pt-5">
          <ModuleProgressStats
            distribution={chartDistributionData}
            groupedIssues={groupedIssues}
            handleFiltersUpdate={updateFilterValueFromSidebar}
            isEditable={isEditable}
            moduleId={moduleId}
            plotType={plotType}
            selectedFilters={selectedFilters}
            totalIssuesCount={totalIssuesCount}
          />
        </div>
      )}
    </div>
  );
}

function ModuleProgressPanel({
  progressHeaderPercentage,
  plotType,
  onChange,
  loader,
  isCurrentEstimateTypeIsPoints,
  isModuleDateValid,
  isOpen,
  setIsOpen,
  moduleHasBothDates,
  body,
  t,
}: {
  progressHeaderPercentage: number;
  plotType: TModulePlotType;
  onChange: (value: TModulePlotType) => void;
  loader: boolean;
  isCurrentEstimateTypeIsPoints: boolean | undefined;
  isModuleDateValid: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  moduleHasBothDates: boolean;
  body: ReactNode;
  t: Translate;
}) {
  if (isModuleDateValid)
    return (
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        trigger={
          <span className="relative flex w-full items-center gap-2">
            <span className="text-13 font-medium text-secondary">{t("common.progress")}</span>
            {progressHeaderPercentage > 0 && (
              <span className="bg-amber-500/20 text-amber-500 inline-flex shrink-0 items-center justify-center rounded-sm px-1 py-px text-11 leading-[14px] font-medium">{`${progressHeaderPercentage}%`}</span>
            )}
          </span>
        }
        trailing={
          isCurrentEstimateTypeIsPoints ? (
            <div className="flex items-center gap-2">
              <PlotTypeSelect plotType={plotType} onChange={onChange} t={t} />
              {loader && <Spinner className="h-3 w-3" />}
            </div>
          ) : undefined
        }
      >
        {body}
      </Collapsible>
    );

  return (
    <div className="relative flex w-full items-center justify-between gap-2">
      <div className="text-13 font-medium text-secondary">{t("web.progress")}</div>
      <div className="flex items-center gap-1">
        <WarningCircleOutline height={14} width={14} className="text-secondary" />
        <span className="text-11 text-secondary italic">
          {moduleHasBothDates
            ? t("project_module.empty_state.sidebar.in_active")
            : t("project_module.empty_state.sidebar.invalid_date")}
        </span>
      </div>
    </div>
  );
}

export const ModuleAnalyticsProgress = observer(function ModuleAnalyticsProgress(props: TModuleAnalyticsProgress) {
  // props
  const { workspaceSlug, projectId, moduleId } = props;
  // router
  const searchParams = useSearchParams();
  const peekModule = searchParams.get("peekModule") || undefined;
  // plane hooks
  const { t } = useTranslation();
  // hooks
  const { areEstimateEnabledByProjectId, currentActiveEstimateId, estimateById } = useProjectEstimates();
  const { getPlotTypeByModuleId, setPlotType, getModuleById, fetchModuleDetails, fetchArchivedModuleDetails } =
    useModule();
  const { getFilter, updateFilterValueFromSidebar } = useWorkItemFilters();
  // state
  const [loader, setLoader] = useState(false);
  // derived values
  const moduleFilter = getFilter(EIssuesStoreType.MODULE, moduleId);
  const selectedAssignees = moduleFilter?.findFirstConditionByPropertyAndOperator("assignee_id", "in");
  const selectedLabels = moduleFilter?.findFirstConditionByPropertyAndOperator("label_id", "in");
  const selectedStateGroups = moduleFilter?.findFirstConditionByPropertyAndOperator("state_group", "in");
  const moduleDetails = getModuleById(moduleId);
  const plotType: TModulePlotType = getPlotTypeByModuleId(moduleId);
  const isCurrentProjectEstimateEnabled = Boolean(projectId && areEstimateEnabledByProjectId(projectId));
  const estimateDetails = getEstimateDetails(isCurrentProjectEstimateEnabled, currentActiveEstimateId, estimateById);
  const isCurrentEstimateTypeIsPoints = estimateDetails && estimateDetails?.type === EEstimateSystem.POINTS;
  const counts = getEffectiveCounts(moduleDetails);
  const progressHeaderPercentage = getProgressPercentage(
    moduleDetails,
    plotType,
    counts.effectivePoints,
    counts.effectiveIssues
  );
  const chartDistributionData = getChartDistribution(moduleDetails, plotType);
  const completionChartDistributionData = chartDistributionData?.completion_chart || undefined;
  const groupedIssues = useMemo(() => getGroupedIssueCounts(moduleDetails, plotType), [plotType, moduleDetails]);
  const dateState = getModuleDateState(moduleDetails);
  const isArchived = !!moduleDetails?.archived_at;
  // state
  const [isOpen, setIsOpen] = useState(!!dateState.isValid);
  const target = getModuleTarget(workspaceSlug, projectId, moduleId);

  // handlers
  const onChange = async (value: TModulePlotType) => {
    setPlotType(moduleId, value);
    if (!target) return;
    try {
      setLoader(true);
      await loadModuleDetails(target, isArchived, { fetchModuleDetails, fetchArchivedModuleDetails });
      setLoader(false);
    } catch (_error) {
      setLoader(false);
      setPlotType(moduleId, plotType);
    }
  };

  if (!moduleDetails) return <></>;

  const progressBody = (
    <ModuleProgressBody
      plotType={plotType}
      completionChartData={completionChartDistributionData}
      chartDistributionData={chartDistributionData}
      groupedIssues={groupedIssues}
      updateFilterValueFromSidebar={updateFilterValueFromSidebar.bind(
        updateFilterValueFromSidebar,
        EIssuesStoreType.MODULE,
        moduleId
      )}
      isEditable={Boolean(!peekModule) && moduleFilter !== undefined}
      moduleId={moduleId}
      selectedFilters={{
        assignees: selectedAssignees,
        labels: selectedLabels,
        stateGroups: selectedStateGroups,
      }}
      totalIssuesCount={plotType === "points" ? counts.totalEstimatePoints || 0 : counts.totalIssues || 0}
      effectiveIssues={counts.effectiveIssues}
      effectivePoints={counts.effectivePoints}
      dateState={dateState}
      t={t}
    />
  );

  return (
    <div className="space-y-4 border-t border-subtle px-3 py-4">
      {/* progress bar header */}
      <ModuleProgressPanel
        progressHeaderPercentage={progressHeaderPercentage}
        plotType={plotType}
        onChange={onChange}
        loader={loader}
        isCurrentEstimateTypeIsPoints={isCurrentEstimateTypeIsPoints}
        isModuleDateValid={dateState.isValid}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        moduleHasBothDates={dateState.hasBothDates}
        body={progressBody}
        t={t}
      />
    </div>
  );
});
