import { orderBy } from "lodash-es";
import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import type { TChart, TChartDatum } from "@plane/types";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AnalyticsService } from "@/services/analytics.service";
import { parseChartData } from "@/components/chart/utils";
import { localizeInsightChart } from "../localize-chart";
import AnalyticsWrapper from "../analytics-wrapper";
import { DataTable } from "../insight-table/data-table";
import type { TInsightTableFeatures } from "../insight-table/table-features";
import { AnalyticsExportMenu } from "../export-menu";
import { exportAnalytics } from "../export";
import { CHART_SERIES_COLORS } from "@plane/constants";
import { generateBarColor } from "../work-items/utils";
import { PreviewChart } from "./chart";
import { PreviewChoice, PreviewContent, PreviewNote } from "./shared";

const service = new AnalyticsService();
export const QuickInsightsPreview = observer(function QuickInsightsPreview() {
  const { workspaceSlug } = useParams();
  const slug = String(workspaceSlug);
  const { selectedProjects, selectedDuration } = useAnalytics();
  const { t } = useTranslation();
  const [axis, setAxis] = useState(ChartXAxisProperty.STATE_GROUPS);
  const [metric, setMetric] = useState(ChartYAxisMetric.WORK_ITEM_COUNT);
  const [selection, setSelection] = useState<{ scope: string; key: string }>();
  const [showChart, setShowChart] = useState(true);
  const [page, setPage] = useState(0);
  const scope = `${slug}:${selectedProjects.join(",")}:${selectedDuration}:${axis}:${metric}`;
  const selected = selection?.scope === scope ? selection.key : undefined;
  const axes = [
    { id: ChartXAxisProperty.STATE_GROUPS, label: t("common.state") },
    { id: ChartXAxisProperty.PRIORITY, label: t("common.priority") },
    { id: ChartXAxisProperty.PROJECTS, label: t("common.project") },
    { id: ChartXAxisProperty.ASSIGNEES, label: t("common.assignee") },
  ];
  const metrics = [
    { id: ChartYAxisMetric.WORK_ITEM_COUNT, label: t("workspace_analytics.details.fields.work_items") },
    { id: ChartYAxisMetric.ESTIMATE_POINT_COUNT, label: t("workspace_analytics.preview.estimate_points") },
  ];
  const axisLabel = axes.find((option) => option.id === axis)!.label;
  const metricLabel = metrics.find((option) => option.id === metric)!.label;
  const { data, isLoading, error, mutate } = useSWR(
    ["analytics-preview-insights", scope],
    () =>
      service.getAdvanceAnalyticsCharts<TChart>(slug, "custom-work-items", {
        ...(selectedDuration && selectedDuration !== "all_time" ? { date_filter: selectedDuration } : {}),
        ...(selectedProjects.length ? { project_ids: selectedProjects.join(",") } : {}),
        x_axis: axis,
        y_axis: metric,
      }),
    { errorRetryCount: 2 }
  );
  const parsed = useMemo(
    () => localizeInsightChart(parseChartData(data, axis, undefined, undefined), axis, undefined, t),
    [data, axis, t]
  );
  const rows = parsed.data;
  const visible = selected ? rows.filter((row) => String(row.key) === selected) : rows;
  const sorted = orderBy(rows, [(row) => Number(row.count)], ["desc"]);
  const pages = Math.max(1, Math.ceil(sorted.length / 12));
  const activePage = Math.min(page, pages - 1);
  const columns = useMemo<ColumnDef<TInsightTableFeatures, TChartDatum>[]>(
    () => [
      {
        accessorKey: "name",
        header: axisLabel,
        cell: ({ row }) => (
          <button
            type="button"
            className="max-w-72 truncate rounded-sm text-left hover:text-accent-primary"
            title={row.original.name}
            aria-pressed={selected === String(row.original.key)}
            onClick={() =>
              setSelection(selected === String(row.original.key) ? undefined : { scope, key: String(row.original.key) })
            }
          >
            {row.original.name}
          </button>
        ),
        meta: { export: { key: axisLabel, value: (row) => row.original.name } },
      },
      {
        accessorKey: "count",
        header: metricLabel,
        cell: ({ row }) => <span className="block text-right tabular-nums">{row.original.count}</span>,
        meta: { export: { key: metricLabel, value: (row) => row.original.count } },
      },
    ],
    [axisLabel, metricLabel, selected, scope]
  );
  return (
    <AnalyticsWrapper i18nTitle="workspace_analytics.preview.insights" className="pt-6">
      <PreviewNote />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-13 text-tertiary">{t("workspace_analytics.preview.group_by")}</span>
          <PreviewChoice
            label={t("workspace_analytics.preview.group_by")}
            value={axis}
            options={axes}
            onChange={(value) => {
              setAxis(value);
              setPage(0);
            }}
          />
          <PreviewChoice
            label={t("workspace_analytics.preview.metric")}
            value={metric}
            options={metrics}
            onChange={(value) => {
              setMetric(value);
              setPage(0);
            }}
          />
        </div>
        <Button
          stretch="auto"
          variant="ghost"
          size="md"
          onClick={() => setShowChart(!showChart)}
          label={t(showChart ? "workspace_analytics.preview.hide_chart" : "workspace_analytics.preview.show_chart")}
        />
      </div>
      <PreviewContent loading={isLoading} error={error} retry={() => void mutate()}>
        <div className={showChart ? "grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]" : "min-w-0"}>
          <section className="min-w-0 space-y-3">
            {selected && (
              <Button
                stretch="auto"
                variant="ghost"
                size="md"
                onClick={() => setSelection(undefined)}
                label={t("workspace_analytics.preview.show_all")}
              />
            )}
            <DataTable
              title={t("workspace_analytics.preview.breakdown")}
              data={visible}
              columns={columns}
              searchPlaceholder={t("workspace_analytics.details.records", { count: visible.length })}
              actions={(table) => (
                <AnalyticsExportMenu
                  disabled={!table.getFilteredRowModel().rows.length}
                  onExport={(format) => exportAnalytics(table.getFilteredRowModel().rows, columns, slug, format)}
                />
              )}
            />
          </section>
          {showChart && (
            <aside className="min-w-0 space-y-5 rounded-xl bg-layer-1 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-16 font-medium">{t("workspace_analytics.preview.distribution")}</h2>
                <span className="text-12 text-tertiary">{axisLabel}</span>
              </div>
              <div>
                <span className="text-12 text-tertiary">
                  {metricLabel} · {t("workspace_analytics.preview.group_total")}
                </span>
                <div className="mt-1 text-24 font-medium tabular-nums">
                  {rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0).toLocaleString()}
                </div>
              </div>
              <PreviewChart
                data={sorted.slice(activePage * 12, (activePage + 1) * 12).map((row) => ({
                  key: String(row.key),
                  name: row.name,
                  value: Number(row.count ?? 0),
                  color: generateBarColor(String(row.key), { x_axis: axis, y_axis: metric }, [...CHART_SERIES_COLORS]),
                }))}
                label={metricLabel}
                selected={selected}
                onSelect={(key) => setSelection(selected === key ? undefined : { scope, key })}
              />
              <p className="text-12 text-tertiary">{t("workspace_analytics.preview.click_chart")}</p>
              {axis === ChartXAxisProperty.ASSIGNEES && (
                <p className="text-12 text-tertiary">{t("workspace_analytics.preview.assignee_counts")}</p>
              )}
              {pages > 1 && (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    stretch="auto"
                    variant="ghost"
                    size="md"
                    disabled={!activePage}
                    onClick={() => setPage(activePage - 1)}
                    label={t("workspace_analytics.details.previous")}
                  />
                  <span className="text-12">
                    {activePage + 1}/{pages}
                  </span>
                  <Button
                    stretch="auto"
                    variant="ghost"
                    size="md"
                    disabled={activePage + 1 >= pages}
                    onClick={() => setPage(activePage + 1)}
                    label={t("workspace_analytics.details.next")}
                  />
                </div>
              )}
            </aside>
          )}
        </div>
      </PreviewContent>
    </AnalyticsWrapper>
  );
});
