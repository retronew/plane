/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import type { ChartLegendState } from "./legend-state";
import type { DefaultLegendContentProps, LegendPayload, LegendProps } from "recharts";
// plane imports
import type { TChartLegend } from "@plane/types";
import { cn } from "@plane/utils";

/**
 * @param order the series keys in the order the chart declares them. recharts 3 sorts legend items
 * alphabetically by default (v2 kept render order), so the legend is pinned back to this order.
 * @param getItemKey reads an item's key; series charts key by `dataKey`, the pie by its slice key.
 */
export const getLegendProps = (
  args: TChartLegend,
  order: readonly string[],
  getItemKey: (item: LegendPayload) => string | undefined = (item) => `${item.dataKey}`,
  interaction?: ChartLegendState
): LegendProps => {
  const { align, layout, verticalAlign } = args;
  return {
    itemSorter: (item) => order.indexOf(getItemKey(item) ?? ""),
    layout,
    align,
    verticalAlign,
    wrapperStyle: {
      display: "flex",
      overflow: "hidden",
      ...(layout === "vertical"
        ? {
            top: 0,
            alignItems: "center",
            height: "100%",
          }
        : {
            left: 0,
            bottom: 0,
            width: "100%",
            justifyContent: "center",
          }),
      ...args.wrapperStyles,
    },
    content: <CustomLegend {...args} interaction={interaction} getItemKey={getItemKey} />,
  };
};

export function ChartLegend({
  items,
  interaction,
  vertical = false,
}: {
  items: { key: string; label: React.ReactNode; color?: string }[];
  interaction: ChartLegendState;
  vertical?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2",
        vertical && "max-h-full flex-col items-start py-4"
      )}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={!interaction.hidden.has(item.key)}
          className="flex items-center gap-1.5 rounded-sm text-12 whitespace-nowrap text-secondary transition-opacity hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong aria-[pressed=false]:opacity-40"
          onClick={() => interaction.onToggle(item.key)}
          onMouseEnter={() => interaction.onHover(item.key)}
          onMouseLeave={() => interaction.onHover(null)}
          onFocus={() => interaction.onHover(item.key)}
          onBlur={() => interaction.onHover(null)}
        >
          <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: item.color }} />
          <span className={interaction.hidden.has(item.key) ? "line-through" : undefined}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function CustomLegend(
  props: Pick<DefaultLegendContentProps, "payload" | "formatter"> &
    TChartLegend & {
      interaction?: ChartLegendState;
      getItemKey: (item: LegendPayload) => string | undefined;
    }
) {
  const { payload, formatter, interaction, getItemKey, layout } = props;
  if (!payload?.length) return null;
  const items = payload.map((item, index) => ({
    key: getItemKey(item) ?? String(item.value),
    color: item.color,
    label: formatter?.(item.value, item, index) ?? (item.payload as { name?: string } | undefined)?.name ?? item.value,
  }));
  if (interaction) return <ChartLegend items={items} interaction={interaction} vertical={layout === "vertical"} />;
  return (
    <div className="flex flex-wrap justify-center gap-4 py-2">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5 text-12 text-secondary">
          <span className="size-2 rounded-xs" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
