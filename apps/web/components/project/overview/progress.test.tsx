/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { STATE_GROUPS } from "@plane/constants";
import { setLanguage } from "@plane/i18n";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
import type { TChart } from "@plane/types";
import { ProjectOverviewProgress } from "./progress";

const getChart = vi.hoisted(() => vi.fn());
vi.mock("@/services/analytics.service", () => ({
  AnalyticsService: class {
    getAdvanceAnalyticsCharts = getChart;
  },
}));

const chart: TChart = {
  // The API orders by key, not by workflow order. Names aren't used to identify groups.
  data: [
    { key: "backlog", name: "Backlog", count: 2 },
    { key: "cancelled", name: "Cancelled", count: 1 },
    { key: "completed", name: "Done", count: 4 },
    { key: "started", name: "In progress", count: 2 },
    { key: "unstarted", name: "Todo", count: 1 },
  ],
  schema: {},
};

beforeEach(async () => {
  getChart.mockReset();
  await setLanguage("zh-CN");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
});
afterEach(() => vi.unstubAllGlobals());

function setup(workspaceSlug = "workspace", projectId = "project") {
  const cache = new Map();
  const view = (slug: string, id: string) => (
    <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false, dedupingInterval: 0 }}>
      <ProjectOverviewProgress workspaceSlug={slug} projectId={id} />
    </SWRConfig>
  );
  const result = render(view(workspaceSlug, projectId));
  return { ...result, changeProject: (slug: string, id: string) => result.rerender(view(slug, id)) };
}

function legendData() {
  return screen.getAllByRole("term").map((term) => ({
    label: term.textContent,
    values: Array.from(term.nextElementSibling!.children, (element) => element.textContent),
  }));
}

it("requests the project-scoped STATE_GROUPS count chart with the real service arguments", async () => {
  getChart.mockResolvedValue(chart);
  setup();
  await screen.findByRole("figure", { name: "进度" });
  expect(getChart).toHaveBeenCalledWith(
    "workspace",
    "custom-work-items",
    {
      project_ids: "project",
      x_axis: ChartXAxisProperty.STATE_GROUPS,
      y_axis: ChartYAxisMetric.WORK_ITEM_COUNT,
    },
    true
  );
});

it("reads keyed rows and renders all five groups in workflow order with counts and shares", async () => {
  getChart.mockResolvedValue(chart);
  setup();
  const bar = await screen.findByRole("figure", { name: "进度" });
  expect(legendData()).toEqual([
    { label: "待办", values: ["2", "20%"] },
    { label: "未开始", values: ["1", "10%"] },
    { label: "进行中", values: ["2", "20%"] },
    { label: "已完成", values: ["4", "40%"] },
    { label: "已取消", values: ["1", "10%"] },
  ]);
  const segments = within(bar).getAllByRole("button");
  expect(segments.map((segment) => segment.getAttribute("aria-label"))).toEqual([
    "待办 · 2 · 20%",
    "未开始 · 1 · 10%",
    "进行中 · 2 · 20%",
    "已完成 · 4 · 40%",
    "已取消 · 1 · 10%",
  ]);
  const weights = segments.map((segment) => Number(segment.style.flexGrow));
  expect(weights.map((weight) => weight / weights.reduce((sum, value) => sum + value, 0))).toEqual([
    0.2, 0.1, 0.2, 0.4, 0.1,
  ]);
  expect(bar.classList.contains("gap-0.5")).toBe(true);
  for (const [index, key] of (["backlog", "unstarted", "started", "completed", "cancelled"] as const).entries()) {
    const segment = segments[index];
    expect(segment.classList.contains("basis-0")).toBe(true);
    expect(segment.tabIndex).toBe(0);
    const fill = segment.firstElementChild as HTMLElement;
    expect(fill.classList.contains("h-3.5")).toBe(true);
    const color = document.createElement("span");
    color.style.backgroundColor = `color-mix(in srgb, ${STATE_GROUPS[key].color} 35%, var(--bg-surface-1))`;
    expect(fill.style.backgroundColor).toBe(color.style.backgroundColor);
  }
  const legend = screen.getByLabelText("状态组");
  expect(legend.tagName).toBe("DL");
  expect(legend.classList.contains("grid-cols-2")).toBe(true);
  expect(legend.classList.contains("sm:grid-cols-5")).toBe(true);
  expect(legend.querySelectorAll("dt svg")).toHaveLength(5);
});

it("fills missing groups with zero and does not allocate them a bar segment", async () => {
  getChart.mockResolvedValue({ data: [{ key: "completed", name: "Done", count: 3 }], schema: {} });
  setup();
  const bar = await screen.findByRole("figure", { name: "进度" });
  expect(legendData().map(({ values }) => values)).toEqual([
    ["0", "0%"],
    ["0", "0%"],
    ["0", "0%"],
    ["3", "100%"],
    ["0", "0%"],
  ]);
  expect(within(bar).getAllByRole("button")).toHaveLength(1);
  expect(within(bar).getByRole("button", { name: "已完成 · 3 · 100%" })).toBeTruthy();
});

it("rounds percentage labels while preserving the exact proportions in segment weights", async () => {
  getChart.mockResolvedValue({
    data: chart.data.slice(0, 3).map(({ key, name }) => ({ key, name, count: 1 })),
    schema: {},
  });
  setup();
  const bar = await screen.findByRole("figure", { name: "进度" });
  expect(legendData().map(({ values }) => values[1])).toEqual(["33%", "0%", "0%", "33%", "33%"]);
  expect(
    within(bar)
      .getAllByRole("button")
      .map((segment) => segment.style.flexGrow)
  ).toEqual(["1", "1", "1"]);
});

it.each<TChart>([
  { data: [], schema: {} },
  { data: chart.data.map(({ key, name }) => ({ key, name, count: 0 })), schema: {} },
])("shows a successful empty response separately from loading or an error (%j)", async (emptyChart) => {
  getChart.mockResolvedValue(emptyChart);
  setup();
  expect(await screen.findByText("暂无数据")).toBeTruthy();
  expect(screen.queryByRole("figure", { name: "进度" })).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByLabelText("加载中")).toBeNull();
  expect(legendData().map(({ values }) => values)).toEqual(Array.from({ length: 5 }, () => ["0", "0%"]));
});

it("exposes a loading status without fabricating zeros while the request is pending", async () => {
  let resolveChart!: (value: TChart) => void;
  getChart.mockReturnValue(
    new Promise<TChart>((resolve) => {
      resolveChart = resolve;
    })
  );
  setup();
  expect(screen.getByRole("status", { name: "加载中" }).getAttribute("aria-busy")).toBe("true");
  expect(screen.queryByRole("term")).toBeNull();
  expect(screen.queryByText("暂无数据")).toBeNull();
  resolveChart(chart);
  expect(await screen.findByRole("figure", { name: "进度" })).toBeTruthy();
  expect(screen.queryByLabelText("加载中")).toBeNull();
});

it.each([new Error("network failed"), { detail: "Forbidden" }, undefined])(
  "shows a request failure instead of zero counts even for a rejection with no body (%j)",
  async (error) => {
    getChart.mockRejectedValue(error);
    setup();
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("暂时无法加载分析数据，请重试")
    );
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
    expect(screen.queryByRole("term")).toBeNull();
    expect(screen.queryByText("暂无数据")).toBeNull();
    expect(screen.queryByRole("figure", { name: "进度" })).toBeNull();
  }
);

it("retries a failed request and replaces the error with the returned counts", async () => {
  getChart.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(chart);
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "重试" }));
  await screen.findByRole("figure", { name: "进度" });
  expect(getChart).toHaveBeenCalledTimes(2);
  expect(getChart.mock.calls[1]).toEqual(getChart.mock.calls[0]);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(legendData()[3]).toEqual({ label: "已完成", values: ["4", "40%"] });
});

it.each([
  undefined,
  { schema: { completed: "4" } },
  { data: [{ key: "completed", name: "Done", count: "4" }], schema: {} },
  { data: [{ key: "completed", name: "Done", count: -1 }], schema: {} },
  { data: [{ key: "unknown", name: "Unknown", count: 2 }], schema: {} },
])("does not silently display invalid chart responses as empty or successful data (%j)", async (invalidChart) => {
  getChart.mockResolvedValue(invalidChart);
  setup();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("term")).toBeNull();
  expect(screen.queryByText("暂无数据")).toBeNull();
});

it("isolates the SWR cache by workspace and project", async () => {
  getChart.mockResolvedValueOnce(chart).mockResolvedValue({ data: [], schema: {} });
  const { changeProject } = setup();
  await screen.findByRole("figure", { name: "进度" });
  changeProject("workspace", "other-project");
  expect(await screen.findByText("暂无数据")).toBeTruthy();
  expect(getChart.mock.calls[1][2].project_ids).toBe("other-project");
  changeProject("other-workspace", "other-project");
  await waitFor(() => expect(getChart).toHaveBeenCalledTimes(3));
  expect(getChart.mock.calls[2][0]).toBe("other-workspace");
});

it("shows a tooltip on hover", async () => {
  getChart.mockResolvedValue(chart);
  setup();
  const segment = await screen.findByRole("button", { name: "进行中 · 2 · 20%" });
  fireEvent.mouseEnter(segment);
  fireEvent.mouseMove(segment);
  expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", "进行中 · 2 · 20%");
  fireEvent.mouseLeave(segment);
});

it("shows a keyboard tooltip while every value remains available in the data legend", async () => {
  getChart.mockResolvedValue(chart);
  setup();
  const segment = await screen.findByRole("button", { name: "已完成 · 4 · 40%" });
  fireEvent.focus(segment);
  expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", "已完成 · 4 · 40%");
  expect(legendData()[3]).toEqual({ label: "已完成", values: ["4", "40%"] });
  fireEvent.blur(segment);
});
