/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo, useState } from "react";
import { BarChart as CoreBarChart, Bar, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import { useChartMotion } from "../components/motion";
import { ChartContainer } from "../components/responsive-container";
// plane imports
import { AXIS_LABEL_CLASSNAME } from "@plane/constants";
import type { TBarChartProps } from "@plane/types";
// local components
import { getLegendProps } from "../components/legend";
import { CustomXAxisTick, CustomYAxisTick } from "../components/tick";
import { CustomTooltip } from "../components/tooltip";
import { truncateCategoryLabel } from "../components/layout";
import { barShapeVariants, DEFAULT_BAR_FILL_COLOR } from "./bar";

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
  const [activeLegend, setActiveLegend] = useState<string | null>(null);

  // derived values
  const { stackKeys, stackLabels } = useMemo(() => {
    const keys: string[] = [];
    const labels: Record<string, string> = {};

    for (const bar of bars) {
      keys.push(bar.key);
      labels[bar.key] = bar.label;
    }

    return { stackKeys: keys, stackLabels: labels };
  }, [bars]);

  // get bar color dynamically based on payload
  const getBarColor = useCallback(
    (payload: readonly Record<string, string>[], barKey: string) => {
      const bar = bars.find((b) => b.key === barKey);
      if (!bar) return DEFAULT_BAR_FILL_COLOR;

      if (typeof bar.fill === "function") {
        const payloadItem = payload?.find((item) => item.dataKey === barKey);
        if (payloadItem?.payload) {
          try {
            return bar.fill(payloadItem.payload);
          } catch (error) {
            console.error(error);
            return DEFAULT_BAR_FILL_COLOR;
          }
        } else {
          return DEFAULT_BAR_FILL_COLOR; // fallback color when no payload data
        }
      } else {
        return bar.fill;
      }
    },
    [bars]
  );

  // get all bar colors
  const getAllBarColors = useCallback(
    (payload: readonly any[]) => {
      const colors: Record<string, string> = {};
      for (const bar of bars) {
        colors[bar.key] = getBarColor(payload, bar.key);
      }
      return colors;
    },
    [bars, getBarColor]
  );

  const renderBars = useMemo(
    () =>
      bars.map((bar) => (
        <Bar
          {...motion}
          key={bar.key}
          dataKey={bar.key}
          stackId={bar.stackId}
          opacity={!!activeLegend && activeLegend !== bar.key ? 0.1 : 1}
          shape={
            layout === "vertical"
              ? undefined
              : (shapeProps: any) => {
                  const shapeVariant = barShapeVariants[bar.shapeVariant ?? "bar"];
                  const node = shapeVariant(shapeProps, bar, stackKeys);
                  return React.isValidElement(node) ? node : <>{node}</>;
                }
          }
          className="[&_path]:transition-opacity [&_path]:duration-200"
          onMouseEnter={() => setActiveBar(bar.key)}
          onMouseLeave={() => setActiveBar(null)}
          fill={getBarColor(data, bar.key)}
        />
      )),
    [activeLegend, stackKeys, bars, getBarColor, data, motion, layout]
  );

  return (
    <div className={className}>
      <ChartContainer>
        <CoreBarChart
          accessibilityLayer
          layout={layout}
          data={data}
          margin={{
            top: margin?.top === undefined ? 5 : margin.top,
            right: margin?.right === undefined ? 16 : margin.right,
            bottom: margin?.bottom === undefined ? 5 : margin.bottom,
            left: margin?.left === undefined ? 0 : margin.left,
          }}
          barSize={barSize}
          className="recharts-wrapper"
        >
          <CartesianGrid
            stroke="var(--border-color-subtle)"
            strokeOpacity={0.65}
            vertical={layout === "vertical"}
            horizontal={layout !== "vertical"}
          />
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
          {legend && (
            <Legend
              onMouseEnter={(payload) => setActiveLegend(payload.value ?? null)}
              onMouseLeave={() => setActiveLegend(null)}
              formatter={(value) => stackLabels[value]}
              {...getLegendProps(legend, stackKeys)}
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
              content={({ active, label, payload }) => {
                if (customTooltipContent) return customTooltipContent({ active, label, payload });
                return (
                  <CustomTooltip
                    active={active}
                    label={label}
                    payload={payload}
                    activeKey={activeBar}
                    itemKeys={stackKeys}
                    itemLabels={stackLabels}
                    itemDotColors={getAllBarColors(payload || [])}
                  />
                );
              }}
            />
          )}
          {renderBars}
        </CoreBarChart>
      </ChartContainer>
    </div>
  );
});
BarChart.displayName = "BarChart";
