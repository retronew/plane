import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipContent } from "@plane/blocks/charts";
import { CHART_SERIES_COLORS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";

export type PreviewDatum = { key: string; name: string; value: number; color?: string };
export const PREVIEW_COLORS = CHART_SERIES_COLORS;

/** shadcn-style Recharts composition, isolated until the preview is approved. */
export function PreviewChart({
  data,
  label,
  selected,
  onSelect,
  unit = "",
}: {
  data: PreviewDatum[];
  label: string;
  unit?: string;
  selected?: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string>();
  if (!data.length)
    return <div className="grid h-56 place-items-center text-13 text-tertiary">{t("common.no_data_available")}</div>;
  return (
    <div className="min-w-0 space-y-3">
      <div className="h-64 min-w-0 text-12 [&_.recharts-cartesian-axis-tick_text]:fill-secondary [&_:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ top: 12, right: 8, left: -20, bottom: 0 }}
            onMouseLeave={() => setActive(undefined)}
          >
            <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 3" />
            <XAxis
              tick={{ fill: "var(--text-color-secondary)" }}
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={16}
              tickFormatter={(value: string) => (value.length > 10 ? `${value.slice(0, 10)}…` : value)}
            />
            <YAxis
              tick={{ fill: "var(--text-color-secondary)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--border-subtle)", radius: 6 }}
              content={({ active: visible, payload }) => {
                const item = payload?.[0]?.payload as PreviewDatum | undefined;
                return visible && item ? (
                  <ChartTooltipContent
                    label={item.name}
                    rows={[
                      {
                        key: "value",
                        label,
                        value: unit ? `${item.value}${unit}` : item.value,
                        color: item.color ?? PREVIEW_COLORS[0],
                      },
                    ]}
                  />
                ) : null;
              }}
            />
            <Bar
              dataKey="value"
              name={label}
              radius={[5, 5, 0, 0]}
              maxBarSize={44}
              isAnimationActive={false}
              onClick={(item) => onSelect(String(item.key))}
              onMouseEnter={(item) => setActive(String(item.key))}
            >
              {data.map((item) => (
                <Cell
                  key={item.key}
                  fill={item.color ?? PREVIEW_COLORS[0]}
                  opacity={selected && selected !== item.key ? 0.35 : active && active !== item.key ? 0.7 : 1}
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
            aria-pressed={selected === item.key}
            onClick={() => onSelect(item.key)}
            className="flex max-w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-12 text-secondary hover:bg-layer-transparent-hover aria-pressed:bg-layer-2 aria-pressed:text-primary"
          >
            <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: item.color ?? PREVIEW_COLORS[0] }} />
            <span className="max-w-48 truncate" title={item.name}>
              {item.name}
            </span>
            <span className="text-tertiary tabular-nums">{item.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
