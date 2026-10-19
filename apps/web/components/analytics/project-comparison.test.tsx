import { expect, it } from "vitest";
import { projectCompletion } from "./project-completion";
it("weights completion by non-cancelled work items, not project percentages", () => {
  expect(
    projectCompletion([
      { work_items: 10, completed: 2, cancelled: 2 },
      { work_items: 2, completed: 2, cancelled: 0 },
    ])
  ).toBe(40);
});
it("handles empty scopes and entirely cancelled projects", () => {
  expect(projectCompletion([])).toBe(0);
  expect(projectCompletion([{ work_items: 5, completed: 0, cancelled: 5 }])).toBe(0);
});
