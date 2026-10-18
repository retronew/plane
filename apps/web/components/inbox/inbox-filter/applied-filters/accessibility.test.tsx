import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InboxIssueAppliedFiltersLabel } from "./label";
import { InboxIssueAppliedFiltersState } from "./state";
import { InboxIssueAppliedFiltersStatus } from "./status";

const store = vi.hoisted(() => ({
  inboxFilters: { labels: ["one", "two"], state: ["one", "two"], status: [-2, -1] },
  handleInboxIssueFilters: vi.fn(),
}));
vi.mock("@/hooks/store/use-project-inbox", () => ({ useProjectInbox: () => store }));
vi.mock("@/hooks/store/use-label", () => ({
  useLabel: () => ({ getLabelById: (id: string) => ({ id, name: id, color: "#123456" }) }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: (id: string) => ({ id, name: id, color: "#123456", group: "started" }) }),
}));
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("inbox filter removal controls", () => {
  it.each([
    ["labels", InboxIssueAppliedFiltersLabel],
    ["state", InboxIssueAppliedFiltersState],
  ] as const)("removes one %s condition and clears its group using named native buttons", (field, Component) => {
    render(<Component />);
    const buttons = screen.getAllByRole("button", { name: "remove" });
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.click(buttons[0]);
    expect(store.handleInboxIssueFilters).toHaveBeenLastCalledWith(field, ["two"]);
    fireEvent.click(buttons[2]);
    expect(store.handleInboxIssueFilters).toHaveBeenLastCalledWith(field, undefined);
  });

  it("removes a status while retaining the other status", () => {
    render(<InboxIssueAppliedFiltersStatus />);
    const buttons = screen.getAllByRole("button", { name: "remove" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(store.handleInboxIssueFilters).toHaveBeenCalledWith("status", [-1]);
  });
});
