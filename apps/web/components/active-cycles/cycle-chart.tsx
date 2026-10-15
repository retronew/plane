import { useId, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { ChartTooltipContent } from "@plane/blocks/charts";
import { getCurrentLanguage, useTranslation } from "@plane/i18n";
import type { TWorkspaceActiveCycle } from "@plane/types";
import { CYCLE_CHART_COLORS, workspaceCycleChartData } from "./chart-data";

export type CycleChartSeries = keyof typeof CYCLE_CHART_COLORS;

function CycleDateTick({
  x = 0,
  y = 0,
  payload,
  endDay,
}: {
  x?: number;
  y?: number;
  payload?: { value: number };
  endDay: number;
}) {
  const { t } = useTranslation();
  const value = Number(payload?.value ?? endDay);
  const month = new Intl.DateTimeFormat(getCurrentLanguage(), { month: "short", timeZone: "UTC" }).format(value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor={value === endDay ? "end" : "middle"} fill="var(--text-color-tertiary)" fontSize="10">
        <tspan x="0" dy="14">
          {month} {new Date(value).getUTCDate()}
        </tspan>
        {value === endDay && (
          <tspan x="0" dy="14">
            {t("workspace_cycles.end")}
          </tspan>
        )}
      </text>
    </g>
  );
}

export function CycleTooltip({
  active,
  payload,
  label,
  burnup,
}: Partial<TooltipContentProps<number, string>> & { burnup: boolean }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const labels = {
    ideal: t(burnup ? "workspace_cycles.ideal_completed_series" : "workspace_cycles.ideal_pending_series"),
    actual: t(burnup ? "workspace_cycles.completed" : "workspace_cycles.pending"),
    started: t("workspace_cycles.started"),
    scope: t("workspace_cycles.scope"),
  };
  return (
    <ChartTooltipContent
      label={new Intl.DateTimeFormat(getCurrentLanguage(), { dateStyle: "medium", timeZone: "UTC" }).format(
        Number(label)
      )}
      rows={payload
        .filter(
          (entry) =>
            typeof entry.dataKey === "string" &&
            Object.hasOwn(labels, entry.dataKey) &&
            typeof entry.value === "number" &&
            Number.isFinite(entry.value)
        )
        .map((entry) => ({
          key: String(entry.dataKey),
          label: labels[entry.dataKey as CycleChartSeries],
          value: Math.round(Number(entry.value) * 100) / 100,
          color: CYCLE_CHART_COLORS[entry.dataKey as CycleChartSeries],
        }))}
    />
  );
}

export function WorkspaceCycleChart({
  cycle,
  burnup,
  hidden,
}: {
  cycle: TWorkspaceActiveCycle;
  burnup: boolean;
  hidden: Set<CycleChartSeries>;
}) {
  const { t } = useTranslation();
  const id = useId().replace(/:/g, "");
  const [width, setWidth] = useState(700);
  const { data, scope, isAhead } = workspaceCycleChartData(cycle, burnup);
  const singleObservation = data.filter((point) => point.actual != null).length === 1;
  const today = Date.parse(cycle.today);
  const end = Math.max(data[0].timestamp + 86400000, Date.parse(cycle.chart_end_date));
  const maximum = Math.max(1, scope, ...data.map((point) => point.scope ?? 0));
  const labels = {
    ideal: t(burnup ? "workspace_cycles.ideal_completed_series" : "workspace_cycles.ideal_pending_series"),
    actual: t(burnup ? "workspace_cycles.completed" : "workspace_cycles.pending"),
    started: t("workspace_cycles.started"),
    scope: t("workspace_cycles.scope"),
  };
  const endDay = Date.parse(cycle.chart_end_date);
  const minimumGap = (end - data[0].timestamp) / (width < 400 ? 4 : 10);
  const ticks = [
    ...new Set(
      data
        .filter((_, index) => index % Math.max(1, Math.ceil(data.length / (width < 400 ? 3 : 7))) === 0)
        .map((point) => point.timestamp)
        .concat(today, endDay)
    ),
  ]
    .filter((date) => date <= end)
    .filter(
      (date) =>
        date === today ||
        date === endDay ||
        (Math.abs(date - today) >= minimumGap && Math.abs(date - endDay) >= minimumGap)
    )
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array; target is ES2022
    .sort((a, b) => a - b);

  return (
    <>
      <p className="text-12 leading-relaxed text-tertiary">
        {cycle.history_source === "manual_test"
          ? t("workspace_cycles.manual_test_history")
          : singleObservation
            ? t("workspace_cycles.snapshot_first_observation", {
                date: new Intl.DateTimeFormat(getCurrentLanguage(), { dateStyle: "medium", timeZone: "UTC" }).format(
                  data[0].timestamp
                ),
              })
            : t("workspace_cycles.snapshot_note")}
      </p>
      <section
        className="h-[320px] w-full min-w-0 text-11 md:-mb-2 md:h-[430px] [&_.recharts-cartesian-axis-tick_text]:fill-tertiary [&_:focus:not(:focus-visible)]:outline-none"
        aria-label={t(burnup ? "web.burn_up" : "web.burn_down")}
      >
        <ResponsiveContainer width="99%" height="100%" onResize={(nextWidth) => setWidth(nextWidth)}>
          <ComposedChart
            accessibilityLayer
            data={data}
            margin={{ top: 30, right: 0, bottom: 70, left: width < 400 ? 0 : 20 }}
          >
            <defs>
              <pattern
                id={`${id}-future`}
                patternUnits="userSpaceOnUse"
                width="4"
                height="8"
                patternTransform="rotate(-45 2 2)"
              >
                <path d="M -1,2 l 6,0" stroke="var(--border-color-accent-subtle)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border-color-subtle)" />
            <XAxis
              type="number"
              dataKey="timestamp"
              scale="time"
              domain={[data[0].timestamp, end]}
              ticks={ticks}
              tickLine={false}
              axisLine={{ stroke: "var(--border-color-subtle)" }}
              minTickGap={18}
              interval={0}
              tick={<CycleDateTick endDay={endDay} />}
            />
            <YAxis
              width={width < 400 ? 40 : 60}
              domain={[0, maximum]}
              allowDecimals={false}
              tickLine={false}
              axisLine={{ stroke: "var(--border-color-subtle)" }}
              tick={{ fontSize: 10 }}
              label={{
                value: t("sidebar.work_items").toLocaleUpperCase(),
                angle: -90,
                position: "insideLeft",
                offset: 12,
                style: { fontSize: 12, fill: "var(--text-color-tertiary)" },
              }}
            />
            <ReferenceArea
              x1={today}
              x2={endDay}
              y1={0}
              y2={Math.max(1, scope)}
              fill="var(--background-color-accent-subtle)"
              fillOpacity={0.5}
            />
            <ReferenceArea
              x1={today}
              x2={endDay}
              y1={0}
              y2={Math.max(1, scope)}
              fill={`url(#${id}-future)`}
              fillOpacity={0.6}
            />
            <ReferenceLine x={today} stroke="var(--text-color-secondary)" strokeWidth={1} strokeDasharray="3 3" />
            <ReferenceLine
              x={endDay}
              stroke="var(--border-color-danger-strong)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Tooltip
              filterNull
              cursor={{ stroke: "var(--text-color-tertiary)", strokeDasharray: "3 3" }}
              content={<CycleTooltip burnup={burnup} />}
            />
            <Line
              dataKey="ideal"
              name={labels.ideal}
              stroke={CYCLE_CHART_COLORS.ideal}
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              hide={hidden.has("ideal")}
              isAnimationActive={false}
            />
            <Area
              dataKey="difference"
              type="linear"
              fill={isAhead ? "var(--background-color-success-subtle)" : "var(--background-color-danger-subtle)"}
              fillOpacity={0.6}
              stroke="none"
              strokeWidth={0}
              tooltipType="none"
              legendType="none"
              connectNulls={false}
              hide={hidden.has("actual") || hidden.has("ideal")}
              isAnimationActive={false}
            />
            <Line
              dataKey="actual"
              name={labels.actual}
              type="linear"
              stroke={CYCLE_CHART_COLORS.actual}
              strokeWidth={2}
              dot={singleObservation ? { r: 3, fill: CYCLE_CHART_COLORS.actual } : false}
              connectNulls={false}
              hide={hidden.has("actual")}
              isAnimationActive={false}
            />
            <Line
              dataKey="started"
              name={labels.started}
              type="stepAfter"
              stroke={CYCLE_CHART_COLORS.started}
              strokeWidth={2}
              dot={singleObservation ? { r: 3, fill: CYCLE_CHART_COLORS.started } : false}
              connectNulls={false}
              hide={hidden.has("started")}
              isAnimationActive={false}
            />
            <Line
              dataKey="scope"
              type="stepAfter"
              name={labels.scope}
              stroke={CYCLE_CHART_COLORS.scope}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              hide={hidden.has("scope")}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
    </>
  );
}
