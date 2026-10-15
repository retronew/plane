import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Link } from "react-router";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { BarChart } from "@plane/blocks/charts/bar-chart";
import { useTranslation } from "@plane/i18n";
import type { TAnalyticsDetailRow, TAnalyticsDetailTab, TBarItem } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AnalyticsService } from "@/services/analytics.service";
import AnalyticsWrapper from "./analytics-wrapper";
import AnalyticsSectionWrapper from "./analytics-section-wrapper";
import AnalyticsEmptyState from "./empty-state";
import { DataTable } from "./insight-table/data-table";
import type { TInsightTableFeatures } from "./insight-table/table-features";
import { TableLoader } from "./insight-table/loader";
import { AnalyticsDetailsLoader } from "./loaders";
import { AsyncContent } from "@/components/common/async-content";
import { CHART_SEMANTIC_COLORS } from "@plane/constants";
import { exportAnalytics } from "./export";
import { AnalyticsExportMenu } from "./export-menu";
import AnalyticsRequestError from "./request-error";

import { StatisticsNote } from "./statistics-note";

const service = new AnalyticsService();
export const DETAIL_COLUMNS: Record<TAnalyticsDetailTab, string[]> = {
  projects: [
    "name",
    "members",
    "epics",
    "work_items",
    "completed",
    "cancelled",
    "cycles",
    "modules",
    "pages",
    "views",
    "intake",
    "completion",
  ],
  users: ["name", "started", "unstarted", "completed", "cancelled"],
  cycles: ["name", "project", "lead", "start_date", "end_date", "work_items", "completed", "cancelled", "completion"],
  modules: [
    "name",
    "lead",
    "project",
    "start_date",
    "end_date",
    "status",
    "work_items",
    "completed",
    "cancelled",
    "completion",
  ],
  intake: ["name", "pending", "snoozed", "accepted", "rejected", "duplicate", "total"],
};

export const AnalyticsDetails = observer(function AnalyticsDetails({
  tab,
  embedded = false,
}: {
  tab: TAnalyticsDetailTab;
  embedded?: boolean;
}) {
  const { workspaceSlug } = useParams();
  const slug = String(workspaceSlug);
  const { selectedProjects, selectedDuration } = useAnalytics();
  const { t } = useTranslation();
  const [chartPage, setChartPage] = useState(0);
  const { data, isLoading, error, mutate } = useSWR(
    ["analytics-details", slug, tab, selectedProjects.join(","), selectedDuration],
    () => service.getAnalyticsDetails(slug, tab, selectedProjects, selectedDuration),
    { errorRetryCount: 2 }
  );
  const label = (key: string) => t(`workspace_analytics.details.fields.${key}`);
  const columns = useMemo<ColumnDef<TInsightTableFeatures, TAnalyticsDetailRow>[]>(
    () =>
      DETAIL_COLUMNS[tab]
        .filter(
          (field) => !embedded || ["name", "work_items", "completed", "cycles", "modules", "completion"].includes(field)
        )
        .map((field) => ({
          accessorKey: field,
          header: t(`workspace_analytics.details.fields.${field}`),
          cell: ({ row }) => {
            const value = row.original[field];
            if (field === "name") {
              const name = value || t("unassigned");
              const id = row.original.id;
              const href =
                tab === "projects"
                  ? `/${slug}/projects/${id}/issues/`
                  : tab === "users" && id !== "unassigned"
                    ? `/${slug}/profile/${id}/`
                    : tab === "cycles" || tab === "modules"
                      ? `/${slug}/projects/${row.original.project_id}/${tab}/${id}/`
                      : undefined;
              return href ? (
                <Link className="block max-w-72 truncate hover:text-accent-primary" title={String(name)} to={href}>
                  {name}
                </Link>
              ) : (
                <span>{name}</span>
              );
            }
            if (field === "completion")
              return (
                <div className="flex items-center justify-end gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-layer-2">
                    <span className="block h-full rounded-full bg-accent-primary" style={{ width: `${value}%` }} />
                  </span>
                  <span className="w-10 text-right tabular-nums">{value}%</span>
                </div>
              );
            if (field === "start_date" || field === "end_date") return value ? renderFormattedDate(String(value)) : "—";
            if (field === "status") return t(`workspace_analytics.details.statuses.${value}`);
            return (
              <span className={typeof value === "number" ? "block text-right tabular-nums" : ""}>
                {value || (value === 0 ? 0 : "—")}
              </span>
            );
          },
          meta: {
            export: {
              key: t(`workspace_analytics.details.fields.${field}`),
              value: (row) => row.original[field] ?? "",
            },
          },
        })),
    [slug, tab, t, embedded]
  );
  const bars = useMemo<TBarItem<string>[]>(() => {
    const keys =
      tab === "projects"
        ? ["count"]
        : tab === "intake"
          ? ["pending", "snoozed", "accepted", "rejected", "duplicate"]
          : ["pending", "completed", "cancelled"];
    const colors: Record<string, string> = {
      count: CHART_SEMANTIC_COLORS.primary,
      pending: CHART_SEMANTIC_COLORS.primary,
      completed: CHART_SEMANTIC_COLORS.completed,
      cancelled: CHART_SEMANTIC_COLORS.cancelled,
      snoozed: CHART_SEMANTIC_COLORS.warning,
      accepted: CHART_SEMANTIC_COLORS.completed,
      rejected: CHART_SEMANTIC_COLORS.danger,
      duplicate: CHART_SEMANTIC_COLORS.neutral,
    };
    return keys.map((key) => ({
      key,
      label: t(`workspace_analytics.details.fields.${key}`),
      fill: colors[key],
      stackId: "progress",
      textClassName: "fill-primary",
    }));
  }, [tab, t]);
  const chart = (data?.chart ?? []).map((item, index) =>
    Object.assign({}, item, {
      key: String(index),
      name:
        tab === "projects" &&
        ["draft", "planning", "execution", "monitoring", "completed", "cancelled"].includes(item.name)
          ? t(`workspace_analytics.details.statuses.${item.name}`)
          : item.name || t("unassigned"),
    })
  );
  const pages = Math.max(1, Math.ceil(chart.length / 20));
  const page = Math.min(chartPage, pages - 1);
  return (
    <AnalyticsWrapper
      i18nTitle={`workspace_analytics.details.tabs.${tab}`}
      hideTitle={embedded}
      className={embedded ? "p-0!" : undefined}
    >
      {error ? (
        <AnalyticsRequestError onRetry={() => void mutate()} />
      ) : (
        <AsyncContent
          loading={isLoading}
          skeleton={embedded ? <TableLoader columns={columns} rows={4} /> : <AnalyticsDetailsLoader />}
          minHeight={embedded ? 250 : 650}
        >
          <div className="flex flex-col gap-8">
            <div className="space-y-1">
              <StatisticsNote kind={tab === "intake" ? "intake" : "cohort"} />
              {tab === "users" ? (
                <StatisticsNote kind="duplicates" />
              ) : (
                tab !== "intake" && <StatisticsNote kind="completion" />
              )}
            </div>
            {!embedded && (
              <div
                className={
                  tab === "intake"
                    ? "grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6"
                    : "grid grid-cols-2 gap-6 lg:grid-cols-5"
                }
              >
                {Object.entries(data?.summary ?? {}).map(([key, count]) => (
                  <div key={key} className="flex flex-col gap-3">
                    <span className="text-13 text-tertiary">{label(key)}</span>
                    <span className="text-20 font-semibold tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )}
            {!embedded && (
              <AnalyticsSectionWrapper
                title={t(`workspace_analytics.details.charts.${tab}`)}
                actions={
                  pages > 1 ? (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-12 text-tertiary">
                        {page + 1} / {pages}
                      </span>
                      <Tooltip label={t("workspace_analytics.details.previous")}>
                        <IconButton
                          variant="ghost"
                          size="md"
                          aria-label={t("workspace_analytics.details.previous")}
                          icon={<ChevronLeft />}
                          disabled={!page}
                          onClick={() => setChartPage(page - 1)}
                        />
                      </Tooltip>
                      <Tooltip label={t("workspace_analytics.details.next")}>
                        <IconButton
                          variant="ghost"
                          size="md"
                          aria-label={t("workspace_analytics.details.next")}
                          icon={<ChevronRight />}
                          disabled={page + 1 >= pages}
                          onClick={() => setChartPage(page + 1)}
                        />
                      </Tooltip>
                    </div>
                  ) : undefined
                }
              >
                {chart.length ? (
                  <div
                    style={{
                      height:
                        tab === "users" || tab === "cycles" || tab === "modules"
                          ? Math.max(160, Math.min(20, chart.length - page * 20) * 36 + 90)
                          : 260,
                    }}
                  >
                    <BarChart
                      className="h-full w-full"
                      barSize={24}
                      layout={tab === "users" || tab === "cycles" || tab === "modules" ? "vertical" : "horizontal"}
                      legend={
                        bars.length > 1 ? { align: "center", verticalAlign: "bottom", layout: "horizontal" } : undefined
                      }
                      data={chart.slice(page * 20, (page + 1) * 20)}
                      bars={bars}
                      xAxis={{ key: "name", label: "" }}
                      yAxis={{ key: "count", label: label("count") }}
                    />
                  </div>
                ) : (
                  <AnalyticsEmptyState
                    className="min-h-44"
                    title={t("common.no_data_available")}
                    description={t(`workspace_analytics.details.empty.${tab}`)}
                  />
                )}
              </AnalyticsSectionWrapper>
            )}
            <DataTable
              title={embedded ? t("workspace_analytics.dashboard.project_progress") : undefined}
              columns={columns}
              data={data?.rows ?? []}
              searchPlaceholder={t("workspace_analytics.details.records", { count: data?.rows.length ?? 0 })}
              actions={(table) => (
                <AnalyticsExportMenu
                  disabled={!table.getFilteredRowModel().rows.length}
                  onExport={(format) => exportAnalytics(table.getFilteredRowModel().rows, columns, slug, format)}
                />
              )}
            />
          </div>
        </AsyncContent>
      )}
    </AnalyticsWrapper>
  );
});

export function ProjectsAnalytics() {
  return <AnalyticsDetails tab="projects" />;
}
export function UsersAnalytics() {
  return <AnalyticsDetails tab="users" />;
}
export function CyclesAnalytics() {
  return <AnalyticsDetails tab="cycles" />;
}
export function ModulesAnalytics() {
  return <AnalyticsDetails tab="modules" />;
}
export function IntakeAnalytics() {
  return <AnalyticsDetails tab="intake" />;
}
