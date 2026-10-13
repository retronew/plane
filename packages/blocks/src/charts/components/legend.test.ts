/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { LegendPayload } from "recharts";
import { describe, expect, it } from "vitest";
import { getLegendProps } from "./legend";

const legend = { align: "center", verticalAlign: "bottom", layout: "horizontal" } as const;

const sortWith = (itemSorter: unknown, items: LegendPayload[]) => {
  if (typeof itemSorter !== "function") throw new Error("expected an itemSorter function");
  const rank = itemSorter as (item: LegendPayload) => number;
  return items.toSorted((a, b) => rank(a) - rank(b)).map((item) => item.value);
};

describe("getLegendProps", () => {
  // recharts 3 sorts legend items alphabetically unless told otherwise; v2 kept series order.
  it("keeps series in the order the chart declares them", () => {
    const { itemSorter } = getLegendProps(legend, ["todo", "done"]);
    const items: LegendPayload[] = [
      { value: "done", dataKey: "done" },
      { value: "todo", dataKey: "todo" },
    ];

    expect(sortWith(itemSorter, items)).toEqual(["todo", "done"]);
  });

  it("orders pie slices by their slice key", () => {
    const { itemSorter } = getLegendProps(
      legend,
      ["backlog", "started", "completed"],
      (item) => (item.payload as { key?: string } | undefined)?.key
    );
    const items: LegendPayload[] = [
      { value: "Completed", dataKey: "value", payload: { key: "completed" } },
      { value: "Backlog", dataKey: "value", payload: { key: "backlog" } },
      { value: "Started", dataKey: "value", payload: { key: "started" } },
    ];

    expect(sortWith(itemSorter, items)).toEqual(["Backlog", "Started", "Completed"]);
  });
});
