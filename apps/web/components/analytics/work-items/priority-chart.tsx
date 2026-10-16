import { InsightEntity } from "../insight-entity";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AsyncContent } from "@/components/common/async-content";
import { StatisticsNote, StatisticsNotePanel } from "../statistics-note";
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
  // store hooks
  const { selectedDuration, selectedProjects, selectedCycle, selectedModule, isPeekView, isEpic } = useAnalytics();
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
  if (error) return <AnalyticsRequestError onRetry={() => void mutate()} />;
  return <InsightChart {...props} data={priorityChartData} loading={priorityChartLoading} />;
});

export const InsightChart = observer(function InsightChart(
  props: Props & { data?: TChart; loading?: boolean; metricLabel?: string; dimensionLabel?: string }
) {
  const { x_axis, y_axis, group_by, data: priorityChartData, loading: priorityChartLoading = false } = props;
  const { t } = useTranslation();
  const { workspaceSlug: slug } = useParams();
  const workspaceSlug = String(slug);
  const { workspaceStates } = useProjectState();
  const { resolvedTheme } = useTheme();
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
          showBottomBorderRadius: () => false,
        },
      ];
    } else if (chart_model === EChartModels.STACKED && parsedData.schema) {
      const parsedExtremes: {
        [key: string]: {
          top: string | null;
        };
      } = {};
      parsedData.data.forEach((datum) => {
        let top = null;
        for (let i = 0; i < schemaKeys.length; i++) {
          const key = schemaKeys[i];
          if (datum[key] === 0) continue;
          top = key;
        }
        parsedExtremes[datum.key] = { top };
      });

      parsedBars = schemaKeys.map((key, index) => ({
        key: key,
        label: parsedData.schema[key],
        stackId: [x_axis, group_by].some((axis) => axis === "ASSIGNEES" || axis === "LABELS") ? key : "bar-one",
        fill: extendedColors[index],
        textClassName: "",
        showPercentage: false,
        showTopBorderRadius: (value, payload: TChartDatum) =>
          [x_axis, group_by].some((axis) => axis === "ASSIGNEES" || axis === "LABELS") ||
          parsedExtremes[payload.key].top === value,
        showBottomBorderRadius: () => false,
      }));
    } else {
      parsedBars = [];
    }
    return parsedBars;
  }, [chart_model, group_by, parsedData, resolvedTheme, workspaceStates, x_axis, y_axis, t]);

  const yAxisLabel = useMemo(
    () =>
      props.metricLabel ?? ANALYTICS_Y_AXIS_VALUES.find((item) => item.value === props.y_axis)?.label ?? props.y_axis,
    [props.y_axis, props.metricLabel]
  );
  const xAxisLabel = useMemo(
    () =>
      props.dimensionLabel ??
      ANALYTICS_X_AXIS_VALUES.find((item) => item.value === props.x_axis)?.label ??
      props.x_axis,
    [props.x_axis, props.dimensionLabel]
  );

  const defaultColumns: ColumnDef<TInsightTableFeatures, TChartDatum>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: () => xAxisLabel,
        cell: ({ row }) => (
          <InsightEntity
            axis={x_axis}
            id={String(row.original.key)}
            name={String(row.original.name)}
            slug={workspaceSlug}
            projectId={row.original.project_id ? String(row.original.project_id) : undefined}
          />
        ),
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
    [xAxisLabel, t, x_axis, workspaceSlug]
  );

  const columns: ColumnDef<TInsightTableFeatures, TChartDatum>[] = useMemo(
    () =>
      parsedData
        ? Object.keys(parsedData?.schema ?? {}).map((key) => ({
            accessorKey: key,
            header: () => (
              <div className="flex justify-end">
                <InsightEntity
                  axis={group_by}
                  id={key.replace(/^entity:/, "")}
                  name={parsedData.schema[key]}
                  slug={workspaceSlug}
                />
              </div>
            ),
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
    [parsedData, group_by, workspaceSlug]
  );

  return (
    <AsyncContent loading={priorityChartLoading} skeleton={<ChartLoader />} minHeight={288}>
      <div className="flex flex-col gap-6">
        {parsedData?.data && parsedData.data.length > 0 ? (
          <>
            <BarChart
              className="h-72 w-full"
              data={parsedData.data}
              bars={bars}
              legend={group_by ? { align: "center", verticalAlign: "bottom", layout: "horizontal" } : undefined}
              xAxis={{
                key: "name",
                label: xAxisLabel.replace("_", " "),
              }}
              yAxis={{
                key: "count",
                label: props.metricLabel ?? t("common.no_of", { entity: yAxisLabel.replace("_", " ") }),
              }}
            />
            {!props.metricLabel && [x_axis, group_by].some((axis) => axis === "ASSIGNEES" || axis === "LABELS") && (
              <StatisticsNotePanel>
                <StatisticsNote kind="duplicates" />
              </StatisticsNotePanel>
            )}
            <DataTable
              title={t("workspace_analytics.group_breakdown")}
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
            title={t(
              props.metricLabel ? "common.no_data_available" : "workspace_empty_state.analytics_work_items.title"
            )}
          />
        )}
      </div>
    </AsyncContent>
  );
});

export default PriorityChart;
