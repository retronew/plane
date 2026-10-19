import { ProjectComparison } from "./project-comparison";
import CreatedVsResolved from "./work-items/created-vs-resolved";
import { AnalyticsMetricCard } from "./metric-card";
import { Suspense, lazy, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, FolderKanban, Layers, CircleDashed, UserRound } from "lucide-react";
import { Avatar } from "@makeplane/propel/components/avatar";
import { ModuleStatusIcon } from "@plane/blocks/icons";
import type { TModuleStatus } from "@plane/blocks/icons";
import { AnalyticsEntityCell } from "./entity-cell";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";
import type { TAnalyticsDetailRow, TAnalyticsDetailTab, TBarItem } from "@plane/types";
import { formatCompactDate, getFileURL, renderFormattedDate } from "@plane/utils";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AnalyticsService } from "@/services/analytics.service";
import { DETAIL_COLUMNS } from "./details-columns";
import { projectCompletion } from "./project-completion";
import AnalyticsWrapper from "./analytics-wrapper";
import AnalyticsSectionWrapper from "./analytics-section-wrapper";
import AnalyticsEmptyState from "./empty-state";
import { DataTable } from "./insight-table/data-table";
import type { TInsightTableFeatures } from "./insight-table/table-features";
import { TableLoader } from "./insight-table/loader";
import { AnalyticsDetailsLoader } from "./loaders";

// recharts is a large dependency; the chart loads when this tab renders.
const BarChart = lazy(() => import("@plane/blocks/charts/bar-chart").then((mod) => ({ default: mod.BarChart })));
import { AsyncContent } from "@/components/common/async-content";
import { CHART_SEMANTIC_COLORS } from "@plane/constants";
import { exportAnalytics } from "./export";
import { AnalyticsExportMenu } from "./export-menu";
import AnalyticsRequestError from "./request-error";

import { StatisticsNote, StatisticsNotePanel } from "./statistics-note";

const service = new AnalyticsService();
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
  const scope = `${slug}:${tab}:${selectedProjects.join(",")}:${selectedDuration}`;
  const [selection, setSelection] = useState<{ scope: string; key?: string }>({ scope });
  if (selection.scope !== scope) setSelection({ scope });
  const selectedProject =
    selection.scope === scope && data?.rows.some((row) => String(row.id) === selection.key) ? selection.key : undefined;
  const visibleRows =
    tab === "projects" && !embedded && selectedProject
      ? (data?.rows.filter((row) => String(row.id) === selectedProject) ?? [])
      : (data?.rows ?? []);
  const summary =
    tab === "projects" ? { ...data?.summary, completion: projectCompletion(data?.rows ?? []) } : (data?.summary ?? {});
  const detailsId = tab === "projects" ? "project-progress" : `analytics-${tab}-details`;
  const summaryTarget = (key: string) =>
    (tab === "projects" && key !== "total_projects" && key !== "completion") || key === "unique_work_items"
      ? `/${slug}/analytics/work-items/`
      : `#${detailsId}`;
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
                tab === "projects" || tab === "intake"
                  ? `/${slug}/projects/${id}/${tab === "intake" ? "intake" : "issues"}/`
                  : tab === "users" && id !== "unassigned"
                    ? `/${slug}/profile/${id}/`
                    : tab === "cycles" || tab === "modules"
                      ? `/${slug}/projects/${row.original.project_id}/${tab}/${id}/`
                      : undefined;
              const icon =
                tab === "users" ? (
                  id === "unassigned" ? (
                    <UserRound className="size-4 text-tertiary" />
                  ) : (
                    <Avatar
                      size="xs"
                      alt={String(name)}
                      fallback={String(name).slice(0, 1).toUpperCase()}
                      src={getFileURL(String(row.original.avatar_url || ""))}
                    />
                  )
                ) : tab === "projects" || tab === "intake" ? (
                  <FolderKanban className="size-4 text-tertiary" />
                ) : tab === "cycles" ? (
                  <CircleDashed className="size-4 text-tertiary" />
                ) : (
                  <Layers className="size-4 text-tertiary" />
                );
              return <AnalyticsEntityCell name={String(name)} href={href} icon={icon} />;
            }
            if (field === "project")
              return (
                <AnalyticsEntityCell
                  name={String(value || "—")}
                  href={row.original.project_id ? `/${slug}/projects/${row.original.project_id}/issues/` : undefined}
                  icon={<FolderKanban className="size-4 text-tertiary" />}
                />
              );
            if (field === "lead")
              return value ? (
                <AnalyticsEntityCell
                  name={String(value)}
                  href={row.original.lead_id ? `/${slug}/profile/${row.original.lead_id}/` : undefined}
                  icon={
                    <Avatar
                      size="xs"
                      alt={String(value)}
                      fallback={String(value).slice(0, 1).toUpperCase()}
                      src={getFileURL(String(row.original.lead_avatar_url || ""))}
                    />
                  }
                />
              ) : (
                <span className="text-tertiary">—</span>
              );

            if (field === "completion")
              return (
                <Tooltip label={t("workspace_analytics.methodology.completion")}>
                  <div className="flex items-center justify-end gap-2">
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-[var(--border-color-subtle-1)]">
                      <span className="block h-full rounded-full bg-accent-primary" style={{ width: `${value}%` }} />
                    </span>
                    <span className="w-10 text-right tabular-nums">{value}%</span>
                  </div>
                </Tooltip>
              );
            if (field === "start_date" || field === "end_date")
              return value ? (
                <Tooltip label={renderFormattedDate(String(value))}>
                  <span className="whitespace-nowrap tabular-nums">{formatCompactDate(new Date(String(value)))}</span>
                </Tooltip>
              ) : (
                "—"
              );
            if (field === "status")
              return (
                <AnalyticsEntityCell
                  name={t(`workspace_analytics.details.statuses.${value}`)}
                  icon={
                    <ModuleStatusIcon
                      status={String(value) as TModuleStatus}
                      width="16px"
                      height="16px"
                      className="shrink-0"
                    />
                  }
                />
              );
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
            {!embedded && (
              <div
                className={
                  tab === "intake"
                    ? "-mx-2 grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6"
                    : tab === "projects"
                      ? "-mx-2 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4"
                      : tab === "cycles"
                        ? "-mx-2 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4"
                        : "-mx-2 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-5"
                }
              >
                {Object.entries(summary).map(([key, count]) => (
                  <AnalyticsMetricCard
                    key={key}
                    count={count}
                    unit={tab === "projects" && key === "completion" ? "%" : undefined}
                    to={summaryTarget(key)}
                    label={tab === "cycles" && key === "completed" ? t("workspace_analytics.cycles_ended") : label(key)}
                    hint={t(`workspace_analytics.${tab === "projects" ? "project" : tab}_summary_hints.${key}`)}
                  />
                ))}
              </div>
            )}
            {!embedded && tab === "projects" && (
              <>
                <CreatedVsResolved dashboard />
                <ProjectComparison
                  key={scope}
                  rows={data?.rows ?? []}
                  statuses={chart}
                  selected={selectedProject}
                  onSelect={(key) => setSelection({ scope, key })}
                />
              </>
            )}
            {!embedded && tab !== "projects" && (
              <AnalyticsSectionWrapper
                title={t(`workspace_analytics.details.charts.${tab}`)}
                titleClassName="text-16"
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
                    <Suspense fallback={<AnalyticsDetailsLoader />}>
                      <BarChart
                        className="h-full w-full"
                        barSize={24}
                        layout={tab === "users" || tab === "cycles" || tab === "modules" ? "vertical" : "horizontal"}
                        legend={
                          bars.length > 1
                            ? { align: "center", verticalAlign: "bottom", layout: "horizontal" }
                            : undefined
                        }
                        data={chart.slice(page * 20, (page + 1) * 20)}
                        bars={bars}
                        xAxis={{ key: "name", label: "" }}
                        yAxis={{ key: "count", label: label("count") }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <AnalyticsEmptyState
                    className="min-h-44"
                    title={t("common.no_data_available")}
                    description={t(`workspace_analytics.details.empty.${tab}`)}
                  />
                )}
                <StatisticsNotePanel>
                  <p className="text-12 leading-relaxed text-tertiary">
                    {t(`workspace_analytics.${tab}_summary_hints.distribution`)}
                  </p>
                </StatisticsNotePanel>
              </AnalyticsSectionWrapper>
            )}
            <div id={!embedded ? detailsId : undefined} className="scroll-mt-4">
              <DataTable
                title={
                  embedded || tab === "projects"
                    ? t("workspace_analytics.dashboard.project_progress")
                    : t(`workspace_analytics.detail_titles.${tab}`)
                }
                columns={columns}
                data={visibleRows}
                searchPlaceholder={t("workspace_analytics.details.records", { count: visibleRows.length })}
                actions={(table) => (
                  <AnalyticsExportMenu
                    disabled={!table.getFilteredRowModel().rows.length}
                    onExport={(format) => exportAnalytics(table.getFilteredRowModel().rows, columns, slug, format)}
                  />
                )}
              />
              <StatisticsNotePanel>
                <StatisticsNote kind={tab === "intake" ? "intake" : "cohort"} />
                {tab !== "users" && tab !== "intake" && <StatisticsNote kind="completion" />}
              </StatisticsNotePanel>
            </div>
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
