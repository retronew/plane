/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useTheme } from "next-themes";
// plane imports
import { useTranslation, translate } from "@plane/i18n";
import type { ICycle, TCycleEstimateType, TModuleCompletionChartDistribution } from "@plane/types";
import { Loader } from "@plane/blocks/skeleton";
// assets
import darkChartAsset from "@/app/assets/empty-state/active-cycle/chart-dark.webp?url";
import lightChartAsset from "@/app/assets/empty-state/active-cycle/chart-light.webp?url";
// components
import ProgressChart from "@/components/core/sidebar/progress-chart";
import { SimpleEmptyState } from "@/components/empty-state/simple-empty-state-root";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { EstimateTypeDropdown } from "../dropdowns/estimate-type-dropdown";

export type ActiveCycleProductivityProps = {
  workspaceSlug: string;
  projectId: string;
  cycle: ICycle | null;
};

type Translate = ReturnType<typeof useTranslation>["t"];

function getChartDistributionData(cycle: ICycle | null, estimateType: TCycleEstimateType) {
  if (!cycle) return undefined;
  if (estimateType === "points") return cycle.estimate_distribution?.completion_chart;
  return cycle.distribution?.completion_chart;
}

function PendingLabel({ cycle, estimateType }: { cycle: ICycle; estimateType: TCycleEstimateType }) {
  if (estimateType === "points")
    return (
      <span>
        {translate("web.runtime.pending_points", {
          count: cycle.backlog_estimate_points + cycle.unstarted_estimate_points + cycle.started_estimate_points,
        })}
      </span>
    );
  return (
    <span>
      {translate("web.runtime.pending_work_items", {
        count: cycle.backlog_issues + cycle.unstarted_issues + cycle.started_issues,
      })}
    </span>
  );
}

function DistributionChart({
  cycle,
  estimateType,
  distribution,
  t,
}: {
  cycle: ICycle;
  estimateType: TCycleEstimateType;
  distribution: TModuleCompletionChartDistribution;
  t: Translate;
}) {
  if (estimateType === "points")
    return (
      <ProgressChart
        distribution={distribution}
        totalIssues={Math.max(0, (cycle.total_estimate_points || 0) - (cycle.cancelled_estimate_points || 0))}
        plotTitle={"points"}
      />
    );
  return (
    <ProgressChart
      distribution={distribution}
      totalIssues={Math.max(0, (cycle.total_issues || 0) - (cycle.cancelled_issues || 0))}
      plotTitle={t("web.work_items_2")}
    />
  );
}

function ProductivityChartBody({
  cycle,
  estimateType,
  distribution,
  emptyAssetPath,
  t,
}: {
  cycle: ICycle;
  estimateType: TCycleEstimateType;
  distribution: TModuleCompletionChartDistribution;
  emptyAssetPath: string;
  t: Translate;
}) {
  if (cycle.total_issues <= 0)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <SimpleEmptyState title={t("active_cycle.empty_state.chart.title")} assetPath={emptyAssetPath} />
      </div>
    );

  return (
    <div className="h-full w-full px-2">
      <div className="flex items-center justify-end gap-4 py-1 text-11 text-tertiary">
        <PendingLabel cycle={cycle} estimateType={estimateType} />
      </div>

      <div className="relative h-full">
        <DistributionChart cycle={cycle} estimateType={estimateType} distribution={distribution} t={t} />
      </div>
    </div>
  );
}

export const ActiveCycleProductivity = observer(function ActiveCycleProductivity(props: ActiveCycleProductivityProps) {
  const { workspaceSlug, projectId, cycle } = props;
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // hooks
  const { getEstimateTypeByCycleId, setEstimateType } = useCycle();
  // derived values
  const estimateType: TCycleEstimateType = (cycle && getEstimateTypeByCycleId(cycle.id)) || "issues";
  const resolvedPath = resolvedTheme === "light" ? lightChartAsset : darkChartAsset;

  const onChange = async (value: TCycleEstimateType) => {
    if (!cycle?.id || !workspaceSlug || !projectId) return;
    setEstimateType(cycle.id, value);
  };

  const distribution = getChartDistributionData(cycle, estimateType);

  if (!cycle || !distribution)
    return (
      <Loader className="flex min-h-[17rem] flex-col gap-5 rounded-lg border border-subtle bg-surface-1">
        <Loader.Item width="100%" height="100%" />
      </Loader>
    );

  return (
    <div className="flex min-h-[17rem] flex-col gap-5 rounded-lg border border-subtle bg-surface-1 px-3.5 py-4">
      <div className="relative flex items-center justify-between gap-4">
        <Link href={`/${workspaceSlug}/projects/${projectId}/cycles/${cycle.id}`}>
          <h3 className="text-14 font-semibold text-tertiary">{t("project_cycles.active_cycle.issue_burndown")}</h3>
        </Link>
        <EstimateTypeDropdown value={estimateType} onChange={onChange} cycleId={cycle.id} projectId={projectId} />
      </div>

      <Link href={`/${workspaceSlug}/projects/${projectId}/cycles/${cycle.id}`}>
        <ProductivityChartBody
          cycle={cycle}
          estimateType={estimateType}
          distribution={distribution}
          emptyAssetPath={resolvedPath}
          t={t}
        />
      </Link>
    </div>
  );
});
