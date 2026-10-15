import { useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, CircleMinus } from "lucide-react";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { CyclesOutline } from "@makeplane/propel/icons";
import { Select } from "@plane/blocks/select";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { useTranslation } from "@plane/i18n";
import type { TCyclePlotType, TWorkspaceActiveCycle } from "@plane/types";
import { getFileURL } from "@plane/utils";
import { CYCLE_CHART_COLORS, workspaceCycleChartData } from "./chart-data";
import { WorkspaceCycleChart } from "./cycle-chart";
import type { CycleChartSeries } from "./cycle-chart";

export function WorkspaceCycleCard({ cycle, workspaceSlug }: { cycle: TWorkspaceActiveCycle; workspaceSlug: string }) {
  const { t } = useTranslation();
  const [plotType, setPlotType] = useState<TCyclePlotType>("burndown");
  const [hidden, setHidden] = useState<Set<CycleChartSeries>>(new Set());
  const burnup = plotType === "burnup";
  const { scope, idealToday } = workspaceCycleChartData(cycle, burnup);
  const pending = Math.max(0, scope - cycle.completed_issues);
  const actual = burnup ? cycle.completed_issues : pending;
  const difference = burnup ? actual - idealToday : idealToday - actual;
  const leading = difference >= 0;
  const chartOptions = [
    { value: "burndown", label: t("web.burn_down") },
    { value: "burnup", label: t("web.burn_up") },
  ];
  const stats: { key: CycleChartSeries; label: string; count: number; badge?: boolean }[] = [
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
  const Trend = leading ? TrendingUp : TrendingDown;

  return (
    <section
      aria-label={`${cycle.project_detail.name} · ${cycle.name}`}
      className="flex min-w-0 shrink-0 flex-col gap-4 rounded-xl border border-subtle-1 bg-surface-1 p-4 text-primary"
    >
      <div className="flex items-center gap-2 px-3">
        <Logo logo={cycle.project_detail.logo_props} size={16} />
        <h2 className="text-18 leading-[1.2] font-semibold text-primary">{cycle.project_detail.name}</h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border-[0.5px] border-subtle bg-layer-1 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <CyclesOutline className="size-4 shrink-0" />
          <Link
            href={href}
            className="min-w-0 text-16 leading-[1.3] font-medium break-words text-primary hover:underline"
          >
            <h3>{cycle.name}</h3>
          </Link>
          <span className="shrink-0 text-12 leading-5 font-semibold text-placeholder">
            {t("workspace_cycles.days_remaining", { count: cycle.days_remaining })}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Avatar
            size="sm"
            src={getFileURL(cycle.owned_by_detail.avatar_url ?? "")}
            alt={cycle.owned_by_detail.display_name}
            fallback={cycle.owned_by_detail.display_name[0]?.toUpperCase()}
          />
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
      <div className="flex min-w-0 flex-col md:flex-row-reverse md:pl-page-x">
        <div className="min-w-0 flex-1">
          <div className="flex h-10 items-center gap-1 pt-2 text-13 text-secondary md:h-12 md:px-page-x">
            <Select<(typeof chartOptions)[number]>
              getValues={() => chartOptions}
              value={chartOptions.find((option) => option.value === plotType) ?? null}
              onChange={(value) => {
                if (value === "burndown" || value === "burnup") setPlotType(value);
              }}
              getOptionValue={(option) => option.value}
              getOptionLabel={(option) => option.label}
              showSearch={false}
              pinSelected={false}
            >
              <Select.Trigger
                variant="select-ghost-md"
                className="w-auto border-transparent text-13 shadow-none"
                aria-label={t("workspace_cycles.chart_type")}
              >
                <Select.Value />
              </Select.Trigger>
            </Select>
            <span className="text-tertiary">{t("workspace_cycles.for")}</span>
            <span>{t("sidebar.work_items")}</span>
          </div>
          <WorkspaceCycleChart cycle={cycle} burnup={burnup} hidden={hidden} />
        </div>
        <div className="min-w-0 py-4 text-13 leading-[1.54] md:w-[300px] md:shrink-0 md:border-r md:border-subtle-1 md:pr-6">
          <p className="text-11 leading-[1.2] font-medium text-tertiary">{t("workspace_cycles.breakdown")}</p>
          <div
            className="flex items-center justify-between gap-2 border-b border-subtle-1 py-2 text-16 leading-6 font-medium"
            style={{ color: leading ? "light-dark(#426F3B, #8FBD83)" : "light-dark(#BD5A45, #E7A091)" }}
          >
            <span className="flex items-center gap-2">
              <Trend className="size-6" />
              {t(leading ? "workspace_cycles.leading" : "workspace_cycles.lagging", { count: Math.abs(difference) })}
            </span>
            <span aria-hidden="true" className="self-end text-20 leading-[30px]">
              🏃
            </span>
          </div>
          <div className="mt-2 border-b border-subtle-1 pb-4">
            <p className="text-11 leading-[1.2] font-medium text-tertiary">{t("workspace_cycles.by_states")}</p>
            <div className="mt-1 space-y-1">
              {stats.map((stat) => (
                <button
                  key={stat.key}
                  type="button"
                  aria-pressed={!hidden.has(stat.key)}
                  onClick={() =>
                    setHidden((current) => {
                      const next = new Set(current);
                      if (next.has(stat.key)) next.delete(stat.key);
                      else next.add(stat.key);
                      return next;
                    })
                  }
                  className={`flex w-full items-center justify-between gap-3 rounded-sm p-2 text-left hover:bg-layer-1 ${hidden.has(stat.key) ? "opacity-40" : ""}`}
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
                    className={`rounded-sm px-1 font-semibold tabular-nums ${stat.badge ? "text-white" : "text-secondary"}`}
                    style={stat.badge ? { backgroundColor: CYCLE_CHART_COLORS[stat.key] } : undefined}
                  >
                    {stat.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 border-b border-subtle-1 pb-4">
            <p className="text-11 leading-[1.2] font-medium text-tertiary">{t("workspace_cycles.other_states")}</p>
            <dl className="mt-1 space-y-1">
              {[
                { key: burnup ? "pending" : "completed", count: burnup ? pending : cycle.completed_issues },
                { key: "unstarted", count: cycle.unstarted_issues },
                { key: "backlog", count: cycle.backlog_issues },
              ].map((stat) => (
                <div key={stat.key} className="flex items-center justify-between gap-3 p-2">
                  <dt>{t(`workspace_cycles.${stat.key}`)}</dt>
                  <dd className="font-semibold text-secondary tabular-nums">{stat.count}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="flex items-center gap-2 pt-2 text-11 leading-[14px] font-medium text-tertiary">
            <CircleMinus className="size-3" />
            {t("workspace_cycles.cancelled_excluded", { count: cycle.cancelled_issues })}
          </p>
        </div>
      </div>
    </section>
  );
}
