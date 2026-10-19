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
import type {
  IAnalyticsDetailsResponse,
  TAnalyticsDetailRow,
  TAnalyticsDetailTab,
  TBarItem,
  TChartLegend,
} from "@plane/types";
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

type TTranslate = (key: string, params?: Record<string, unknown>) => string;
type TDetailsChartRow = IAnalyticsDetailsResponse["chart"][number];
type TDetailsChartItem = TDetailsChartRow & { key: string; name: string };
type TDetailsSelection = { scope: string; key?: string };

const EMBEDDED_COLUMNS = new Set(["name", "work_items", "completed", "cycles", "modules", "completion"]);
const PROJECT_STATUS_CHART_NAMES = new Set(["draft", "planning", "execution", "monitoring", "completed", "cancelled"]);
const DETAIL_CHART_LEGEND: TChartLegend = { align: "center", verticalAlign: "bottom", layout: "horizontal" };
const BAR_KEYS: Record<TAnalyticsDetailTab, string[]> = {
  projects: ["count"],
  intake: ["pending", "snoozed", "accepted", "rejected", "duplicate"],
  users: ["pending", "completed", "cancelled"],
  cycles: ["pending", "completed", "cancelled"],
  modules: ["pending", "completed", "cancelled"],
};
const BAR_COLORS: Record<string, string> = {
  count: CHART_SEMANTIC_COLORS.primary,
  pending: CHART_SEMANTIC_COLORS.primary,
  completed: CHART_SEMANTIC_COLORS.completed,
  cancelled: CHART_SEMANTIC_COLORS.cancelled,
  snoozed: CHART_SEMANTIC_COLORS.warning,
  accepted: CHART_SEMANTIC_COLORS.completed,
  rejected: CHART_SEMANTIC_COLORS.danger,
  duplicate: CHART_SEMANTIC_COLORS.neutral,
};

function getDetailsId(tab: TAnalyticsDetailTab) {
  return tab === "projects" ? "project-progress" : `analytics-${tab}-details`;
}

function getSummaryTarget(tab: TAnalyticsDetailTab, key: string, slug: string, detailsId: string) {
  return (tab === "projects" && key !== "total_projects" && key !== "completion") || key === "unique_work_items"
    ? `/${slug}/analytics/work-items/`
    : `#${detailsId}`;
}

function getSelectedProject(selection: TDetailsSelection, scope: string, rows: TAnalyticsDetailRow[] | undefined) {
  if (selection.scope !== scope) return undefined;
  if (!rows?.some((row) => String(row.id) === selection.key)) return undefined;
  return selection.key;
}

function getVisibleRows(
  tab: TAnalyticsDetailTab,
  embedded: boolean,
  selectedProject: string | undefined,
  rows: TAnalyticsDetailRow[] | undefined
) {
  if (tab === "projects" && !embedded && selectedProject) {
    return (rows ?? []).filter((row) => String(row.id) === selectedProject);
  }
  return rows ?? [];
}

function getSummary(
  tab: TAnalyticsDetailTab,
  summary: Record<string, number> | undefined,
  rows: TAnalyticsDetailRow[] | undefined
) {
  if (tab === "projects") return { ...summary, completion: projectCompletion(rows ?? []) };
  return summary ?? {};
}

function getBars(tab: TAnalyticsDetailTab, t: TTranslate): TBarItem<string>[] {
  return BAR_KEYS[tab].map((key) => ({
    key,
    label: t(`workspace_analytics.details.fields.${key}`),
    fill: BAR_COLORS[key],
    stackId: "progress",
    textClassName: "fill-primary",
  }));
}

function getChartRows(
  tab: TAnalyticsDetailTab,
  chart: TDetailsChartRow[] | undefined,
  t: TTranslate
): TDetailsChartItem[] {
  return (chart ?? []).map((item, index) =>
    Object.assign({}, item, {
      key: String(index),
      name:
        tab === "projects" && PROJECT_STATUS_CHART_NAMES.has(item.name)
          ? t(`workspace_analytics.details.statuses.${item.name}`)
          : item.name || t("unassigned"),
    })
  );
}

function isVerticalChart(tab: TAnalyticsDetailTab) {
  return tab === "users" || tab === "cycles" || tab === "modules";
}

function getChartHeight(tab: TAnalyticsDetailTab, chartLength: number, page: number) {
  if (isVerticalChart(tab)) return Math.max(160, Math.min(20, chartLength - page * 20) * 36 + 90);
  return 260;
}

function getSummaryGridClassName(tab: TAnalyticsDetailTab) {
  if (tab === "intake") return "-mx-2 grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6";
  if (tab === "projects" || tab === "cycles") return "-mx-2 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4";
  return "-mx-2 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-5";
}

function getDetailsEntityHref(tab: TAnalyticsDetailTab, slug: string, row: TAnalyticsDetailRow) {
  const id = row.id;
  if (tab === "projects" || tab === "intake")
    return `/${slug}/projects/${id}/${tab === "intake" ? "intake" : "issues"}/`;
  if (tab === "users" && id !== "unassigned") return `/${slug}/profile/${id}/`;
  if (tab === "cycles" || tab === "modules") return `/${slug}/projects/${row.project_id}/${tab}/${id}/`;
  return undefined;
}

function DetailsEntityIcon({
  tab,
  row,
  name,
}: {
  tab: TAnalyticsDetailTab;
  row: TAnalyticsDetailRow;
  name: string | number;
}) {
  if (tab === "users") {
    if (row.id === "unassigned") return <UserRound className="size-4 text-tertiary" />;
    return (
      <Avatar
        size="xs"
        alt={String(name)}
        fallback={String(name).slice(0, 1).toUpperCase()}
        src={getFileURL(String(row.avatar_url || ""))}
      />
    );
  }
  if (tab === "projects" || tab === "intake") return <FolderKanban className="size-4 text-tertiary" />;
  if (tab === "cycles") return <CircleDashed className="size-4 text-tertiary" />;
  return <Layers className="size-4 text-tertiary" />;
}

function DetailsNameCell({
  tab,
  slug,
  row,
  value,
  t,
}: {
  tab: TAnalyticsDetailTab;
  slug: string;
  row: TAnalyticsDetailRow;
  value: TAnalyticsDetailRow[string];
  t: TTranslate;
}) {
  const name = value || t("unassigned");
  return (
    <AnalyticsEntityCell
      name={String(name)}
      href={getDetailsEntityHref(tab, slug, row)}
      icon={<DetailsEntityIcon tab={tab} row={row} name={name} />}
    />
  );
}

function DetailsProjectCell({
  slug,
  row,
  value,
}: {
  slug: string;
  row: TAnalyticsDetailRow;
  value: TAnalyticsDetailRow[string];
}) {
  return (
    <AnalyticsEntityCell
      name={String(value || "—")}
      href={row.project_id ? `/${slug}/projects/${row.project_id}/issues/` : undefined}
      icon={<FolderKanban className="size-4 text-tertiary" />}
    />
  );
}

function DetailsLeadCell({
  slug,
  row,
  value,
}: {
  slug: string;
  row: TAnalyticsDetailRow;
  value: TAnalyticsDetailRow[string];
}) {
  if (!value) return <span className="text-tertiary">—</span>;
  return (
    <AnalyticsEntityCell
      name={String(value)}
      href={row.lead_id ? `/${slug}/profile/${row.lead_id}/` : undefined}
      icon={
        <Avatar
          size="xs"
          alt={String(value)}
          fallback={String(value).slice(0, 1).toUpperCase()}
          src={getFileURL(String(row.lead_avatar_url || ""))}
        />
      }
    />
  );
}

function DetailsCompletionCell({ value, t }: { value: TAnalyticsDetailRow[string]; t: TTranslate }) {
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
}

function DetailsDateCell({ value }: { value: TAnalyticsDetailRow[string] }) {
  if (!value) return "—";
  return (
    <Tooltip label={renderFormattedDate(String(value))}>
      <span className="whitespace-nowrap tabular-nums">{formatCompactDate(new Date(String(value)))}</span>
    </Tooltip>
  );
}

function DetailsStatusCell({ value, t }: { value: TAnalyticsDetailRow[string]; t: TTranslate }) {
  return (
    <AnalyticsEntityCell
      name={t(`workspace_analytics.details.statuses.${value}`)}
      icon={
        <ModuleStatusIcon status={String(value) as TModuleStatus} width="16px" height="16px" className="shrink-0" />
      }
    />
  );
}

function AnalyticsDetailCell({
  tab,
  slug,
  field,
  value,
  row,
  t,
}: {
  tab: TAnalyticsDetailTab;
  slug: string;
  field: string;
  value: TAnalyticsDetailRow[string];
  row: TAnalyticsDetailRow;
  t: TTranslate;
}) {
  if (field === "name") return <DetailsNameCell tab={tab} slug={slug} row={row} value={value} t={t} />;
  if (field === "project") return <DetailsProjectCell slug={slug} row={row} value={value} />;
  if (field === "lead") return <DetailsLeadCell slug={slug} row={row} value={value} />;
  if (field === "completion") return <DetailsCompletionCell value={value} t={t} />;
  if (field === "start_date" || field === "end_date") return <DetailsDateCell value={value} />;
  if (field === "status") return <DetailsStatusCell value={value} t={t} />;
  return (
    <span className={typeof value === "number" ? "block text-right tabular-nums" : ""}>
      {value || (value === 0 ? 0 : "—")}
    </span>
  );
}

function buildDetailColumns(
  tab: TAnalyticsDetailTab,
  embedded: boolean,
  slug: string,
  t: TTranslate
): ColumnDef<TInsightTableFeatures, TAnalyticsDetailRow>[] {
  return DETAIL_COLUMNS[tab]
    .filter((field) => !embedded || EMBEDDED_COLUMNS.has(field))
    .map((field) => ({
      accessorKey: field,
      header: t(`workspace_analytics.details.fields.${field}`),
      cell: ({ row }) => (
        <AnalyticsDetailCell tab={tab} slug={slug} field={field} value={row.original[field]} row={row.original} t={t} />
      ),
      meta: {
        export: {
          key: t(`workspace_analytics.details.fields.${field}`),
          value: (row) => row.original[field] ?? "",
        },
      },
    }));
}

function AnalyticsSummary({
  tab,
  summary,
  slug,
  detailsId,
  t,
}: {
  tab: TAnalyticsDetailTab;
  summary: Record<string, number>;
  slug: string;
  detailsId: string;
  t: TTranslate;
}) {
  return (
    <div className={getSummaryGridClassName(tab)}>
      {Object.entries(summary).map(([key, count]) => (
        <AnalyticsMetricCard
          key={key}
          count={count}
          unit={tab === "projects" && key === "completion" ? "%" : undefined}
          to={getSummaryTarget(tab, key, slug, detailsId)}
          label={
            tab === "cycles" && key === "completed"
              ? t("workspace_analytics.cycles_ended")
              : t(`workspace_analytics.details.fields.${key}`)
          }
          hint={t(`workspace_analytics.${tab === "projects" ? "project" : tab}_summary_hints.${key}`)}
        />
      ))}
    </div>
  );
}

function ProjectAnalyticsOverview({
  scope,
  rows,
  chart,
  selectedProject,
  onSelect,
}: {
  scope: string;
  rows: TAnalyticsDetailRow[];
  chart: TDetailsChartItem[];
  selectedProject: string | undefined;
  onSelect: (key?: string) => void;
}) {
  return (
    <>
      <CreatedVsResolved dashboard />
      <ProjectComparison key={scope} rows={rows} statuses={chart} selected={selectedProject} onSelect={onSelect} />
    </>
  );
}

function ChartPagination({
  page,
  pages,
  onChange,
  t,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  t: TTranslate;
}) {
  return (
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
          onClick={() => onChange(page - 1)}
        />
      </Tooltip>
      <Tooltip label={t("workspace_analytics.details.next")}>
        <IconButton
          variant="ghost"
          size="md"
          aria-label={t("workspace_analytics.details.next")}
          icon={<ChevronRight />}
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
        />
      </Tooltip>
    </div>
  );
}

function AnalyticsChartSection({
  tab,
  chart,
  bars,
  page,
  pages,
  onPageChange,
  t,
}: {
  tab: TAnalyticsDetailTab;
  chart: TDetailsChartItem[];
  bars: TBarItem<string>[];
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  t: TTranslate;
}) {
  return (
    <AnalyticsSectionWrapper
      title={t(`workspace_analytics.details.charts.${tab}`)}
      titleClassName="text-16"
      actions={pages > 1 ? <ChartPagination page={page} pages={pages} onChange={onPageChange} t={t} /> : undefined}
    >
      {chart.length ? (
        <div style={{ height: getChartHeight(tab, chart.length, page) }}>
          <Suspense fallback={<AnalyticsDetailsLoader />}>
            <BarChart
              className="h-full w-full"
              barSize={24}
              layout={isVerticalChart(tab) ? "vertical" : "horizontal"}
              legend={bars.length > 1 ? DETAIL_CHART_LEGEND : undefined}
              data={chart.slice(page * 20, (page + 1) * 20)}
              bars={bars}
              xAxis={{ key: "name", label: "" }}
              yAxis={{ key: "count", label: t("workspace_analytics.details.fields.count") }}
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
  );
}

function AnalyticsDetailTable({
  tab,
  embedded,
  detailsId,
  columns,
  rows,
  slug,
  t,
}: {
  tab: TAnalyticsDetailTab;
  embedded: boolean;
  detailsId: string;
  columns: ColumnDef<TInsightTableFeatures, TAnalyticsDetailRow>[];
  rows: TAnalyticsDetailRow[];
  slug: string;
  t: TTranslate;
}) {
  return (
    <div id={!embedded ? detailsId : undefined} className="scroll-mt-4">
      <DataTable
        title={
          embedded || tab === "projects"
            ? t("workspace_analytics.dashboard.project_progress")
            : t(`workspace_analytics.detail_titles.${tab}`)
        }
        columns={columns}
        data={rows}
        searchPlaceholder={t("workspace_analytics.details.records", { count: rows.length })}
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
  );
}

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
  const [selection, setSelection] = useState<TDetailsSelection>({ scope });
  if (selection.scope !== scope) setSelection({ scope });
  const selectedProject = getSelectedProject(selection, scope, data?.rows);
  const visibleRows = getVisibleRows(tab, embedded, selectedProject, data?.rows);
  const summary = getSummary(tab, data?.summary, data?.rows);
  const detailsId = getDetailsId(tab);
  const columns = useMemo<ColumnDef<TInsightTableFeatures, TAnalyticsDetailRow>[]>(
    () => buildDetailColumns(tab, embedded, slug, t),
    [slug, tab, t, embedded]
  );
  const bars = useMemo<TBarItem<string>[]>(() => getBars(tab, t), [tab, t]);
  const chart = getChartRows(tab, data?.chart, t);
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
            {!embedded && <AnalyticsSummary tab={tab} summary={summary} slug={slug} detailsId={detailsId} t={t} />}
            {!embedded && tab === "projects" && (
              <ProjectAnalyticsOverview
                scope={scope}
                rows={data?.rows ?? []}
                chart={chart}
                selectedProject={selectedProject}
                onSelect={(key) => setSelection({ scope, key })}
              />
            )}
            {!embedded && tab !== "projects" && (
              <AnalyticsChartSection
                tab={tab}
                chart={chart}
                bars={bars}
                page={page}
                pages={pages}
                onPageChange={setChartPage}
                t={t}
              />
            )}
            <AnalyticsDetailTable
              tab={tab}
              embedded={embedded}
              detailsId={detailsId}
              columns={columns}
              rows={visibleRows}
              slug={slug}
              t={t}
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
