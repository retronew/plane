/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense } from "react";
// plane imports
import { CHART_PRIORITY_COLORS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import type { IUserProfileData } from "@plane/types";
import { Card } from "@plane/blocks/card";
import { AsyncContent } from "@/components/common/async-content";
import { ChartLoader } from "@/components/analytics/loaders";

import { ProfileChartTooltip } from "./chart-tooltip";
import type { ProfileChartTooltipContentProps } from "./chart-tooltip";

type Props = {
  userProfile: IUserProfileData | undefined;
};

// recharts is a large dependency; the chart loads when this card renders.
const BarChart = lazy(() => import("@plane/blocks/charts/bar-chart").then((mod) => ({ default: mod.BarChart })));

const priorityColors = CHART_PRIORITY_COLORS;

function renderPriorityTooltip({ active, label, payload }: ProfileChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <ProfileChartTooltip
      label={label}
      value={payload[0].value}
      color={priorityColors[(payload[0].payload.key ?? "none") as keyof typeof priorityColors]}
    />
  );
}

export function ProfilePriorityDistribution({ userProfile }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-h6-medium">{t("profile.stats.priority_distribution.title")}</h3>
      <AsyncContent loading={!userProfile} minHeight={225} skeleton={<ChartLoader height={225} />}>
        {userProfile ? (
          <Card className="rounded-xl border border-subtle-1 bg-layer-2 p-3 pl-0">
            {userProfile.priority_distribution.length > 0 ? (
              <Suspense fallback={<ChartLoader height={225} />}>
                <BarChart
                  className="h-[200px] w-full"
                  margin={{ top: 8, right: 16, bottom: 5, left: 0 }}
                  tickCount={{ y: 5 }}
                  customTooltipContent={renderPriorityTooltip}
                  data={userProfile.priority_distribution.map((priority) => ({
                    key: priority.priority ?? "None",
                    name: t(priority.priority ?? "none"),
                    count: priority.priority_count,
                  }))}
                  bars={[
                    {
                      key: "count",
                      label: t("web.count"),
                      stackId: "bar-one",
                      fill: (payload: any) => priorityColors[payload.key as keyof typeof priorityColors], // TODO: fix types
                      textClassName: "",
                      showPercentage: false,
                      showTopBorderRadius: () => true,
                      showBottomBorderRadius: () => true,
                    },
                  ]}
                  xAxis={{
                    key: "name",
                    label: t("common.priority"),
                  }}
                  yAxis={{
                    key: "count",
                    label: "",
                  }}
                  barSize={16}
                />
              </Suspense>
            ) : (
              <EmptyStateCompact
                assetKey="priority"
                assetClassName="size-20"
                title={t("workspace_empty_state.your_work_by_priority.title")}
              />
            )}
          </Card>
        ) : null}
      </AsyncContent>
    </div>
  );
}
