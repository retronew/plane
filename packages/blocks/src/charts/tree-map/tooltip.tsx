/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { memo } from "react";
import type { TooltipPayload } from "recharts";
import { ChartTooltipContent } from "../components/tooltip";
export const TreeMapTooltip = memo(function TreeMapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload;
}) {
  const data = payload?.[0]?.payload;
  if (!active || !data || typeof data.value !== "number") return null;
  return (
    <ChartTooltipContent
      label={
        <span className="flex items-center gap-2">
          {data.icon}
          {data.name}
        </span>
      }
      rows={[{ key: "value", label: data.label ?? data.name, value: data.value, color: data.fillColor }]}
    />
  );
});
