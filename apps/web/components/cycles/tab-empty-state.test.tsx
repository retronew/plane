import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { CycleTab } from "./tab-navigation";
import { CycleTabEmptyState } from "./tab-empty-state";

afterEach(async () => {
  await setLanguage("en");
});

const cases: {
  tab: CycleTab;
  en: { title: string; description: string };
  zh: { title: string; description: string };
}[] = [
  {
    tab: "active",
    en: {
      title: "No cycles in progress",
      description: "Create and schedule a cycle to start tracking your team's progress.",
    },
    zh: {
      title: "暂无进行中的周期",
      description: "创建并安排周期，开始跟踪团队的工作进度。",
    },
  },
  {
    tab: "upcoming",
    en: {
      title: "No upcoming cycles",
      description: "No upcoming cycles are scheduled. Create a new cycle to plan your team's next phase of work.",
    },
    zh: {
      title: "暂无即将到来的周期",
      description: "暂无已安排的即将到来的周期。创建新周期以规划团队的下一个工作阶段。",
    },
  },
  {
    tab: "completed",
    en: {
      title: "No completed cycles",
      description: "Completed and archived cycles will appear here with their performance metrics.",
    },
    zh: {
      title: "暂无已完成的周期",
      description: "已完成和已归档的周期将在此处显示，并附有其绩效指标。",
    },
  },
];

it.each(cases)(
  "renders the $tab empty state in English and Chinese without action buttons",
  async ({ tab, en, zh }) => {
    await setLanguage("en");
    const { container, rerender } = render(<CycleTabEmptyState tab={tab} />);
    expect(screen.getByRole("heading", { level: 3, name: en.title })).toBeTruthy();
    expect(screen.getByText(en.description)).toBeTruthy();
    await waitFor(() => expect(container.querySelector("svg")?.classList.contains("w-40")).toBe(true));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();

    await setLanguage("zh-CN");
    rerender(<CycleTabEmptyState tab={tab} />);
    expect(screen.getByRole("heading", { level: 3, name: zh.title })).toBeTruthy();
    expect(screen.getByText(zh.description)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  }
);

it.each(
  cases.flatMap(({ tab }) =>
    [
      { hasSearch: true, hasFilters: false, reason: "search" },
      { hasSearch: false, hasFilters: true, reason: "filters" },
      { hasSearch: true, hasFilters: true, reason: "search and filters" },
    ].map(({ hasSearch, hasFilters, reason }) => ({ tab, hasSearch, hasFilters, reason }))
  )
)(
  "keeps the $tab structure and illustration for $reason with localized clear guidance",
  async ({ tab, hasSearch, hasFilters }) => {
    await setLanguage("en");
    const { container, rerender } = render(<CycleTabEmptyState tab={tab} />);
    await waitFor(() => expect(container.querySelector("svg")?.classList.contains("w-40")).toBe(true));
    const structure = () =>
      Array.from(container.querySelectorAll("*:not(svg *)"), (element) => [
        element.tagName,
        element.getAttribute("class"),
      ]);
    const illustration = () => ({
      viewBox: container.querySelector("svg")?.getAttribute("viewBox"),
      paths: Array.from(container.querySelectorAll("svg path"), (path) => path.getAttribute("d")),
      className: container.querySelector("svg")?.getAttribute("class"),
    });
    const originalStructure = structure();
    const originalIllustration = illustration();
    expect(originalIllustration.paths.length).toBeGreaterThan(0);

    rerender(<CycleTabEmptyState tab={tab} hasSearch={hasSearch} hasFilters={hasFilters} />);
    expect(screen.getByRole("heading", { level: 3, name: "No matching cycles" })).toBeTruthy();
    expect(
      screen.getByText(
        hasSearch ? "Remove the search criteria to see all cycles" : "Remove the filters to see all cycles"
      )
    ).toBeTruthy();
    expect(structure()).toEqual(originalStructure);
    expect(illustration()).toEqual(originalIllustration);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();

    await setLanguage("zh-CN");
    rerender(<CycleTabEmptyState tab={tab} hasSearch={hasSearch} hasFilters={hasFilters} />);
    expect(screen.getByRole("heading", { level: 3, name: "没有匹配的周期" })).toBeTruthy();
    expect(screen.getByText(hasSearch ? "清除搜索条件以查看所有周期" : "清除筛选条件以查看所有周期")).toBeTruthy();
    expect(structure()).toEqual(originalStructure);
    expect(illustration()).toEqual(originalIllustration);
  }
);

it("updates the content when switching tabs", async () => {
  await setLanguage("en");
  const { rerender } = render(<CycleTabEmptyState tab="upcoming" />);
  expect(screen.getByRole("heading", { name: "No upcoming cycles" })).toBeTruthy();

  rerender(<CycleTabEmptyState tab="completed" />);
  expect(screen.getByRole("heading", { name: "No completed cycles" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "No upcoming cycles" })).toBeNull();
});
