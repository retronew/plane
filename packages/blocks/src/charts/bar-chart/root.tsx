import { useChartLegend } from "../components/legend-state";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import { BarChart as CoreBarChart, Bar, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import type { TooltipPayload } from "recharts";
import { useChartMotion } from "../components/motion";
import { ChartContainer } from "../components/responsive-container";
// plane imports
import { AXIS_LABEL_CLASSNAME } from "@plane/constants";
import type { TBarChartProps, TBarItem } from "@plane/types";
// local components
import { getLegendProps } from "../components/legend";
import { CustomXAxisTick, CustomYAxisTick } from "../components/tick";
import { CustomTooltip } from "../components/tooltip";
import { truncateCategoryLabel } from "../components/layout";
import { barShapeVariants, DEFAULT_BAR_FILL_COLOR } from "./bar";

type TBarShapeProps = Parameters<(typeof barShapeVariants)["bar"]>[0];

type TBarColorPayloadItem = {
  dataKey?: unknown;
  payload?: unknown;
};

const getStackData = <T extends string>(bars: TBarItem<T>[]) => {
  const stackKeys: string[] = [];
  const stackLabels: Record<string, string> = {};

  for (const bar of bars) {
    stackKeys.push(bar.key);
    stackLabels[bar.key] = bar.label;
  }

  return { stackKeys, stackLabels };
};

const isBarColorPayloadItem = (item: unknown): item is TBarColorPayloadItem =>
  typeof item === "object" && item !== null;

// get bar color dynamically based on payload
const getBarColor = <T extends string>(
  bars: TBarItem<T>[],
  payload: readonly unknown[] | undefined,
  barKey: string
) => {
  const bar = bars.find((b) => b.key === barKey);
  if (!bar) return DEFAULT_BAR_FILL_COLOR;

  if (typeof bar.fill !== "function") return bar.fill;

  const payloadItem = payload?.find(
    (item): item is TBarColorPayloadItem => isBarColorPayloadItem(item) && item.dataKey === barKey
  );
  if (!payloadItem?.payload) return DEFAULT_BAR_FILL_COLOR; // fallback color when no payload data

  try {
    return bar.fill(payloadItem.payload);
  } catch (error) {
    console.error(error);
    return DEFAULT_BAR_FILL_COLOR;
  }
};

// get all bar colors
const getAllBarColors = <T extends string>(bars: TBarItem<T>[], payload: readonly unknown[] | undefined) => {
  const colors: Record<string, string> = {};
  for (const bar of bars) {
    colors[bar.key] = getBarColor(bars, payload, bar.key);
  }
  return colors;
};

type TBarShapeRenderer = Extract<NonNullable<React.ComponentProps<typeof Bar>["shape"]>, (...args: never[]) => unknown>;
type TBarShapeRendererProps = Parameters<TBarShapeRenderer>[0];

const createBarShapeRenderer =
  <T extends string>(bar: TBarItem<T>, stackKeys: string[]): TBarShapeRenderer =>
  (shapeProps: TBarShapeRendererProps) => {
    const shapeVariant = barShapeVariants[bar.shapeVariant ?? "bar"];
    const node = shapeVariant(shapeProps as unknown as TBarShapeProps, bar, stackKeys);
    return React.isValidElement(node) ? node : <>{node}</>;
  };

const getChartMargin = (margin: TBarChartProps<string, string>["margin"]) => ({
  top: margin?.top === undefined ? 5 : margin.top,
  right: margin?.right === undefined ? 16 : margin.right,
  bottom: margin?.bottom === undefined ? 5 : margin.bottom,
  left: margin?.left === undefined ? 0 : margin.left,
});

type TBarChartAxisProps = {
  layout: "horizontal" | "vertical";
  xAxis: TBarChartProps<string, string>["xAxis"];
  yAxis: TBarChartProps<string, string>["yAxis"];
  customTicks?: TBarChartProps<string, string>["customTicks"];
  tickCount: NonNullable<TBarChartProps<string, string>["tickCount"]>;
};

function BarChartXAxis({ layout, xAxis, yAxis, customTicks, tickCount }: TBarChartAxisProps) {
  return (
    <XAxis
      height={(layout === "vertical" ? yAxis.label : xAxis.label) ? 52 : 30}
      dataKey={layout === "vertical" ? undefined : xAxis.key}
      type={layout === "vertical" ? "number" : "category"}
      domain={layout === "vertical" ? [0, "auto"] : undefined}
      allowDecimals={layout === "vertical" ? !!yAxis.allowDecimals : undefined}
      tick={(tickProps) => {
        const TickComponent = customTicks?.x || CustomXAxisTick;
        return <TickComponent {...tickProps} />;
      }}
      tickLine={false}
      axisLine={false}
      label={{
        value: layout === "vertical" ? yAxis.label : xAxis.label,
        position: "insideBottom",
        offset: 0,
        className: AXIS_LABEL_CLASSNAME,
      }}
      tickCount={tickCount.x}
    />
  );
}

function BarChartYAxis({ layout, xAxis, yAxis, customTicks, tickCount }: TBarChartAxisProps) {
  return (
    <YAxis
      width={layout === "vertical" ? 140 : yAxis.label ? 54 : 40}
      type={layout === "vertical" ? "category" : "number"}
      dataKey={layout === "vertical" ? xAxis.key : undefined}
      interval={layout === "vertical" ? 0 : undefined}
      domain={yAxis.domain}
      tickLine={false}
      axisLine={false}
      label={{
        value: layout === "vertical" ? undefined : yAxis.label,
        angle: -90,
        position: "insideLeft",
        offset: 12,
        textAnchor: "middle",
        dx: 0,
        className: AXIS_LABEL_CLASSNAME,
      }}
      tick={(tickProps) => {
        if (layout === "vertical") {
          const name = String(tickProps.payload.value);
          return (
            <g transform={`translate(${tickProps.x},${tickProps.y})`}>
              <title>{name}</title>
              <text textAnchor="end" dominantBaseline="middle" fill="var(--text-color-secondary)" fontSize={12}>
                {truncateCategoryLabel(name)}
              </text>
            </g>
          );
        }
        const TickComponent = customTicks?.y || CustomYAxisTick;
        return <TickComponent {...tickProps} />;
      }}
      tickCount={tickCount.y}
      allowDecimals={!!yAxis.allowDecimals}
    />
  );
}

type TBarChartTooltipContentProps = {
  active?: boolean;
  label?: string | number | undefined;
  payload: TooltipPayload | undefined;
};

type TBarChartTooltipContext<K extends string, T extends string> = {
  customTooltipContent: TBarChartProps<K, T>["customTooltipContent"];
  hiddenKeys: Set<string>;
  activeBar: string | null;
  visibleKeys: string[];
  stackLabels: Record<string, string>;
  bars: TBarItem<T>[];
};

const renderTooltipContent = <K extends string, T extends string>(
  tooltipProps: TBarChartTooltipContentProps,
  context: TBarChartTooltipContext<K, T>
) => {
  const { active, label, payload } = tooltipProps;
  const { customTooltipContent, hiddenKeys, activeBar, visibleKeys, stackLabels, bars } = context;

  if (customTooltipContent)
    return customTooltipContent({
      active,
      label,
      payload: payload?.filter((item) => !hiddenKeys.has(String(item.dataKey))),
    });
  return (
    <CustomTooltip
      active={active}
      label={label}
      payload={payload}
      activeKey={activeBar}
      itemKeys={visibleKeys}
      itemLabels={stackLabels}
      itemDotColors={getAllBarColors(bars, payload)}
    />
  );
};

type TBarChartBarProps<T extends string> = {
  bar: TBarItem<T>;
  layout: "horizontal" | "vertical";
  motion: ReturnType<typeof useChartMotion>;
  hidden: boolean;
  activeLegend: string | null;
  stackKeys: string[];
  bars: TBarItem<T>[];
  data: readonly unknown[];
  onMouseEnter: (barKey: string) => void;
  onMouseLeave: () => void;
};

function BarChartBar<T extends string>({
  bar,
  layout,
  motion,
  hidden,
  activeLegend,
  stackKeys,
  bars,
  data,
  onMouseEnter,
  onMouseLeave,
}: TBarChartBarProps<T>) {
  return (
    <Bar
      {...motion}
      dataKey={bar.key}
      hide={hidden}
      stackId={bar.stackId}
      opacity={!!activeLegend && activeLegend !== bar.key ? 0.1 : 1}
      shape={layout === "vertical" ? undefined : createBarShapeRenderer(bar, stackKeys)}
      className="[&_path]:transition-opacity [&_path]:duration-200"
      onMouseEnter={() => onMouseEnter(bar.key)}
      onMouseLeave={onMouseLeave}
      fill={getBarColor(bars, data, bar.key)}
    />
  );
}

export const BarChart = React.memo(function BarChart<K extends string, T extends string>(props: TBarChartProps<K, T>) {
  const {
    data,
    bars,
    xAxis,
    yAxis,
    barSize = 40,
    layout = "horizontal",
    className,
    legend,
    margin,
    tickCount = {
      x: undefined,
      y: 5,
    },
    customTicks,
    showTooltip = true,
    customTooltipContent,
  } = props;
  const motion = useChartMotion();
  // states
  const [activeBar, setActiveBar] = useState<string | null>(null);
  const legendState = useChartLegend(bars.map((item) => item.key));
  const activeLegend = legendState.activeKey;

  // derived values
  const { stackKeys, stackLabels } = useMemo(() => getStackData(bars), [bars]);

  const renderBars = useMemo(
    () =>
      bars.map((bar) => (
        <BarChartBar
          key={bar.key}
          bar={bar}
          layout={layout}
          motion={motion}
          hidden={legendState.hidden.has(bar.key)}
          activeLegend={activeLegend}
          stackKeys={stackKeys}
          bars={bars}
          data={data}
          onMouseEnter={setActiveBar}
          onMouseLeave={() => setActiveBar(null)}
        />
      )),
    [activeLegend, legendState.hidden, stackKeys, bars, data, motion, layout]
  );

  return (
    <div className={className}>
      <ChartContainer>
        <CoreBarChart
          accessibilityLayer
          layout={layout}
          data={data}
          margin={getChartMargin(margin)}
          barSize={barSize}
          className="recharts-wrapper"
        >
          <CartesianGrid
            stroke="var(--border-color-subtle)"
            strokeOpacity={0.65}
            vertical={layout === "vertical"}
            horizontal={layout !== "vertical"}
          />
          <BarChartXAxis layout={layout} xAxis={xAxis} yAxis={yAxis} customTicks={customTicks} tickCount={tickCount} />
          <BarChartYAxis layout={layout} xAxis={xAxis} yAxis={yAxis} customTicks={customTicks} tickCount={tickCount} />
          {legend && (
            <Legend
              formatter={(value) => stackLabels[value]}
              {...getLegendProps(legend, stackKeys, undefined, legendState)}
            />
          )}
          {showTooltip && (
            <Tooltip
              cursor={{
                fill: "var(--bg-layer-transparent-hover)",
                className: "bg-layer-1 cursor-pointer",
              }}
              wrapperStyle={{
                pointerEvents: "none",
              }}
              content={(tooltipProps) =>
                renderTooltipContent(tooltipProps, {
                  customTooltipContent,
                  hiddenKeys: legendState.hidden,
                  activeBar,
                  visibleKeys: legendState.visibleKeys,
                  stackLabels,
                  bars,
                })
              }
            />
          )}
          {renderBars}
        </CoreBarChart>
      </ChartContainer>
    </div>
  );
});
BarChart.displayName = "BarChart";
