/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { memo } from "react";
import type { ReactNode } from "react";
import type { TooltipPayload } from "recharts";

export type ChartTooltipRow = {
  key: string;
  label: ReactNode;
  value: string | number;
  color?: string;
  muted?: boolean;
};

/** Shared by Cartesian, pie, treemap and application-specific chart tooltips. */
export function ChartTooltipContent({ label, rows }: { label?: ReactNode; rows: ChartTooltipRow[] }) {
  if (!rows.length) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none grid w-max max-w-[min(20rem,80vw)] min-w-28 gap-1.5 rounded-lg border border-subtle-1 bg-surface-1 px-2.5 py-2 text-12 shadow-raised-100"
    >
      {label !== undefined && label !== null && label !== "" && (
        <div className="font-medium break-words text-primary">{label}</div>
      )}
      <div className="grid gap-0.5">
        {rows.map((row) => (
          <div key={row.key} className="flex min-w-0 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-secondary">
              {row.color && <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: row.color }} />}
              <span className="break-words">{row.label}</span>
            </span>
            <span className="shrink-0 font-medium text-primary tabular-nums">
              {typeof row.value === "number"
                ? row.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = {
  active?: boolean;
  activeKey?: string | null;
  label: string | number | undefined;
  payload: TooltipPayload | undefined;
  itemKeys: string[];
  itemLabels: Record<string, string>;
  itemDotColors: Record<string, string>;
};
export const CustomTooltip = memo(function CustomTooltip({
  active,
  activeKey,
  label,
  payload,
  itemKeys,
  itemLabels,
  itemDotColors,
}: Props) {
  if (!active) return null;
  const rows = itemKeys.flatMap((key) => {
    const item = payload?.find((entry) => String(entry.dataKey) === key && entry.value != null && !entry.hide);
    if (!item || (typeof item.value !== "number" && typeof item.value !== "string")) return [];
    return [
      {
        key,
        label: itemLabels[key] ?? item.name ?? key,
        value: item.value,
        color: itemDotColors[key] ?? item.color,
        muted: !!activeKey && key !== activeKey,
      },
    ];
  });
  return <ChartTooltipContent label={label} rows={rows} />;
});
