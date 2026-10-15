/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useMemo, useState } from "react";
import { Cell, PieChart as CorePieChart, Label, Legend, Pie, Tooltip } from "recharts";
import { useChartMotion } from "../components/motion";
import { ChartContainer } from "../components/responsive-container";
// plane imports
import type { TPieChartProps } from "@plane/types";
// local components
import { getLegendProps } from "../components/legend";
import { CustomActiveShape } from "./active-shape";
import { CustomPieChartTooltip } from "./tooltip";

export const PieChart = React.memo(function PieChart<K extends string, T extends string>(props: TPieChartProps<K, T>) {
  const {
    data,
    dataKey,
    cells,
    className,
    innerRadius,
    legend,
    margin,
    outerRadius,
    showTooltip = true,
    showLabel,
    customLabel,
    centerLabel,
    cornerRadius = 4,
    paddingAngle = 2,
    tooltipLabel,
    customTooltipContent,
  } = props;
  const motion = useChartMotion();
  // states
  const [activeLegend, setActiveLegend] = useState<string | null>(null);

  const renderCells = useMemo(
    () =>
      cells.map((cell) => (
        <Cell
          key={cell.key}
          className="transition-opacity duration-200"
          fill={cell.fill}
          opacity={!!activeLegend && activeLegend !== cell.key ? 0.1 : 1}
          style={{
            outline: "none",
          }}
        />
      )),
    [activeLegend, cells]
  );

  return (
    <div className={className}>
      <ChartContainer>
        <CorePieChart
          data={data}
          margin={{
            top: margin?.top === undefined ? 5 : margin.top,
            right: margin?.right === undefined ? 16 : margin.right,
            bottom: margin?.bottom === undefined ? 5 : margin.bottom,
            left: margin?.left === undefined ? 0 : margin.left,
          }}
        >
          <Pie
            {...motion}
            data={data}
            dataKey={dataKey}
            cx="50%"
            cy="50%"
            stroke="none"
            activeShape={<CustomActiveShape />}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            cornerRadius={cornerRadius}
            paddingAngle={paddingAngle}
            labelLine={false}
            label={
              showLabel
                ? ({ payload, ...labelProps }) => (
                    <text
                      className="text-sm font-medium transition-opacity duration-200"
                      cx={labelProps.cx}
                      cy={labelProps.cy}
                      x={labelProps.x}
                      y={labelProps.y}
                      textAnchor={labelProps.textAnchor}
                      dominantBaseline={labelProps.dominantBaseline}
                      fill="var(--text-color-secondary)"
                      opacity={!!activeLegend && activeLegend !== payload.key ? 0.1 : 1}
                    >
                      {customLabel?.(payload.count) ?? payload.count}
                    </text>
                  )
                : undefined
            }
          >
            {renderCells}
            {centerLabel && (
              <Label
                value={centerLabel.text}
                fill={centerLabel.fill}
                position="center"
                opacity={activeLegend ? 0.1 : 1}
                style={centerLabel.style}
                className={centerLabel.className}
              />
            )}
          </Pie>
          {legend && (
            <Legend
              onMouseEnter={(payload) => {
                const key = (payload.payload as { key?: string } | undefined)?.key;
                if (!key) return;
                setActiveLegend(key);
              }}
              onMouseLeave={() => setActiveLegend(null)}
              {...getLegendProps(
                legend,
                cells.map((cell) => cell.key),
                (item) => (item.payload as { key?: string } | undefined)?.key
              )}
            />
          )}
          {/* The active sector follows the tooltip's active index (recharts 3 dropped `activeIndex`), so
              the tooltip stays mounted and only renders nothing when it is turned off. */}
          {showTooltip ? (
            <Tooltip
              cursor={{
                fill: "currentColor",
                className: "bg-layer-1-hover cursor-pointer",
              }}
              wrapperStyle={{
                pointerEvents: "none",
              }}
              content={({ active, label: chartLabel, payload }) => {
                if (!active || !payload || !payload.length) return null;
                if (customTooltipContent) return customTooltipContent({ active, label: chartLabel, payload });
                const cellData = cells.find((c) => c.key === payload[0].payload.key);
                if (!cellData) return null;
                const label = tooltipLabel
                  ? typeof tooltipLabel === "function"
                    ? tooltipLabel(payload[0]?.payload?.payload)
                    : tooltipLabel
                  : dataKey;
                return <CustomPieChartTooltip dotColor={cellData.fill} label={label} payload={payload} />;
              }}
            />
          ) : (
            <Tooltip content={() => null} cursor={false} />
          )}
        </CorePieChart>
      </ChartContainer>
    </div>
  );
});
PieChart.displayName = "PieChart";
