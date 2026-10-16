import { useChartLegend } from "../components/legend-state";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { PolarGrid, Radar, RadarChart as CoreRadarChart, PolarAngleAxis, Tooltip, Legend } from "recharts";
import { useChartMotion } from "../components/motion";
import { ChartContainer } from "../components/responsive-container";
import type { TRadarChartProps } from "@plane/types";
import { getLegendProps } from "../components/legend";
import { CustomRadarAxisTick } from "../components/tick";
import { CustomTooltip } from "../components/tooltip";

function RadarChart<T extends string, K extends string>(props: TRadarChartProps<T, K>) {
  const { data, radars, margin, showTooltip, legend, className, angleAxis } = props;

  const motion = useChartMotion();
  // states
  const legendState = useChartLegend(radars.map((item) => item.key));
  const activeLegend = legendState.activeKey;

  const { itemKeys, itemLabels, itemDotColors } = useMemo(() => {
    const keys: string[] = [];
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};

    for (const radar of radars) {
      keys.push(radar.key);
      labels[radar.key] = radar.name;
      colors[radar.key] = radar.stroke ?? radar.fill ?? "#000000";
    }
    return { itemKeys: keys, itemLabels: labels, itemDotColors: colors };
  }, [radars]);

  return (
    <div className={className}>
      <ChartContainer>
        <CoreRadarChart cx="50%" cy="50%" outerRadius="80%" data={data} margin={margin}>
          <PolarGrid stroke="var(--border-color-subtle)" />
          <PolarAngleAxis dataKey={angleAxis.key} tick={(tickProps) => <CustomRadarAxisTick {...tickProps} />} />
          {showTooltip && (
            <Tooltip
              cursor={{
                stroke: "var(--text-color-tertiary)",
                strokeWidth: 1,
              }}
              wrapperStyle={{
                pointerEvents: "none",
              }}
              content={({ active, label, payload }) => (
                <CustomTooltip
                  active={active}
                  activeKey={activeLegend}
                  label={label}
                  payload={payload}
                  itemKeys={legendState.visibleKeys}
                  itemLabels={itemLabels}
                  itemDotColors={itemDotColors}
                />
              )}
            />
          )}
          {legend && <Legend {...getLegendProps(legend, itemKeys, undefined, legendState)} />}
          {radars.map((radar) => (
            <Radar
              {...motion}
              key={radar.key}
              name={radar.name}
              dataKey={radar.key}
              opacity={activeLegend && activeLegend !== radar.key ? 0.15 : 1}
              hide={legendState.hidden.has(radar.key)}
              stroke={radar.stroke}
              fill={radar.fill}
              fillOpacity={radar.fillOpacity}
              dot={radar.dot}
            />
          ))}
        </CoreRadarChart>
      </ChartContainer>
    </div>
  );
}

export { RadarChart };
