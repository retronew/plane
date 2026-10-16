import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipContent, useChartLegend } from "@plane/blocks/charts";
import { CHART_SERIES_COLORS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";

export type ComparisonDatum = { key: string; name: string; value: number; color?: string };

/** Shared interactive comparison chart for project analytics. */
export function ComparisonChart({
  data,
  label,
  selected,
  onSelect,
  unit = "",
  horizontal = false,
}: {
  data: ComparisonDatum[];
  label: string;
  unit?: string;
  horizontal?: boolean;
  selected?: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string>();
  const legendState = useChartLegend(data.map((item) => item.key));
  const visibleData = data.filter((item) => !legendState.hidden.has(item.key));
  const highlighted = legendState.activeKey ?? active;
  if (!data.length)
    return <div className="grid h-56 place-items-center text-13 text-tertiary">{t("common.no_data_available")}</div>;
  return (
    <div className="min-w-0 space-y-3">
      <div
        style={{ height: horizontal ? Math.max(180, data.length * 34 + 45) : 256 }}
        className="min-w-0 text-12 [&_.recharts-cartesian-axis-tick_text]:fill-secondary [&_:focus:not(:focus-visible)]:outline-none"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer
            data={visibleData}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={
              horizontal ? { top: 8, right: 20, left: 0, bottom: 0 } : { top: 12, right: 8, left: -20, bottom: 0 }
            }
            onMouseLeave={() => setActive(undefined)}
          >
            <CartesianGrid
              vertical={horizontal}
              horizontal={!horizontal}
              stroke="var(--border-color-subtle-1)"
              strokeDasharray="3 3"
            />
            <XAxis
              tick={{ fill: "var(--text-color-secondary)" }}
              type={horizontal ? "number" : "category"}
              dataKey={horizontal ? undefined : "name"}
              domain={horizontal && unit === "%" ? [0, 100] : undefined}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={16}
              allowDecimals={false}
              tickFormatter={(value: string | number) =>
                horizontal
                  ? `${value}${unit}`
                  : String(value).length > 10
                    ? `${String(value).slice(0, 10)}…`
                    : String(value)
              }
            />
            <YAxis
              tick={{ fill: "var(--text-color-secondary)" }}
              type={horizontal ? "category" : "number"}
              dataKey={horizontal ? "name" : undefined}
              width={horizontal ? 150 : 40}
              domain={!horizontal && unit === "%" ? [0, 100] : undefined}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
              tickFormatter={(value: string | number) =>
                horizontal
                  ? String(value).length > 14
                    ? `${String(value).slice(0, 14)}…`
                    : String(value)
                  : `${value}${unit}`
              }
            />
            <Tooltip
              cursor={{ fill: "var(--border-subtle)", radius: 6 }}
              content={({ active: visible, payload }) => {
                const item = payload?.[0]?.payload as ComparisonDatum | undefined;
                return visible && item ? (
                  <ChartTooltipContent
                    label={item.name}
                    rows={[
                      {
                        key: "value",
                        label,
                        value: unit ? `${item.value}${unit}` : item.value,
                        color: item.color ?? CHART_SERIES_COLORS[0],
                      },
                    ]}
                  />
                ) : null;
              }}
            />
            <Bar
              dataKey="value"
              name={label}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={horizontal ? 22 : 44}
              isAnimationActive={false}
              onClick={(item) => onSelect(String(item.key))}
              onMouseEnter={(item) => setActive(String(item.key))}
            >
              {visibleData.map((item) => (
                <Cell
                  key={item.key}
                  fill={item.color ?? CHART_SERIES_COLORS[0]}
                  opacity={
                    selected && selected !== item.key ? 0.35 : highlighted && highlighted !== item.key ? 0.15 : 1
                  }
                  cursor="pointer"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {data.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={!legendState.hidden.has(item.key)}
            onClick={() => legendState.onToggle(item.key)}
            onMouseEnter={() => legendState.onHover(item.key)}
            onMouseLeave={() => legendState.onHover(null)}
            onFocus={() => legendState.onHover(item.key)}
            onBlur={() => legendState.onHover(null)}
            className="flex max-w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-12 text-secondary hover:bg-layer-transparent-hover aria-[pressed=false]:line-through aria-[pressed=false]:opacity-40"
          >
            <span
              className="size-2 shrink-0 rounded-xs"
              style={{ backgroundColor: item.color ?? CHART_SERIES_COLORS[0] }}
            />
            <span className="max-w-48 truncate" title={item.name}>
              {item.name}
            </span>
            <span className="text-tertiary tabular-nums">
              {item.value}
              {unit}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
