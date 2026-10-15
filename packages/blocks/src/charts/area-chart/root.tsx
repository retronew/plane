/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useMemo, useState } from "react";
import { Area, Legend, Tooltip, XAxis, YAxis, Line, ComposedChart, CartesianGrid } from "recharts";
import { useChartMotion } from "../components/motion";
import { ChartContainer } from "../components/responsive-container";
// plane imports
import { AXIS_LABEL_CLASSNAME } from "@plane/constants";
import type { TAreaChartProps } from "@plane/types";
// local components
import { getLegendProps } from "../components/legend";
import { CustomXAxisTick, CustomYAxisTick } from "../components/tick";
import { CustomTooltip } from "../components/tooltip";

export const AreaChart = React.memo(function AreaChart<K extends string, T extends string>(
  props: TAreaChartProps<K, T>
) {
  const {
    data,
    areas,
    xAxis,
    yAxis,
    className,
    legend,
    margin,
    tickCount = {
      x: undefined,
      y: 5,
    },
    customTicks,
    showTooltip = true,
    comparisonLine,
  } = props;
  const motion = useChartMotion();
  // states
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeLegend, setActiveLegend] = useState<string | null>(null);

  // derived values
  const { itemKeys, itemLabels, itemDotColors } = useMemo(() => {
    const keys: string[] = [];
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};

    for (const area of areas) {
      keys.push(area.key);
      labels[area.key] = area.label;
      colors[area.key] = area.strokeColor || area.fill;
    }

    return { itemKeys: keys, itemLabels: labels, itemDotColors: colors };
  }, [areas]);

  const renderAreas = useMemo(
    () =>
      areas.map((area) => (
        <Area
          {...motion}
          key={area.key}
          type={area.smoothCurves ? "monotone" : "linear"}
          dataKey={area.key}
          stackId={area.stackId}
          fill={area.fill}
          opacity={!!activeLegend && activeLegend !== area.key ? 0.1 : 1}
          fillOpacity={area.fillOpacity}
          strokeOpacity={area.strokeOpacity}
          stroke={area.strokeColor}
          strokeWidth={2}
          style={area.style}
          dot={
            area.showDot
              ? {
                  fill: area.fill,
                  fillOpacity: 1,
                }
              : false
          }
          activeDot={{
            r: 3,
            fill: area.strokeColor,
            stroke: "var(--bg-surface-1)",
            strokeWidth: 2,
          }}
          onMouseEnter={() => setActiveArea(area.key)}
          onMouseLeave={() => setActiveArea(null)}
          className="[&_path]:transition-opacity [&_path]:duration-200"
        />
      )),
    [activeLegend, areas, motion]
  );

  // create comparison line data for straight line from origin to last point
  const comparisonLineData = useMemo(() => {
    if (!data || data.length === 0) return [];
    // get the last data point
    const lastPoint = data[data.length - 1];
    // for the y-value in the last point, use its yAxis key value
    const lastYValue = lastPoint[yAxis.key] ?? 0;
    // create data for a straight line that has points at each x-axis position
    return data.map((item, index) => {
      // calculate the y value for this point on the straight line
      // using linear interpolation between (0,0) and (last_x, last_y)
      const ratio = data.length === 1 ? 1 : index / (data.length - 1);
      const interpolatedValue = ratio * lastYValue;

      return {
        [xAxis.key]: item[xAxis.key],
        comparisonLine: interpolatedValue,
      };
    });
  }, [data, xAxis.key, yAxis.key]);
  return (
    <div className={className}>
      <ChartContainer>
        <ComposedChart
          accessibilityLayer
          data={data}
          margin={{
            top: margin?.top === undefined ? 5 : margin.top,
            right: margin?.right === undefined ? 16 : margin.right,
            bottom: margin?.bottom === undefined ? 5 : margin.bottom,
            left: margin?.left === undefined ? 0 : margin.left,
          }}
        >
          <CartesianGrid stroke="var(--border-color-subtle)" strokeOpacity={0.65} vertical={false} />
          <XAxis
            height={xAxis.label ? 52 : 30}
            dataKey={xAxis.key}
            type={xAxis.type}
            scale={xAxis.scale}
            domain={xAxis.domain}
            tick={(tickProps) => {
              const TickComponent = customTicks?.x || CustomXAxisTick;
              return (
                <TickComponent
                  {...tickProps}
                  payload={{
                    ...tickProps.payload,
                    value: xAxis.tickFormatter ? xAxis.tickFormatter(tickProps.payload.value) : tickProps.payload.value,
                  }}
                />
              );
            }}
            tickLine={false}
            axisLine={false}
            label={
              xAxis.label && {
                value: xAxis.label,
                position: "insideBottom",
                offset: 0,
                className: AXIS_LABEL_CLASSNAME,
              }
            }
            tickCount={tickCount.x}
          />
          <YAxis
            width={yAxis.label ? 54 : 40}
            domain={yAxis.domain}
            tickLine={false}
            axisLine={false}
            label={
              yAxis.label && {
                value: yAxis.label,
                angle: -90,
                position: "insideLeft",
                offset: 12,
                textAnchor: "middle",
                dx: 0,
                className: AXIS_LABEL_CLASSNAME,
              }
            }
            tick={(tickProps) => {
              const TickComponent = customTicks?.y || CustomYAxisTick;
              return <TickComponent {...tickProps} />;
            }}
            tickCount={tickCount.y}
            allowDecimals={!!yAxis.allowDecimals}
          />
          {legend && (
            <Legend
              formatter={(value) => itemLabels[value]}
              onMouseEnter={(payload) => setActiveLegend(payload.value ?? null)}
              onMouseLeave={() => setActiveLegend(null)}
              {...getLegendProps(legend, itemKeys)}
            />
          )}
          {showTooltip && (
            <Tooltip
              cursor={{
                stroke: "var(--text-color-tertiary)",
                strokeWidth: 1,
              }}
              wrapperStyle={{
                pointerEvents: "none",
              }}
              content={({ active, label, payload }) =>
                active && payload?.length ? (
                  <CustomTooltip
                    active={active}
                    activeKey={activeArea}
                    label={
                      xAxis.tickFormatter && label != null && Number.isFinite(Number(label))
                        ? xAxis.tickFormatter(Number(label))
                        : label
                    }
                    payload={payload}
                    itemKeys={itemKeys}
                    itemLabels={itemLabels}
                    itemDotColors={itemDotColors}
                  />
                ) : null
              }
            />
          )}
          {renderAreas}
          {comparisonLine && (
            <Line
              {...motion}
              data={comparisonLineData}
              type="linear"
              dataKey="comparisonLine"
              stroke={comparisonLine.strokeColor}
              fill={comparisonLine.strokeColor}
              strokeWidth={2}
              strokeDasharray={comparisonLine.dashedLine ? "4 4" : "none"}
              activeDot={false}
              legendType="none"
              name="Comparison line"
            />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  );
});
AreaChart.displayName = "AreaChart";
