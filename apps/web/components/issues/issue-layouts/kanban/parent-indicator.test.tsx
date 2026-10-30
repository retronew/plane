import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { KanbanParentIndicator } from "./parent-indicator";

vi.mock("@plane/i18n", () => ({ translate: (key: string) => (key === "common.parent" ? "父工作项" : key) }));

it("identifies the parent relationship when its title is not loaded", () => {
  render(<KanbanParentIndicator />);
  expect(screen.getByText("父工作项")).toBeTruthy();
});

it("shows only the parent name and explains the relationship in the tooltip", () => {
  render(<KanbanParentIndicator parentName="用户账号与登录" />);
  expect(screen.getByTitle("父工作项 · 用户账号与登录").textContent).toBe("用户账号与登录");
  expect(screen.queryByText(/子工作项/)).toBeNull();
});
