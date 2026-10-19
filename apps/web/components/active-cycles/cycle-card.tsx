import { lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, CircleMinus, Minus, type LucideIcon } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { Select } from "@plane/blocks/select";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { useTranslation } from "@plane/i18n";
import type { TCyclePlotType, TWorkspaceActiveCycle } from "@plane/types";
import { getProgress } from "@plane/utils";
import { CYCLE_CHART_COLORS, workspaceCycleChartData } from "./chart-data";
import type { CycleChartSeries } from "./cycle-chart";
import { CycleProgressIcon } from "./cycle-progress-icon";

// recharts is a large dependency; the chart loads when a card renders.
const WorkspaceCycleChart = lazy(() => import("./cycle-chart").then((mod) => ({ default: mod.WorkspaceCycleChart })));

export type CycleCardData = Omit<TWorkspaceActiveCycle, "owned_by_detail" | "completion_chart">;

type Translate = ReturnType<typeof useTranslation>["t"];
type CycleStatus = "leading" | "lagging" | "on_track";
type CycleStat = { key: CycleChartSeries; label: string; count: number; badge?: boolean };
type ChartOption = { value: TCyclePlotType; label: string; description: string };

const STATUS_COLORS: Record<CycleStatus, string> = {
  on_track: "var(--text-color-secondary)",
  leading: "light-dark(#426F3B, #8FBD83)",
  lagging: "light-dark(#BD5A45, #E7A091)",
};

const STATUS_ICONS: Record<CycleStatus, LucideIcon> = {
  leading: TrendingUp,
  lagging: TrendingDown,
  on_track: Minus,
};

function getCycleStatus(difference: number): CycleStatus {
  if (difference > 0) return "leading";
  if (difference < 0) return "lagging";
  return "on_track";
}

function getStatusLabel(status: CycleStatus, difference: number, t: Translate) {
  if (status === "on_track") return t("workspace_cycles.on_track");
  return t(`workspace_cycles.${status}`, { count: Math.abs(difference) });
}

function toggleSeries(current: Set<CycleChartSeries>, key: CycleChartSeries) {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function ProjectHeader({ cycle }: { cycle: CycleCardData }) {
  return (
    <div className="flex min-h-6 items-center gap-2">
      <Logo logo={cycle.project_detail.logo_props} size={16} />
      <h2 className="min-w-0 text-16 leading-6 font-semibold break-words text-primary">{cycle.project_detail.name}</h2>
    </div>
  );
}

function CycleActionHeader({
  cycle,
  href,
  progress,
  t,
}: {
  cycle: CycleCardData;
  href: string;
  progress: number;
  t: Translate;
}) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-subtle bg-layer-1 px-3 py-2">
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
        <CycleProgressIcon value={progress} />
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link href={href} className="min-w-0 text-14 leading-5 font-medium break-words text-primary hover:underline">
            <h3>{cycle.name}</h3>
          </Link>
          <span className="shrink-0 text-12 leading-5 whitespace-nowrap text-tertiary">
            {t("workspace_cycles.days_remaining", { count: cycle.days_remaining })}
          </span>
        </div>
      </div>
      <div className="ml-auto shrink-0">
        <Button
          stretch="auto"
          nativeButton={false}
          render={<Link href={href} />}
          variant="secondary"
          size="sm"
          label={t("workspace_cycles.view_cycle")}
        />
      </div>
    </div>
  );
}

function PlotTypeSelect({
  chartOptions,
  plotType,
  onChange,
  t,
}: {
  chartOptions: ChartOption[];
  plotType: TCyclePlotType;
  onChange: (value: TCyclePlotType) => void;
  t: Translate;
}) {
  return (
    <Select<ChartOption>
      getValues={() => chartOptions}
      value={chartOptions.find((option) => option.value === plotType) ?? null}
      onChange={(value) => {
        if (value === "burndown" || value === "burnup") onChange(value);
      }}
      getOptionValue={(option) => option.value}
      getOptionLabel={(option) => option.label}
      getOptionTooltip={(option) => option.description}
      showSearch={false}
      contentMinWidth={160}
      pinSelected={false}
    >
      <Select.Trigger variant="select-md" className="w-auto text-13" aria-label={t("workspace_cycles.chart_type")}>
        <Select.Value />
      </Select.Trigger>
    </Select>
  );
}

function CycleStatsList({
  stats,
  hidden,
  onToggle,
}: {
  stats: CycleStat[];
  hidden: Set<CycleChartSeries>;
  onToggle: (key: CycleChartSeries) => void;
}) {
  return (
    <div className="mt-1">
      {stats.map((stat) => {
        const isHidden = hidden.has(stat.key);
        return (
          <button
            key={stat.key}
            type="button"
            aria-pressed={!isHidden}
            onClick={() => onToggle(stat.key)}
            className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-layer-1 ${isHidden ? "opacity-40" : ""}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="w-3 border-t-2"
                style={{
                  borderColor: CYCLE_CHART_COLORS[stat.key],
                  borderStyle: stat.key === "ideal" ? "dotted" : "solid",
                }}
              />
              <span>{stat.label}</span>
            </span>
            <span
              className={`min-w-6 rounded-sm px-1 text-center text-13 leading-5 font-medium tabular-nums ${stat.badge ? "text-white" : "text-secondary"}`}
              style={stat.badge ? { backgroundColor: CYCLE_CHART_COLORS[stat.key] } : undefined}
            >
              {stat.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OtherStatesList({
  burnup,
  pending,
  completed,
  unstarted,
  backlog,
  t,
}: {
  burnup: boolean;
  pending: number;
  completed: number;
  unstarted: number;
  backlog: number;
  t: Translate;
}) {
  const rows = [
    { key: burnup ? "pending" : "completed", count: burnup ? pending : completed },
    { key: "unstarted", count: unstarted },
    { key: "backlog", count: backlog },
  ];

  return (
    <dl className="mt-1">
      {rows.map((stat) => (
        <div key={stat.key} className="flex min-h-8 items-center justify-between gap-3 px-2 py-1">
          <dt>{t(`workspace_cycles.${stat.key}`)}</dt>
          <dd className="min-w-6 px-1 text-center font-medium text-secondary tabular-nums">{stat.count}</dd>
        </div>
      ))}
    </dl>
  );
}

function CycleBreakdown({
  cycle,
  status,
  difference,
  burnup,
  pending,
  stats,
  hidden,
  onToggleSeries,
  t,
}: {
  cycle: CycleCardData;
  status: CycleStatus;
  difference: number;
  burnup: boolean;
  pending: number;
  stats: CycleStat[];
  hidden: Set<CycleChartSeries>;
  onToggleSeries: (key: CycleChartSeries) => void;
  t: Translate;
}) {
  const TrendIcon = STATUS_ICONS[status];

  return (
    <div className="min-w-0 border-t border-subtle-1 pt-4 text-13 leading-5 lg:col-start-1 lg:row-start-1 lg:border-t-0 lg:border-r lg:pt-0 lg:pr-6">
      <p className="flex min-h-9 items-center text-12 font-medium text-tertiary">{t("workspace_cycles.breakdown")}</p>
      <div
        className="flex min-h-10 items-center gap-2 border-b border-subtle-1 pb-2 text-14 leading-5 font-medium"
        style={{ color: STATUS_COLORS[status] }}
      >
        <span className="flex items-center gap-2">
          <TrendIcon className="size-4 shrink-0" aria-hidden="true" />
          {getStatusLabel(status, difference, t)}
        </span>
      </div>
      <div className="mt-3 border-b border-subtle-1 pb-3">
        <p className="text-12 leading-5 font-medium text-tertiary">{t("workspace_cycles.by_states")}</p>
        <CycleStatsList stats={stats} hidden={hidden} onToggle={onToggleSeries} />
      </div>
      <div className="mt-3 border-b border-subtle-1 pb-3">
        <p className="text-12 leading-5 font-medium text-tertiary">{t("workspace_cycles.other_states")}</p>
        <OtherStatesList
          burnup={burnup}
          pending={pending}
          completed={cycle.completed_issues}
          unstarted={cycle.unstarted_issues}
          backlog={cycle.backlog_issues}
          t={t}
        />
      </div>
      <p className="flex items-center gap-2 pt-3 text-12 leading-5 text-tertiary">
        <CircleMinus className="size-3.5 shrink-0" />
        {t("workspace_cycles.cancelled_excluded", { count: cycle.cancelled_issues })}
      </p>
    </div>
  );
}

export function WorkspaceCycleCard({
  cycle,
  workspaceSlug,
  header,
  showProject = true,
  plain = false,
}: {
  cycle: CycleCardData;
  workspaceSlug: string;
  /** Project pages can supply their existing cycle actions as the header. */
  header?: ReactNode;
  showProject?: boolean;
  /** Project cycle lists supply their own collapsible heading and page gutters. */
  plain?: boolean;
}) {
  const { t } = useTranslation();
  const [plotType, setPlotType] = useState<TCyclePlotType>("burndown");
  const [hidden, setHidden] = useState<Set<CycleChartSeries>>(new Set());
  const burnup = plotType === "burnup";
  const { scope, idealToday } = workspaceCycleChartData(cycle, burnup);
  const pending = Math.max(0, scope - cycle.completed_issues);
  const actual = burnup ? cycle.completed_issues : pending;
  const difference = burnup ? actual - idealToday : idealToday - actual;
  const status = getCycleStatus(difference);
  const progress = getProgress(cycle.completed_issues, scope);
  const chartOptions: ChartOption[] = [
    { value: "burndown", label: t("web.burn_down"), description: t("workspace_cycles.burndown_description") },
    { value: "burnup", label: t("web.burn_up"), description: t("workspace_cycles.burnup_description") },
  ];
  const stats: CycleStat[] = [
    {
      key: "ideal",
      label: t(burnup ? "workspace_cycles.ideal_completed" : "workspace_cycles.ideal_pending"),
      count: idealToday,
    },
    {
      key: "actual",
      label: t(burnup ? "workspace_cycles.completed" : "workspace_cycles.pending"),
      count: actual,
      badge: true,
    },
    { key: "started", label: t("workspace_cycles.started"), count: cycle.started_issues, badge: true },
    { key: "scope", label: t("workspace_cycles.scope"), count: scope },
  ];
  const href = `/${workspaceSlug}/projects/${cycle.project_id}/cycles/${cycle.id}/`;
  const toggleHidden = (key: CycleChartSeries) => setHidden((current) => toggleSeries(current, key));

  return (
    <section
      aria-label={`${cycle.project_detail.name} · ${cycle.name}`}
      className={
        plain
          ? "flex min-w-0 shrink-0 flex-col bg-surface-1 px-4 py-5 text-primary sm:px-6"
          : "flex min-w-0 shrink-0 flex-col gap-4 rounded-xl border border-subtle-1 bg-surface-1 p-4 text-primary sm:p-5"
      }
    >
      {showProject && <ProjectHeader cycle={cycle} />}
      {header ?? (!plain && <CycleActionHeader cycle={cycle} href={href} progress={progress} t={t} />)}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-0">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:pl-6">
          <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2 text-13 text-secondary">
            <PlotTypeSelect chartOptions={chartOptions} plotType={plotType} onChange={setPlotType} t={t} />
            <span className="flex items-center gap-1 text-12 text-tertiary">
              {t("workspace_cycles.for")} <span className="text-secondary">{t("sidebar.work_items")}</span>
            </span>
          </div>
          <Suspense fallback={<div className="h-full w-full" />}>
            <WorkspaceCycleChart cycle={cycle} burnup={burnup} hidden={hidden} />
          </Suspense>
        </div>
        <CycleBreakdown
          cycle={cycle}
          status={status}
          difference={difference}
          burnup={burnup}
          pending={pending}
          stats={stats}
          hidden={hidden}
          onToggleSeries={toggleHidden}
          t={t}
        />
      </div>
    </section>
  );
}
