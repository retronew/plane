/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getDateTimeFormatter } from "@plane/utils";
import React from "react";
import { CHART_SERIES_COLORS } from "@plane/constants";
// plane imports
import { AreaChart } from "@plane/blocks/charts/area-chart";
import type { TModuleCompletionChartDistribution } from "@plane/types";
import { StatisticsNote } from "@/components/analytics/statistics-note";
import { progressChartData } from "./progress-data";
import { translate } from "@plane/i18n";

type Props = {
  distribution: TModuleCompletionChartDistribution;
  totalIssues: number;
  className?: string;
  plotTitle?: string;
};

function ProgressChart({ distribution, totalIssues, className = "", plotTitle = "work items" }: Props) {
  const chartData = progressChartData(distribution ?? {}, totalIssues);

  return (
    <div className={`flex w-full flex-col justify-center ${className}`}>
      <StatisticsNote kind="reconstructed" />
      <AreaChart
        data={chartData}
        areas={[
          {
            key: "current",
            label: translate("web.ui.current_plot", { title: plotTitle }),
            strokeColor: CHART_SERIES_COLORS[0],
            fill: CHART_SERIES_COLORS[0],
            fillOpacity: 0,
            showDot: true,
            smoothCurves: false,
            strokeOpacity: 1,
            stackId: "bar-one",
          },
          {
            key: "ideal",
            label: translate("web.ui.ideal_plot", { title: plotTitle }),
            strokeColor: "var(--text-color-tertiary)",
            fill: "var(--text-color-tertiary)",
            fillOpacity: 0,
            showDot: true,
            smoothCurves: false,
            strokeOpacity: 1,
            stackId: "bar-two",
            style: {
              strokeDasharray: "6, 3",
              strokeWidth: 1,
            },
          },
        ]}
        xAxis={{
          key: "timestamp",
          type: "number",
          scale: "time",
          domain: [chartData[0]?.timestamp ?? 0, chartData.at(-1)?.timestamp ?? 0],
          tickFormatter: (value) =>
            getDateTimeFormatter({
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }).format(value),
          label: translate("web.date"),
        }}
        yAxis={{ key: "current", label: translate("workspace_analytics.methodology.remaining", { entity: plotTitle }) }}
        margin={{ bottom: 5 }}
        className="h-64 w-full"
        legend={{
          align: "center",
          verticalAlign: "bottom",
          layout: "horizontal",
        }}
      />
    </div>
  );
}

export default ProgressChart;
