/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { memo } from "react";

type TickProps = {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
  getLabel?: (value: string | number) => string;
  cx?: number | string;
  cy?: number | string;
  offset?: number;
};
const tickClassName = "fill-secondary text-11";
const labelFor = ({ payload, getLabel }: TickProps) => {
  const value = payload?.value ?? "";
  return getLabel ? getLabel(value) : String(value);
};
export const CustomXAxisTick = memo(function CustomXAxisTick(props: TickProps) {
  const label = labelFor(props);
  return (
    <g transform={`translate(${props.x ?? 0},${props.y ?? 0})`}>
      <text dy={14} textAnchor="middle" className={tickClassName}>
        <title>{label}</title>
        {label.length > 12 ? `${label.slice(0, 11)}…` : label}
      </text>
    </g>
  );
});
export const CustomYAxisTick = memo(function CustomYAxisTick({ x = 0, y = 0, payload }: TickProps) {
  const value = payload?.value ?? "";
  const label =
    typeof value === "number"
      ? new Intl.NumberFormat(undefined, {
          notation: Math.abs(value) >= 10000 ? "compact" : "standard",
          maximumFractionDigits: 1,
        }).format(value)
      : value;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dx={-6} dy={4} textAnchor="end" className={tickClassName}>
        <title>{String(value)}</title>
        {label}
      </text>
    </g>
  );
});
export const CustomRadarAxisTick = memo(function CustomRadarAxisTick(props: TickProps) {
  const { x = 0, y = 0, cx = 0, cy = 0, offset = 12 } = props;
  const dx = Number(x) - Number(cx),
    dy = Number(y) - Number(cy);
  const length = Math.hypot(dx, dy) || 1;
  return (
    <g transform={`translate(${Number(x) + (dx / length) * offset},${Number(y) + (dy / length) * offset})`}>
      <text dy={4} textAnchor="middle" className={tickClassName}>
        {labelFor(props)}
      </text>
    </g>
  );
});
