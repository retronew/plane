/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { CHART_SERIES_COLORS } from "@plane/constants";
// plane imports
import { AreaChart } from "@plane/blocks/charts/area-chart";
import type { TChartData, TModuleCompletionChartDistribution } from "@plane/types";
import { renderFormattedDateWithoutYear } from "@plane/utils";
import { translate } from "@plane/i18n";

type Props = {
  distribution: TModuleCompletionChartDistribution;
  totalIssues: number;
  className?: string;
  plotTitle?: string;
};

function ProgressChart({ distribution, totalIssues, className = "", plotTitle = "work items" }: Props) {
  const chartData: TChartData<string, string>[] = Object.keys(distribution ?? []).map((key, index) => ({
    name: renderFormattedDateWithoutYear(key),
    current: distribution[key] ?? 0,
    ideal: totalIssues * (1 - index / Math.max(1, Object.keys(distribution ?? []).length - 1)),
  }));

  return (
    <div className={`flex w-full items-center justify-center ${className}`}>
      <AreaChart
        data={chartData}
        areas={[
          {
            key: "current",
            label: translate("web.ui.current_plot", { title: plotTitle }),
            strokeColor: CHART_SERIES_COLORS[0],
            fill: CHART_SERIES_COLORS[0],
            fillOpacity: 0.06,
            showDot: true,
            smoothCurves: true,
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
            smoothCurves: true,
            strokeOpacity: 1,
            stackId: "bar-two",
            style: {
              strokeDasharray: "6, 3",
              strokeWidth: 1,
            },
          },
        ]}
        xAxis={{ key: "name", label: translate("web.date") }}
        yAxis={{ key: "current", label: translate("web.completion") }}
        margin={{ bottom: 30 }}
        className="h-72 w-full"
        legend={{
          align: "center",
          verticalAlign: "bottom",
          layout: "horizontal",
          wrapperStyles: {
            marginTop: 20,
          },
        }}
      />
    </div>
  );
}

export default ProgressChart;
