import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { splitKanbanCardProperties } from "./card-layout";
import { KanbanCardProgress, getSubWorkItemProgress } from "./card-progress";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("getSubWorkItemProgress", () => {
  it("reports done, total and a rounded percentage", () => {
    expect(getSubWorkItemProgress({ sub_issues_count: 3, completed_sub_issues_count: 1 })).toEqual({
      done: 1,
      total: 3,
      percent: 33,
    });
  });

  it("has nothing to report without sub-work items, and clamps a stale done count", () => {
    expect(getSubWorkItemProgress({ sub_issues_count: 0, completed_sub_issues_count: 0 })).toBeNull();
    expect(getSubWorkItemProgress({ sub_issues_count: 2, completed_sub_issues_count: 5 })?.done).toBe(2);
    expect(getSubWorkItemProgress({ sub_issues_count: 2 })?.percent).toBe(0);
  });
});

describe("KanbanCardProgress", () => {
  it("shows the count, the percentage and an accessible ring", () => {
    render(<KanbanCardProgress progress={{ done: 9, total: 20, percent: 45 }} />);
    expect(screen.getByText("9/20")).toBeDefined();
    expect(screen.getByText("45%")).toBeDefined();
    expect(screen.getByRole("progressbar", { name: "common.sub_work_items" })).toBeDefined();
  });
});

describe("splitKanbanCardProperties", () => {
  it("moves the priority to the header, the due date and counts to the footer and the sub-work item count to the progress row", () => {
    const split = splitKanbanCardProperties({
      state: true,
      priority: true,
      labels: true,
      due_date: true,
      link: true,
      sub_issue_count: true,
    });
    expect(split.body).toMatchObject({
      state: false,
      priority: false,
      labels: false,
      due_date: false,
      link: false,
      sub_issue_count: false,
    });
    expect(split.header).toEqual({ priority: true });
    expect(split.showStateIcon).toBe(true);
    expect(split.showLabels).toBe(true);
    expect(split.footer).toEqual({ due_date: true, attachment_count: false, link: true });
    expect(split.showFooterProperties).toBe(true);
    expect(split.showProgress).toBe(true);
  });

  it("keeps hidden properties hidden everywhere", () => {
    const split = splitKanbanCardProperties({ state: true });
    expect(split.showFooterProperties).toBe(false);
    expect(split.showProgress).toBe(false);
    expect(splitKanbanCardProperties(undefined).body).toBeUndefined();
  });
});
