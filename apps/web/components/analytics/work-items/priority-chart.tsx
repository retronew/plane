/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AsyncContent } from "@/components/common/async-content";
import { StatisticsNote } from "../statistics-note";
import AnalyticsRequestError from "../request-error";

import { useMemo } from "react";
import type { ColumnDef, Table } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
import useSWR from "swr";
// plane package imports
import type { ChartXAxisDateGrouping } from "@plane/constants";
import { ANALYTICS_X_AXIS_VALUES, ANALYTICS_Y_AXIS_VALUES, CHART_COLOR_PALETTES, EChartModels } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { BarChart } from "@plane/blocks/charts/bar-chart";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import type { TBarItem, TChart, TChartDatum, ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
// plane web components
import { generateExtendedColors, parseChartData } from "@/components/chart/utils";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProjectState } from "@/hooks/store/use-project-state";
import { AnalyticsService } from "@/services/analytics.service";
import { exportAnalytics } from "../export";
import { AnalyticsExportMenu } from "../export-menu";
import { DataTable } from "../insight-table/data-table";
import type { TInsightTableFeatures } from "../insight-table/table-features";
import { ChartLoader } from "../loaders";
import { localizeInsightChart } from "../localize-chart";
import { generateBarColor } from "./utils";

interface Props {
  x_axis: ChartXAxisProperty;
  y_axis: ChartYAxisMetric;
  group_by?: ChartXAxisProperty;
  x_axis_date_grouping?: ChartXAxisDateGrouping;
}

const analyticsService = new AnalyticsService();
const PriorityChart = observer(function PriorityChart(props: Props) {
  const { x_axis, y_axis, group_by } = props;
  const { t } = useTranslation();
  // store hooks
  const { selectedDuration, selectedProjects, selectedCycle, selectedModule, isPeekView, isEpic } = useAnalytics();
  const { workspaceStates } = useProjectState();
  const { resolvedTheme } = useTheme();
  // router
  const params = useParams();
  const workspaceSlug = params.workspaceSlug.toString();

  const {
    error,
    mutate,
    data: priorityChartData,
    isLoading: priorityChartLoading,
  } = useSWR(
    `customized-insights-chart-${workspaceSlug}-${selectedDuration}-
    ${selectedProjects}-${selectedCycle}-${selectedModule}-${props.x_axis}-${props.y_axis}-${props.group_by}-${isPeekView}-${isEpic}`,
    () =>
      analyticsService.getAdvanceAnalyticsCharts<TChart>(
        workspaceSlug,
        "custom-work-items",
        {
          ...(selectedDuration && selectedDuration !== "all_time" ? { date_filter: selectedDuration } : {}),
          ...(selectedProjects?.length > 0 && { project_ids: selectedProjects?.join(",") }),
          ...(selectedCycle ? { cycle_id: selectedCycle } : {}),
          ...(selectedModule ? { module_id: selectedModule } : {}),
          ...(isEpic ? { epic: true } : {}),
          ...props,
        },
        isPeekView
      )
  );
  const parsedData = useMemo(
    () =>
      priorityChartData &&
      localizeInsightChart(
        parseChartData(priorityChartData, props.x_axis, props.group_by, props.x_axis_date_grouping),
        props.x_axis,
        props.group_by,
        t
      ),
    [priorityChartData, props.x_axis, props.group_by, props.x_axis_date_grouping, t]
  );
  const chart_model = props.group_by ? EChartModels.STACKED : EChartModels.BASIC;

  const bars: TBarItem<string>[] = useMemo(() => {
    if (!parsedData) return [];
    let parsedBars: TBarItem<string>[];
    const schemaKeys = Object.keys(parsedData.schema);
    const baseColors = CHART_COLOR_PALETTES[0]?.[resolvedTheme === "dark" ? "dark" : "light"];
    const extendedColors = generateExtendedColors(baseColors ?? [], schemaKeys.length);
    if (chart_model === EChartModels.BASIC) {
      parsedBars = [
        {
          key: "count",
          label: t("web.count"),
          stackId: "bar-one",
          fill: (payload) => generateBarColor(payload.key, { x_axis, y_axis, group_by }, baseColors, workspaceStates),
          textClassName: "",
          showPercentage: false,
          showTopBorderRadius: () => true,
          showBottomBorderRadius: () => true,
        },
      ];
    } else if (chart_model === EChartModels.STACKED && parsedData.schema) {
      const parsedExtremes: {
        [key: string]: {
          top: string | null;
          bottom: string | null;
        };
      } = {};
      parsedData.data.forEach((datum) => {
        let top = null;
        let bottom = null;
        for (let i = 0; i < schemaKeys.length; i++) {
          const key = schemaKeys[i];
          if (datum[key] === 0) continue;
          if (!bottom) bottom = key;
          top = key;
        }
        parsedExtremes[datum.key] = { top, bottom };
      });

      parsedBars = schemaKeys.map((key, index) => ({
        key: key,
        label: parsedData.schema[key],
        stackId: [x_axis, group_by].some((axis) => axis === "ASSIGNEES" || axis === "LABELS") ? key : "bar-one",
        fill: extendedColors[index],
        textClassName: "",
        showPercentage: false,
        showTopBorderRadius: (value, payload: TChartDatum) => parsedExtremes[payload.key].top === value,
        showBottomBorderRadius: (value, payload: TChartDatum) => parsedExtremes[payload.key].bottom === value,
      }));
    } else {
      parsedBars = [];
    }
    return parsedBars;
  }, [chart_model, group_by, parsedData, resolvedTheme, workspaceStates, x_axis, y_axis, t]);

  const yAxisLabel = useMemo(
    () => ANALYTICS_Y_AXIS_VALUES.find((item) => item.value === props.y_axis)?.label ?? props.y_axis,
    [props.y_axis]
  );
  const xAxisLabel = useMemo(
    () => ANALYTICS_X_AXIS_VALUES.find((item) => item.value === props.x_axis)?.label ?? props.x_axis,
    [props.x_axis]
  );

  const defaultColumns: ColumnDef<TInsightTableFeatures, TChartDatum>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: () => xAxisLabel,
        meta: {
          export: {
            key: xAxisLabel,
            value: (row) => row.original.name,
            label: xAxisLabel,
          },
        },
      },
      {
        accessorKey: "count",
        header: () => <div className="text-right">{t("web.count")}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.count}</div>,
        meta: {
          export: {
            key: "Count",
            value: (row) => row.original.count,
            label: t("web.count"),
          },
        },
      },
    ],
    [xAxisLabel, t]
  );

  const columns: ColumnDef<TInsightTableFeatures, TChartDatum>[] = useMemo(
    () =>
      parsedData
        ? Object.keys(parsedData?.schema ?? {}).map((key) => ({
            accessorKey: key,
            header: () => <div className="text-right">{parsedData.schema[key]}</div>,
            cell: ({ row }) => <div className="text-right">{row.original[key]}</div>,
            meta: {
              export: {
                key,
                value: (row) => row.original[key],
                label: parsedData.schema[key],
              },
            },
          }))
        : [],
    [parsedData]
  );

  if (error) return <AnalyticsRequestError onRetry={() => void mutate()} />;

  return (
    <AsyncContent loading={priorityChartLoading} skeleton={<ChartLoader />} minHeight={288}>
      <div className="flex flex-col gap-6">
        {[x_axis, group_by].some((axis) => axis === "ASSIGNEES" || axis === "LABELS") && (
          <StatisticsNote kind="duplicates" />
        )}
        {parsedData?.data && parsedData.data.length > 0 ? (
          <>
            <BarChart
              className="h-72 w-full"
              data={parsedData.data}
              bars={bars}
              margin={{
                bottom: 30,
              }}
              xAxis={{
                key: "name",
                label: xAxisLabel.replace("_", " "),
                dy: 30,
              }}
              yAxis={{
                key: "count",
                label: t("common.no_of", { entity: yAxisLabel.replace("_", " ") }),
                offset: -60,
                dx: -26,
              }}
            />
            <DataTable
              data={parsedData.data}
              columns={[...defaultColumns, ...columns]}
              searchPlaceholder={`${parsedData.data.length} ${xAxisLabel}`}
              actions={(table: Table<TInsightTableFeatures, TChartDatum>) => (
                <AnalyticsExportMenu
                  disabled={!table.getFilteredRowModel().rows.length}
                  onExport={(format) =>
                    exportAnalytics(
                      table.getFilteredRowModel().rows,
                      [...defaultColumns, ...columns],
                      workspaceSlug,
                      format
                    )
                  }
                />
              )}
            />
          </>
        ) : (
          <EmptyStateCompact
            assetKey="unknown"
            assetClassName="size-20"
            rootClassName="border border-subtle px-5 py-10 md:py-20 md:px-20"
            title={t("workspace_empty_state.analytics_work_items.title")}
          />
        )}
      </div>
    </AsyncContent>
  );
});

export default PriorityChart;
