/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useState } from "react";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@makeplane/propel/components/button";
import { Select } from "@plane/blocks/select";
import { WorkspaceCycleChart } from "@/components/active-cycles/cycle-chart";
import type { CycleChartSeries } from "@/components/active-cycles/cycle-chart";
import { CYCLE_CHART_COLORS } from "@/components/active-cycles/chart-data";
import { projectCycleChartData } from "@/components/cycles/active-cycle/project-active-cycle-data";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { CycleService } from "@/services/cycle.service";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TCycleEstimateType } from "@plane/types";
import { Loader } from "@plane/blocks/skeleton";
import { getDate } from "@plane/utils";
// components
import ProgressChart from "@/components/core/sidebar/progress-chart";
import { validateCycleSnapshot } from "@/components/cycles/analytics-sidebar/issue-progress";
import { EstimateTypeDropdown } from "@/components/cycles/dropdowns";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";

type ProgressChartProps = {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
};
const cycleService = new CycleService();

export const SidebarChart = observer(function SidebarChart(props: ProgressChartProps) {
  const { allowPermissions } = useUserPermissions();
  const { getCycleById } = useCycle();
  const cycle = getCycleById(props.cycleId);
  const canReadSnapshots =
    !cycle?.archived_at &&
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.WORKSPACE,
      props.workspaceSlug
    ) &&
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      props.workspaceSlug,
      props.projectId
    );
  return canReadSnapshots ? <SnapshotSidebarChart key={props.cycleId} {...props} /> : <LegacySidebarChart {...props} />;
});

const SnapshotSidebarChart = observer(function SnapshotSidebarChart({
  workspaceSlug,
  projectId,
  cycleId,
}: ProgressChartProps) {
  const { t } = useTranslation();
  const { getCycleById, getPlotTypeByCycleId, setPlotType } = useCycle();
  const { getProjectById, fetchProjectDetails } = useProject();
  const [hidden, setHidden] = useState<Set<CycleChartSeries>>(new Set());
  const cycle = getCycleById(cycleId);
  const project = getProjectById(projectId);
  const { error: projectError, mutate: reloadProject } = useSWR(
    !project?.timezone ? ["project-active-cycle-project", workspaceSlug, projectId] : null,
    () => fetchProjectDetails(workspaceSlug, projectId),
    { revalidateOnFocus: false }
  );
  const {
    data: snapshots,
    error,
    mutate,
  } = useSWR(
    ["project-active-cycle-history", workspaceSlug, projectId, cycleId],
    () => cycleService.workspaceActiveCyclesProgressPro(workspaceSlug, projectId, cycleId),
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );
  const plotType = getPlotTypeByCycleId(cycleId);
  const burnup = plotType === "burnup";
  if (error || projectError)
    return (
      <div role="alert" className="flex items-center gap-2 py-4 text-13 text-secondary">
        {t("something_went_wrong")}
        <Button
          stretch="auto"
          size="sm"
          variant="secondary"
          label={t("web.retry")}
          onClick={() => {
            void mutate();
            void reloadProject();
          }}
        />
      </div>
    );
  if (!snapshots || !project?.timezone)
    return (
      <Loader className="py-4">
        <Loader.Item width="100%" height="320px" />
      </Loader>
    );
  const data = cycle && project ? projectCycleChartData(cycle, project, snapshots) : null;
  if (!data || !Object.values(data.progress_chart).some(Boolean))
    return <p className="py-4 text-13 text-tertiary">{t("no_data_yet")}</p>;
  const options = [
    { value: "burndown", label: t("web.burn_down") },
    { value: "burnup", label: t("web.burn_up") },
  ];
  const labels: Record<CycleChartSeries, string> = {
    ideal: t(burnup ? "workspace_cycles.ideal_completed_series" : "workspace_cycles.ideal_pending_series"),
    actual: t(burnup ? "workspace_cycles.completed" : "workspace_cycles.pending"),
    started: t("workspace_cycles.started"),
    scope: t("workspace_cycles.scope"),
  };
  return (
    <div className="min-w-0 py-4">
      <div className="flex flex-wrap items-center gap-2 text-13 text-secondary">
        <Select<(typeof options)[number]>
          getValues={() => options}
          value={options.find((option) => option.value === plotType) ?? options[0]}
          onChange={(value) => {
            if (value === "burndown" || value === "burnup") setPlotType(cycleId, value);
          }}
          getOptionValue={(option) => option.value}
          getOptionLabel={(option) => option.label}
          showSearch={false}
        >
          <Select.Trigger variant="select-md" className="w-auto" aria-label={t("workspace_cycles.chart_type")}>
            <Select.Value />
          </Select.Trigger>
        </Select>
        <span>
          {t("workspace_cycles.for")} {t("sidebar.work_items")}
        </span>
      </div>
      <WorkspaceCycleChart cycle={data} burnup={burnup} hidden={hidden} />
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {(Object.keys(labels) as CycleChartSeries[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={!hidden.has(key)}
            className="flex items-center gap-1.5 text-11 text-secondary"
            onClick={() =>
              setHidden((current) => {
                const next = new Set(current);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: CYCLE_CHART_COLORS[key], opacity: hidden.has(key) ? 0.3 : 1 }}
            />
            {labels[key]}
          </button>
        ))}
      </div>
    </div>
  );
});

const LegacySidebarChart = observer(function LegacySidebarChart(props: ProgressChartProps) {
  const { workspaceSlug, projectId, cycleId } = props;

  // hooks
  const { getEstimateTypeByCycleId, getCycleById, fetchCycleDetails, fetchArchivedCycleDetails, setEstimateType } =
    useCycle();
  const { t } = useTranslation();

  // derived data
  const cycleDetails = validateCycleSnapshot(getCycleById(cycleId));
  const cycleStartDate = getDate(cycleDetails?.start_date);
  const cycleEndDate = getDate(cycleDetails?.end_date);
  const totalEstimatePoints = cycleDetails?.total_estimate_points || 0;
  const totalIssues = cycleDetails?.total_issues || 0;
  const estimateType = getEstimateTypeByCycleId(cycleId);

  const chartDistributionData =
    estimateType === "points" ? cycleDetails?.estimate_distribution : cycleDetails?.distribution || undefined;

  const completionChartDistributionData = chartDistributionData?.completion_chart || undefined;

  if (!workspaceSlug || !projectId || !cycleId) return null;

  const isArchived = !!cycleDetails?.archived_at;

  // handlers
  const onChange = async (value: TCycleEstimateType) => {
    setEstimateType(cycleId, value);
    if (!workspaceSlug || !projectId || !cycleId) return;
    try {
      if (isArchived) {
        await fetchArchivedCycleDetails(workspaceSlug, projectId, cycleId);
      } else {
        await fetchCycleDetails(workspaceSlug, projectId, cycleId);
      }
    } catch (err) {
      console.error(err);
      setEstimateType(cycleId, estimateType);
    }
  };
  return (
    <div>
      <div className="relative flex items-center justify-between gap-2 pt-4">
        <EstimateTypeDropdown value={estimateType} onChange={onChange} cycleId={cycleId} projectId={projectId} />
      </div>
      <div className="py-4">
        <div>
          {cycleStartDate && cycleEndDate && completionChartDistributionData ? (
            <Fragment>
              <ProgressChart
                distribution={completionChartDistributionData}
                totalIssues={estimateType === "points" ? totalEstimatePoints : totalIssues}
                plotTitle={estimateType === "points" ? t("points") : t("work_items")}
              />
            </Fragment>
          ) : (
            <Loader className="mt-4 h-[160px] w-full">
              <Loader.Item width="100%" height="100%" />
            </Loader>
          )}
        </div>
      </div>
    </div>
  );
});
