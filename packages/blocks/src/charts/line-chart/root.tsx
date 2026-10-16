import { useChartLegend } from "../components/legend-state";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useMemo, useState } from "react";
import { CartesianGrid, LineChart as CoreLineChart, Legend, Line, Tooltip, XAxis, YAxis } from "recharts";
import { useChartMotion } from "../components/motion";
import { ChartContainer } from "../components/responsive-container";
// plane imports
import { AXIS_LABEL_CLASSNAME } from "@plane/constants";
import type { TLineChartProps } from "@plane/types";
// local components
import { getLegendProps } from "../components/legend";
import { CustomXAxisTick, CustomYAxisTick } from "../components/tick";
import { CustomTooltip } from "../components/tooltip";

export const LineChart = React.memo(function LineChart<K extends string, T extends string>(
  props: TLineChartProps<K, T>
) {
  const {
    data,
    lines,
    margin,
    xAxis,
    yAxis,
    className,
    tickCount = {
      x: undefined,
      y: 5,
    },
    customTicks,
    legend,
    showTooltip = true,
    customTooltipContent,
  } = props;
  const motion = useChartMotion();
  // states
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const legendState = useChartLegend(lines.map((item) => item.key));
  const activeLegend = legendState.activeKey;

  // derived values
  const { itemKeys, itemLabels, itemDotColors } = useMemo(() => {
    const keys: string[] = [];
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};

    for (const line of lines) {
      keys.push(line.key);
      labels[line.key] = line.label;
      colors[line.key] = line.stroke;
    }

    return { itemKeys: keys, itemLabels: labels, itemDotColors: colors };
  }, [lines]);

  const renderLines = useMemo(
    () =>
      lines.map((line) => (
        <Line
          {...motion}
          key={line.key}
          dataKey={line.key}
          hide={legendState.hidden.has(line.key)}
          type={line.smoothCurves ? "monotone" : "linear"}
          className="[&_path]:transition-opacity [&_path]:duration-200"
          opacity={!!activeLegend && activeLegend !== line.key ? 0.1 : 1}
          fill={line.fill}
          stroke={line.stroke}
          strokeWidth={2}
          strokeDasharray={line.dashedLine ? "4 4" : "none"}
          dot={
            line.showDot
              ? {
                  fill: line.fill,
                  fillOpacity: 1,
                }
              : false
          }
          activeDot={{
            stroke: line.fill,
          }}
          onMouseEnter={() => setActiveLine(line.key)}
          onMouseLeave={() => setActiveLine(null)}
        />
      )),
    [activeLegend, legendState.hidden, lines, motion]
  );

  return (
    <div className={className}>
      <ChartContainer>
        <CoreLineChart
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
            tick={(tickProps) => {
              const TickComponent = customTicks?.x || CustomXAxisTick;
              return <TickComponent {...tickProps} />;
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
              {...getLegendProps(legend, itemKeys, undefined, legendState)}
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
              content={({ active, label, payload }) => {
                if (customTooltipContent)
                  return customTooltipContent({
                    active,
                    label,
                    payload: payload?.filter((item) => !legendState.hidden.has(String(item.dataKey))),
                  });
                return (
                  <CustomTooltip
                    active={active}
                    activeKey={activeLine}
                    label={label}
                    payload={payload}
                    itemKeys={legendState.visibleKeys}
                    itemLabels={itemLabels}
                    itemDotColors={itemDotColors}
                  />
                );
              }}
            />
          )}
          {renderLines}
        </CoreLineChart>
      </ChartContainer>
    </div>
  );
});
LineChart.displayName = "LineChart";
