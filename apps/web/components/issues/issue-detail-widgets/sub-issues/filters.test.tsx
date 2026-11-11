import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { action, observable } from "mobx";
import { observer } from "mobx-react";
import { beforeEach, expect, it, vi } from "vitest";
import { DATE_AFTER_FILTER_OPTIONS, SUB_WORK_ITEM_AVAILABLE_FILTERS_FOR_WORK_ITEM_PAGE } from "@plane/constants";
import { setLanguage } from "@plane/i18n";
import type { IIssueFilterOptions, IState, ISubWorkItemFilters, TIssue } from "@plane/types";
import { getFilteredWorkItems, updateSubWorkItemFilters } from "@/store/issue/helpers/base-issues-utils";
import { SubWorkItemTitleActions } from "./title-actions";

const fixtures = vi.hoisted(() => ({
  states: [
    { id: "todo", name: "Todo", group: "unstarted", color: "#888888" },
    { id: "done", name: "Done", group: "completed", color: "#00ff00" },
  ],
  types: [
    { id: "task", name: "Task", is_active: true },
    { id: "bug", name: "Bug", is_active: true },
  ],
}));
const filtersMap = observable<Record<string, Partial<ISubWorkItemFilters>>>({});
const update = vi.fn(
  action((...args: Parameters<typeof updateSubWorkItemFilters> extends [unknown, ...infer Rest] ? Rest : never) =>
    updateSubWorkItemFilters(filtersMap, ...args)
  )
);
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    subIssues: { filters: { getSubIssueFilters: (id: string) => filtersMap[id], updateSubWorkItemFilters: update } },
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getProjectStates: () => fixtures.states as IState[] }),
}));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({ issueTypes: { project: { results: fixtures.types } } }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    project: { getProjectMemberIds: () => ["alice", "bob"] },
    getUserDetails: (id: string) => ({ id, display_name: id === "alice" ? "Alice" : "Bob" }),
  }),
}));
vi.mock("./display-filters", () => ({ SubIssueDisplayFilters: () => null }));
vi.mock("./quick-action-button", () => ({ SubIssuesActionButton: () => null }));
vi.mock("@/components/core/filters/date-filter-modal", () => ({
  DateFilterModal: ({ onSelect }: { onSelect: (values: string[]) => void }) => (
    <button type="button" onClick={() => onSelect(["2026-11-01;after", "2026-11-30;before"])}>
      Apply custom range
    </button>
  ),
}));

const items = [
  {
    id: "first",
    priority: "high",
    state_id: "todo",
    type_id: "task",
    assignee_ids: ["alice"],
    start_date: "2026-11-15",
    target_date: "2026-11-20",
  },
  {
    id: "second",
    priority: "low",
    state_id: "done",
    type_id: "bug",
    assignee_ids: ["bob"],
    start_date: "2026-10-15",
    target_date: "2026-10-20",
  },
] as TIssue[];
const Harness = observer(function Harness() {
  const visible = getFilteredWorkItems(items, filtersMap.parent?.filters);
  return (
    <>
      <SubWorkItemTitleActions disabled parentId="parent" projectId="project" />
      <output data-testid="visible">{visible.map((item) => item.id).join(",")}</output>
    </>
  );
});

beforeEach(async () => {
  await setLanguage("en");
  filtersMap.parent = { filters: {} };
  update.mockClear();
});

async function openField(label: string) {
  const trigger = screen.getByText(label).closest('[role="button"]')!;
  fireEvent.keyDown(trigger, { key: "ArrowRight" });
  await screen.findByRole("textbox");
}

it("renders every configured field with the 24px ghost button and built-in tooltip", async () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Filters" });
  expect(trigger.className).toContain("control-height-sm");
  expect(trigger.className).toContain("bg-transparent");
  fireEvent.focus(trigger);
  expect(await screen.findByRole("tooltip")).toBeTruthy();
  fireEvent.click(trigger);
  await Promise.all(
    ["Priority", "State", "Work item types", "Assignees", "Start date", "Target date"].map(async (label) =>
      expect(await screen.findByText(label)).toBeTruthy()
    )
  );
  expect(SUB_WORK_ITEM_AVAILABLE_FILTERS_FOR_WORK_ITEM_PAGE).toHaveLength(6);
});

it.each([
  ["Priority", "priority", "High", "Low", "high", "low"],
  ["State", "state", "Todo", "Done", "todo", "done"],
  ["Work item types", "issue_type", "Task", "Bug", "task", "bug"],
  ["Assignees", "assignees", "Alice", "Bob", "alice", "bob"],
] as const)(
  "keeps %s multiselect, selected values, search and local MobX filtering in sync",
  async (label, field, first, second, firstId, secondId) => {
    filtersMap.parent = { filters: { [field]: [firstId] } };
    render(<Harness />);
    expect(screen.getByTestId("visible").textContent).toBe("first");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    await openField(label);
    expect(screen.getByRole("button", { name: first }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: second } });
    expect(screen.queryByRole("button", { name: first })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: second }));
    await waitFor(() => expect(filtersMap.parent.filters?.[field]).toEqual([firstId, secondId]));
    expect(screen.getByTestId("visible").textContent).toBe("first,second");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: first }));
    expect(filtersMap.parent.filters?.[field]).toEqual([secondId]);
    expect(screen.getByTestId("visible").textContent).toBe("second");
    expect(screen.getByRole("button", { name: first }).getAttribute("aria-pressed")).toBe("false");
  }
);

it.each([
  ["Start date", "start_date"],
  ["Target date", "target_date"],
] as const)("preserves %s presets when applying and clearing custom ranges", async (label, field) => {
  const preset = DATE_AFTER_FILTER_OPTIONS[0];
  filtersMap.parent = { filters: { [field]: [preset.value], priority: ["high"] } };
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  await openField(label);
  expect(screen.getByRole("button", { name: preset.name }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Custom" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply custom range" }));
  await waitFor(() =>
    expect(filtersMap.parent.filters?.[field]).toEqual([preset.value, "2026-11-01;after", "2026-11-30;before"])
  );
  expect(filtersMap.parent.filters?.priority).toEqual(["high"]);
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  await openField(label);
  expect(screen.getByRole("button", { name: "Custom" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Custom" }));
  expect(filtersMap.parent.filters?.[field]).toEqual([preset.value]);
  fireEvent.click(screen.getByRole("button", { name: preset.name }));
  expect(filtersMap.parent.filters?.[field]).toEqual([]);
});

it("clears every supported field through the real merge update without losing unrelated filters", async () => {
  const initial: IIssueFilterOptions = Object.fromEntries(
    SUB_WORK_ITEM_AVAILABLE_FILTERS_FOR_WORK_ITEM_PAGE.map((field) => [field, ["value"]])
  );
  filtersMap.parent = { filters: { ...initial, labels: ["keep"] } };
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(await screen.findByRole("button", { name: "Clear all" }));
  expect(filtersMap.parent.filters).toEqual({
    ...Object.fromEntries(SUB_WORK_ITEM_AVAILABLE_FILTERS_FOR_WORK_ITEM_PAGE.map((field) => [field, []])),
    labels: ["keep"],
  });
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
});
