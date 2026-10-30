import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { IssueHierarchyIndicator } from "./hierarchy-indicator";
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count: number }) => (values ? `${key}: ${values.count}` : key),
  }),
}));
it("does not label unrelated standalone tasks", () => {
  const { container } = render(<IssueHierarchyIndicator />);
  expect(container.textContent).toBe("");
});
it("identifies a child even when its parent is not loaded", () => {
  render(<IssueHierarchyIndicator parentId="parent" />);
  expect(screen.getByTitle("common.parent")).toBeTruthy();
});
it("shows the parent name and child count together for intermediate tasks", () => {
  render(<IssueHierarchyIndicator parentId="parent" parentName="Release" subIssuesCount={3} />);
  expect(screen.getByTitle("common.parent · Release").textContent).toBe("Release");
  expect(screen.getByText("common.sub_work_items 3")).toBeTruthy();
  expect(screen.getByTitle("web.runtime.sub_items_count: 3")).toBeTruthy();
});
