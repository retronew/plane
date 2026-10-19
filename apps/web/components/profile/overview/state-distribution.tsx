/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense } from "react";
// plane imports
import { AsyncContent } from "@/components/common/async-content";
import { ChartLoader } from "@/components/analytics/loaders";

// recharts is a large dependency; the chart loads when this card renders.
const PieChart = lazy(() => import("@plane/blocks/charts/pie-chart").then((mod) => ({ default: mod.PieChart })));
import { CHART_STATE_COLORS, STATE_GROUPS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import type { IUserProfileData, IUserStateDistribution } from "@plane/types";
import { Card } from "@plane/blocks/card";

import { ProfileChartTooltip } from "./chart-tooltip";
import type { ProfileChartTooltipContentProps } from "./chart-tooltip";

type Props = {
  stateDistribution: IUserStateDistribution[];
  userProfile: IUserProfileData | undefined;
};

function renderStateTooltip({ active, payload }: ProfileChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  return <ProfileChartTooltip label={payload[0].name} value={payload[0].value} color={payload[0].payload.color} />;
}

export function ProfileStateDistribution({ userProfile }: Props) {
  const { t } = useTranslation();
  const distribution = userProfile?.state_distribution ?? [];
  const total = distribution.reduce((sum, group) => sum + group.state_count, 0);

  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-h6-medium">{t("profile.stats.state_distribution.title")}</h3>
      <AsyncContent loading={!userProfile} minHeight={225} skeleton={<ChartLoader height={225} />}>
        <Card className="h-full rounded-xl border border-subtle-1 bg-layer-2 p-3">
          {distribution.length > 0 ? (
            <div className="grid h-[200px] w-full grid-cols-1 gap-x-3 md:grid-cols-2">
              <Suspense fallback={<ChartLoader height={225} />}>
                <PieChart
                  className="size-full"
                  dataKey="value"
                  margin={{
                    top: 8,
                    right: 0,
                    bottom: 8,
                    left: 0,
                  }}
                  data={
                    distribution.map((group) => ({
                      id: group.state_group,
                      key: group.state_group,
                      value: group.state_count,
                      name: STATE_GROUPS[group.state_group].label,
                      color: CHART_STATE_COLORS[group.state_group],
                    })) ?? []
                  }
                  cells={distribution.map((group) => ({
                    key: group.state_group,
                    fill: CHART_STATE_COLORS[group.state_group],
                  }))}
                  showTooltip
                  tooltipLabel={t("web.count")}
                  customTooltipContent={renderStateTooltip}
                  paddingAngle={5}
                  cornerRadius={4}
                  innerRadius="50%"
                  showLabel={false}
                />
              </Suspense>
              <div className="flex items-center">
                <div className="w-full space-y-1.5">
                  {distribution.map((group) => (
                    <div key={group.state_group} className="flex items-center justify-between gap-2 text-11">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2.5 w-2.5 rounded-xs"
                          style={{
                            backgroundColor:
                              CHART_STATE_COLORS[group.state_group] ?? "var(--background-color-accent-primary)",
                          }}
                        />
                        <div className="whitespace-nowrap">{STATE_GROUPS[group.state_group].label}</div>
                      </div>
                      <div className="tabular-nums">
                        {group.state_count} · {total ? Math.round((group.state_count * 100) / total) : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyStateCompact
              assetKey="state"
              assetClassName="size-20"
              title={t("workspace_empty_state.your_work_by_state.title")}
            />
          )}
        </Card>
      </AsyncContent>
    </div>
  );
}
