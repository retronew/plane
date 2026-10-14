/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@plane/utils";

/**
 * recharts 3 turns `accessibilityLayer` on by default, so a chart is keyboard focusable and a click
 * focuses one of its layers, which then wears the browser's focus ring. Keep the ring for keyboard
 * focus and drop it for pointer focus, as charts looked before.
 */
export function ChartContainer({ className, ...props }: ComponentProps<typeof ResponsiveContainer>) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      className={cn("[&_:focus:not(:focus-visible)]:outline-none", className)}
      {...props}
    />
  );
}
