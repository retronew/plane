/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { memo } from "react";
import type { TooltipPayload } from "recharts";
import { ChartTooltipContent } from "../components/tooltip";
export const CustomPieChartTooltip = memo(function CustomPieChartTooltip({
  dotColor,
  label,
  payload,
}: {
  dotColor?: string;
  label: string;
  payload: TooltipPayload;
}) {
  return (
    <ChartTooltipContent
      label={label}
      rows={payload.flatMap((item, index) =>
        item.value == null || (typeof item.value !== "number" && typeof item.value !== "string")
          ? []
          : [{ key: String(item.dataKey ?? index), label: item.name, value: item.value, color: dotColor }]
      )}
    />
  );
});
