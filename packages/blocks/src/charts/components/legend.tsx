/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
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
  getItemKey: (item: LegendPayload) => string | undefined = (item) => `${item.dataKey}`
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
    content: <CustomLegend {...args} />,
  };
};

const CustomLegend = React.forwardRef(function CustomLegend(
  props: React.ComponentProps<"div"> &
    Pick<DefaultLegendContentProps, "payload" | "formatter" | "onClick" | "onMouseEnter" | "onMouseLeave"> &
    TChartLegend,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const { formatter, layout, onClick, onMouseEnter, onMouseLeave, payload } = props;

  if (!payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn("vertical-scrollbar scrollbar-sm flex items-center overflow-scroll px-4", {
        "max-h-full flex-col items-start py-4": layout === "vertical",
      })}
    >
      {payload.map((item, index) => (
        // Pointer-only highlighting that mirrors the chart; recharts' accessibilityLayer gives keyboard
        // users the data itself.
        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          key={item.value}
          className={cn("flex items-center gap-1.5 text-13 font-medium whitespace-nowrap text-tertiary", {
            "px-2": layout === "horizontal",
            "py-2": layout === "vertical",
            "pt-0 pl-0": index === 0,
            "pr-0 pb-0": index === payload.length - 1,
            "cursor-pointer": !!props.onClick,
          })}
          onClick={(e) => onClick?.(item, index, e)}
          onMouseEnter={(e) => onMouseEnter?.(item, index, e)}
          onMouseLeave={(e) => onMouseLeave?.(item, index, e)}
        >
          <div
            className="size-2 flex-shrink-0 rounded-xs"
            style={{
              backgroundColor: item.color,
            }}
          />
          {formatter?.(item.value, item, index) ?? (item.payload as { name?: string } | undefined)?.name}
        </div>
      ))}
    </div>
  );
});
CustomLegend.displayName = "CustomLegend";
