import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TCycleDistribution, TCycleEstimateDistribution } from "@plane/types";
import { CycleProgressStats } from "./progress-stats";

const groupedIssues = { backlog: 0, unstarted: 0, started: 0, completed: 0, cancelled: 0 };
const defaultProps = {
  cycleId: "empty-cycle",
  distribution: undefined,
  groupedIssues,
  handleFiltersUpdate: vi.fn(),
  plotType: "burndown" as const,
  selectedFilters: { assignees: undefined, labels: undefined, stateGroups: undefined },
  totalIssuesCount: 0,
};

function selectTab(tab: "assignees" | "labels" | "states") {
  localStorage.setItem("cycle-analytics-tab-empty-cycle", JSON.stringify(`stat-${tab}`));
}

afterEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  await setLanguage("en");
});

it.each([
  { tab: "assignees" as const, locale: "en" as const, text: "No assignee" },
  { tab: "assignees" as const, locale: "zh-CN" as const, text: "无负责人" },
  { tab: "labels" as const, locale: "en" as const, text: "No labels yet" },
  { tab: "labels" as const, locale: "zh-CN" as const, text: "暂无标签" },
])("renders the localized $tab illustration for missing distributions in $locale", async ({ tab, locale, text }) => {
  await setLanguage(locale);
  selectTab(tab);
  const { container } = render(<CycleProgressStats {...defaultProps} />);

  const caption = screen.getByText(text);
  expect(caption.classList.contains("text-body-xs-regular")).toBe(true);
  expect(caption.classList.contains("text-tertiary")).toBe(true);
  const layout = caption.parentElement?.parentElement;
  expect(layout?.classList.contains("flex-col")).toBe(true);
  expect(layout?.classList.contains("items-center")).toBe(true);
  expect(layout?.classList.contains("gap-3")).toBe(true);
  await waitFor(() => expect(layout?.querySelector("svg")).toBeTruthy());
  expect(layout?.querySelector("svg")?.getAttribute("width")).toBe(tab === "assignees" ? "71" : "81");
  expect(layout?.querySelector("svg")?.getAttribute("height")).toBe(tab === "assignees" ? "80" : "92");
  expect(container.querySelector("img")).toBeNull();
  expect(screen.queryByText("0%")).toBeNull();
});

it.each(["burndown", "burnup"] as const)("handles empty arrays in %s distributions", async (plotType) => {
  selectTab("assignees");
  const distribution = { assignees: [], labels: [], completion_chart: {} };
  const { rerender } = render(<CycleProgressStats {...defaultProps} distribution={distribution} plotType={plotType} />);
  expect(screen.getByText("No assignee")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Labels" }));
  expect(screen.getByText("No labels yet")).toBeTruthy();
  expect(localStorage.getItem("cycle-analytics-tab-empty-cycle")).toBe('"stat-labels"');

  rerender(<CycleProgressStats {...defaultProps} distribution={distribution} plotType={plotType} />);
  expect(screen.getByText("No labels yet")).toBeTruthy();
});

const distribution: TCycleDistribution = {
  assignees: [
    {
      assignee_id: "member-1",
      display_name: "Alex",
      first_name: "Alex",
      last_name: null,
      avatar_url: null,
      total_issues: 4,
      completed_issues: 1,
      pending_issues: 3,
    },
  ],
  labels: [
    {
      label_id: "label-1",
      label_name: "Bug",
      color: "#ff0000",
      total_issues: 4,
      completed_issues: 2,
      pending_issues: 2,
    },
  ],
  completion_chart: {},
};

const estimateDistribution: TCycleEstimateDistribution = {
  assignees: distribution.assignees.map((assignee) => ({
    ...assignee,
    total_estimates: 8,
    completed_estimates: 4,
    pending_estimates: 4,
  })),
  labels: distribution.labels.map((label) => ({
    ...label,
    total_estimates: 8,
    completed_estimates: 6,
    pending_estimates: 2,
  })),
  completion_chart: {},
};

it.each([
  { plotType: "burndown" as const, data: distribution, assigneePercent: "25%", labelPercent: "50%" },
  { plotType: "burnup" as const, data: estimateDistribution, assigneePercent: "50%", labelPercent: "75%" },
])(
  "preserves populated statistics and filtering in $plotType mode",
  ({ plotType, data, assigneePercent, labelPercent }) => {
    selectTab("assignees");
    const handleFiltersUpdate = vi.fn();
    render(
      <CycleProgressStats
        {...defaultProps}
        distribution={data}
        plotType={plotType}
        totalIssuesCount={4}
        isEditable
        handleFiltersUpdate={handleFiltersUpdate}
      />
    );
    expect(screen.getByText(assigneePercent)).toBeTruthy();
    fireEvent.click(screen.getByText("Alex"));
    expect(handleFiltersUpdate).toHaveBeenLastCalledWith({
      property: "assignee_id",
      operator: "in",
      value: ["member-1"],
    });

    fireEvent.click(screen.getByRole("tab", { name: "Labels" }));
    expect(screen.getByText(labelPercent)).toBeTruthy();
    fireEvent.click(screen.getByText("Bug"));
    expect(handleFiltersUpdate).toHaveBeenLastCalledWith({ property: "label_id", operator: "in", value: ["label-1"] });
    expect(screen.queryByText("No labels yet")).toBeNull();
  }
);

it("keeps unassigned and unlabeled work item statistics when distribution rows have no ID", () => {
  selectTab("assignees");
  render(
    <CycleProgressStats
      {...defaultProps}
      distribution={{
        ...distribution,
        assignees: [{ ...distribution.assignees[0]!, assignee_id: null }],
        labels: [{ ...distribution.labels[0]!, label_id: null, label_name: null }],
      }}
      totalIssuesCount={4}
    />
  );
  expect(screen.getByText("No assignee")).toBeTruthy();
  expect(screen.getByText("25%")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Labels" }));
  expect(screen.getByText("No labels yet")).toBeTruthy();
  expect(screen.getByText("50%")).toBeTruthy();
});

it("preserves all five zero-count state rows for an empty cycle", () => {
  selectTab("states");
  render(<CycleProgressStats {...defaultProps} />);
  for (const state of Object.keys(groupedIssues)) expect(screen.getByText(state)).toBeTruthy();
  expect(screen.getAllByText("0%")).toHaveLength(5);
});
