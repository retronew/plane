import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipContent, useChartLegend } from "@plane/blocks/charts";
import { CHART_SERIES_COLORS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";

export type ComparisonDatum = { key: string; name: string; value: number; color?: string };

const CHART_MARGINS = {
  horizontal: { top: 8, right: 20, left: 0, bottom: 0 },
  vertical: { top: 12, right: 8, left: -20, bottom: 0 },
};

const BAR_RADII: Record<"horizontal" | "vertical", [number, number, number, number]> = {
  horizontal: [0, 4, 4, 0],
  vertical: [4, 4, 0, 0],
};

const PERCENTAGE_DOMAIN: [number, number] = [0, 100];

const getChartHeight = (horizontal: boolean, count: number) => (horizontal ? Math.max(180, count * 34 + 45) : 256);
const getBarLayout = (horizontal: boolean): "vertical" | "horizontal" => (horizontal ? "vertical" : "horizontal");
const getChartMargin = (horizontal: boolean) => (horizontal ? CHART_MARGINS.horizontal : CHART_MARGINS.vertical);
const getXAxisType = (horizontal: boolean) => (horizontal ? "number" : "category");
const getYAxisType = (horizontal: boolean) => (horizontal ? "category" : "number");
const getXAxisDataKey = (horizontal: boolean) => (horizontal ? undefined : "name");
const getYAxisDataKey = (horizontal: boolean) => (horizontal ? "name" : undefined);
const getYAxisWidth = (horizontal: boolean) => (horizontal ? 150 : 40);
const getBarRadius = (horizontal: boolean) => (horizontal ? BAR_RADII.horizontal : BAR_RADII.vertical);
const getMaxBarSize = (horizontal: boolean) => (horizontal ? 22 : 44);
const getPercentageDomain = (axisIsHorizontal: boolean, unit: string) =>
  axisIsHorizontal && unit === "%" ? PERCENTAGE_DOMAIN : undefined;

const formatCategoryTick = (value: string | number, maxLength: number) => {
  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
};
const formatValueTick = (value: string | number, unit: string) => `${value}${unit}`;
const formatXAxisTick = (horizontal: boolean, unit: string) => (value: string | number) =>
  horizontal ? formatValueTick(value, unit) : formatCategoryTick(value, 10);
const formatYAxisTick = (horizontal: boolean, unit: string) => (value: string | number) =>
  horizontal ? formatCategoryTick(value, 14) : formatValueTick(value, unit);

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
        style={{ height: getChartHeight(horizontal, data.length) }}
        className="min-w-0 text-12 [&_.recharts-cartesian-axis-tick_text]:fill-secondary [&_:focus:not(:focus-visible)]:outline-none"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer
            data={visibleData}
            layout={getBarLayout(horizontal)}
            margin={getChartMargin(horizontal)}
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
              type={getXAxisType(horizontal)}
              dataKey={getXAxisDataKey(horizontal)}
              domain={getPercentageDomain(horizontal, unit)}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={16}
              allowDecimals={false}
              tickFormatter={formatXAxisTick(horizontal, unit)}
            />
            <YAxis
              tick={{ fill: "var(--text-color-secondary)" }}
              type={getYAxisType(horizontal)}
              dataKey={getYAxisDataKey(horizontal)}
              width={getYAxisWidth(horizontal)}
              domain={getPercentageDomain(!horizontal, unit)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
              tickFormatter={formatYAxisTick(horizontal, unit)}
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
              radius={getBarRadius(horizontal)}
              maxBarSize={getMaxBarSize(horizontal)}
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
