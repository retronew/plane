/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
import { BarChart } from "@plane/blocks/charts/bar-chart";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import type { IUserProfileData } from "@plane/types";
import { Card } from "@plane/blocks/card";
import { Loader } from "@plane/blocks/skeleton";

import { ProfileChartTooltip } from "./chart-tooltip";
import type { ProfileChartTooltipContentProps } from "./chart-tooltip";

type Props = {
  userProfile: IUserProfileData | undefined;
};

const priorityColors = {
  urgent: "#991b1b",
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#16a34a",
  none: "#e5e5e5",
};

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
      {userProfile ? (
        <Card className="rounded-xl border border-subtle-1 bg-layer-2 p-3 pl-0">
          {userProfile.priority_distribution.length > 0 ? (
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
          ) : (
            <EmptyStateCompact
              assetKey="priority"
              assetClassName="size-20"
              title={t("workspace_empty_state.your_work_by_priority.title")}
            />
          )}
        </Card>
      ) : (
        <div className="grid place-items-center p-7">
          <Loader className="flex items-end gap-12">
            <Loader.Item width="30px" height="200px" />
            <Loader.Item width="30px" height="150px" />
            <Loader.Item width="30px" height="250px" />
            <Loader.Item width="30px" height="150px" />
            <Loader.Item width="30px" height="100px" />
          </Loader>
        </div>
      )}
    </div>
  );
}
