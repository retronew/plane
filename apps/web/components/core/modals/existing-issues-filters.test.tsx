import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { ExistingIssuesFilters, emptyExistingIssueFilters } from "./existing-issues-filters";
import type { ExistingIssueFilters } from "./existing-issues-filters";
import { createExistingIssueFilterAdapter, createExistingIssueFilterInstance } from "./existing-issues-filter-adapter";

vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@/components/core/filters/date-filter-modal", () => ({
  DateFilterModal: ({ title, onSelect }: { title: string; onSelect: (value: string[]) => void }) => (
    <button onClick={() => onSelect(["2026-11-01;after", "2026-11-10;before"])}>{`Save ${title}`}</button>
  ),
}));

beforeEach(async () => {
  await setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.getAnimations ??= () => [];
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(256);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Harness({ initial = emptyExistingIssueFilters() }: { initial?: ExistingIssueFilters }) {
  const [value, onChange] = useState(initial);
  return (
    <>
      <ExistingIssuesFilters value={value} onChange={onChange}>
        <input aria-label="Search candidates" />
      </ExistingIssuesFilters>
      <output data-testid="filter-payload">{JSON.stringify(value)}</output>
    </>
  );
}

it("uses the real task-page condition, edits its multi-select value, removes the field and clears all", async () => {
  const { container } = render(
    <Harness initial={{ ...emptyExistingIssueFilters(), priority: ["high", "urgent"], state_group: ["started"] }} />
  );
  const toolbar = container.querySelector("[data-candidate-search-toolbar]")!;
  expect(toolbar.contains(screen.getByLabelText("Search candidates"))).toBe(true);
  expect(within(toolbar as HTMLElement).getByRole("button", { name: "Filters" })).toBeTruthy();
  const conditions = container.querySelector("[data-candidate-filter-conditions]")! as HTMLElement;
  // A property segment, operator segment, shared value select and remove button per FIELD.
  expect(within(conditions).getAllByRole("button", { name: "Remove filter" })).toHaveLength(2);
  expect(within(conditions).getByText("Priority")).toBeTruthy();
  fireEvent.click(await within(conditions).findByRole("button", { name: /High/ }));
  fireEvent.click(await screen.findByRole("option", { name: /Low/ }));
  expect(JSON.parse(screen.getByTestId("filter-payload").textContent!).priority).toEqual(["high", "urgent", "low"]);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  fireEvent.click(within(conditions).getAllByRole("button", { name: "Remove filter" })[0]);
  expect(JSON.parse(screen.getByTestId("filter-payload").textContent!).state_group).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(JSON.parse(screen.getByTestId("filter-payload").textContent!)).toEqual(emptyExistingIssueFilters());
});

it("adds a custom date range as one real task-page range condition", async () => {
  const { container } = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.keyDown(await screen.findByRole("button", { name: "Start date" }), { key: "ArrowRight" });
  fireEvent.click(await screen.findByRole("button", { name: "Custom" }));
  fireEvent.click(screen.getByText("Save Start date"));
  expect(JSON.parse(screen.getByTestId("filter-payload").textContent!).start_date).toEqual([
    "2026-11-01;after",
    "2026-11-10;before",
  ]);
  const conditions = container.querySelector("[data-candidate-filter-conditions]")! as HTMLElement;
  expect(within(conditions).getAllByRole("button", { name: "Remove filter" })).toHaveLength(1);
  expect(within(conditions).getByText("between")).toBeTruthy();
});

it("round-trips all old date encodings and preserves untouched order when another field changes", () => {
  for (const dates of [
    ["1_weeks;after;fromnow", "2_weeks;after;fromnow"],
    ["2026-11-10;before", "2026-11-01;after"],
    ["2026-11-01;after"],
    ["2026-11-10;before"],
    ["2026-11-01;after", "1_weeks;after;fromnow"],
  ]) {
    const initial = {
      state_group: ["started"],
      priority: ["urgent"],
      start_date: dates,
      target_date: ["1_weeks;after;fromnow"],
    };
    const adapter = createExistingIssueFilterAdapter(initial);
    expect(adapter.toExternal(adapter.toInternal(initial))).toEqual(initial);
    const changed = vi.fn();
    const filter = createExistingIssueFilterInstance(initial, changed);
    filter.updateConditionValue("priority", ["high"]);
    expect(changed).toHaveBeenLastCalledWith({ ...initial, priority: ["high"] });
  }
});

it("edits range/single/relative dates through the real filter instance without changing query semantics", () => {
  const initial = {
    state_group: ["started"],
    priority: ["high"],
    start_date: ["2026-11-01;after", "2026-11-10;before"],
    target_date: ["2026-11-20;before"],
  };
  const changed = vi.fn();
  const filter = createExistingIssueFilterInstance(initial, changed);
  expect(filter.configManager.getConfigByProperty("start_date")?.allEnabledSupportedOperators).toEqual(["range"]);
  filter.updateConditionValue("start_date", ["2026-11-03", "2026-11-12"]);
  expect(changed).toHaveBeenLastCalledWith({ ...initial, start_date: ["2026-11-03;after", "2026-11-12;before"] });
  filter.updateConditionValue("target_date", "2026-11-22");
  expect(changed).toHaveBeenLastCalledWith({
    ...initial,
    start_date: ["2026-11-03;after", "2026-11-12;before"],
    target_date: ["2026-11-22;before"],
  });
  filter.removeCondition("start_date");
  expect(changed).toHaveBeenLastCalledWith({ ...initial, start_date: [], target_date: ["2026-11-22;before"] });
  const relative = createExistingIssueFilterInstance({ ...initial, start_date: ["1_weeks;after;fromnow"] }, changed);
  relative.updateConditionValue("start_date", ["2_weeks;after;fromnow"]);
  expect(changed).toHaveBeenLastCalledWith({ ...initial, start_date: ["2_weeks;after;fromnow"] });
});
