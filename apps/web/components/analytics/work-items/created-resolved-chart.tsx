import { Tooltip as PropelTooltip } from "@makeplane/propel/components/tooltip";
import { CHART_SEMANTIC_COLORS } from "@plane/constants";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipContent, useChartLegend } from "@plane/blocks/charts";
import { useTranslation } from "@plane/i18n";
import type { IChartResponse } from "@plane/types";

export function CreatedResolvedChart({
  rows,
  height = 260,
  granularity = "month",
}: {
  rows: IChartResponse["data"];
  height?: number;
  granularity?: "day" | "month";
}) {
  const { t, currentLocale } = useTranslation();
  const series = [
    { key: "created_issues", label: t("web.created"), color: CHART_SEMANTIC_COLORS.primary },
    { key: "completed_issues", label: t("web.resolved"), color: CHART_SEMANTIC_COLORS.completed },
  ];
  const legendState = useChartLegend(series.map((item) => item.key));
  const month = (key: string) =>
    new Intl.DateTimeFormat(currentLocale, {
      year: "numeric",
      month: "short",
      ...(granularity === "day" ? { day: "numeric" as const } : {}),
    }).format(new Date(`${key}T00:00:00`));
  return (
    <>
      {" "}
      <div
        style={{ height }}
        className="min-w-0 text-12 [&_.recharts-cartesian-axis-tick_text]:fill-secondary [&_:focus:not(:focus-visible)]:outline-none"
        data-created-resolved-chart=""
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            barGap={4}
            barCategoryGap="24%"
            accessibilityLayer
            data={rows}
            margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
            <XAxis
              tick={{ fill: "var(--text-color-secondary)" }}
              dataKey="key"
              tickFormatter={month}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={32}
            />
            <YAxis
              tick={{ fill: "var(--text-color-secondary)" }}
              domain={[0, "auto"]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--border-subtle)", fillOpacity: 0.3 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload;
                return active && row ? (
                  <ChartTooltipContent
                    label={month(String(row.key))}
                    rows={series
                      .filter((item) => !legendState.hidden.has(item.key))
                      .map((item) => ({
                        key: item.key,
                        label: item.label,
                        value: Number(row[item.key] ?? 0),
                        color: item.color,
                      }))}
                  />
                ) : null;
              }}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                fill={item.color}
                maxBarSize={28}
                radius={[4, 4, 0, 0]}
                hide={legendState.hidden.has(item.key)}
                opacity={legendState.activeKey && legendState.activeKey !== item.key ? 0.15 : 1}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-4">
        {series.map((item) => (
          <PropelTooltip
            key={item.key}
            label={t(
              legendState.hidden.has(item.key)
                ? "workspace_analytics.dashboard.show_series"
                : "workspace_analytics.dashboard.hide_series",
              { series: item.label }
            )}
          >
            <button
              type="button"
              aria-pressed={!legendState.hidden.has(item.key)}
              className="flex items-center gap-2 rounded-sm px-2 py-1 text-12 text-secondary hover:bg-layer-transparent-hover aria-[pressed=false]:opacity-40"
              onClick={() => legendState.onToggle(item.key)}
              onMouseEnter={() => legendState.onHover(item.key)}
              onMouseLeave={() => legendState.onHover(null)}
              onFocus={() => legendState.onHover(item.key)}
              onBlur={() => legendState.onHover(null)}
            >
              <span className="size-2.5 rounded-xs" style={{ backgroundColor: item.color }} />
              {item.label}
            </button>
          </PropelTooltip>
        ))}
      </div>
    </>
  );
}
