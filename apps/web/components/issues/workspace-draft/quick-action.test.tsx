import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceDraftIssueQuickActions } from "./quick-action";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = { edit: "编辑", delete: "删除" };
      return labels[key] ?? key;
    },
  }),
}));
beforeEach(() => {
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());
it("translates draft actions, separates deletion and invokes only the selected action", async () => {
  const edit = vi.fn(),
    remove = vi.fn(),
    hidden = vi.fn();
  render(
    <WorkspaceDraftIssueQuickActions
      parentRef={createRef()}
      MENU_ITEMS={[
        { key: "edit", title: "edit", action: edit },
        { key: "delete", title: "delete", variant: "danger", action: remove },
        { key: "hidden", title: "hidden", shouldRender: false, action: hidden },
      ]}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions" }));
  const action = await screen.findByRole("menuitem", { name: "编辑" });
  expect(screen.getByRole("menuitem", { name: "删除" })).toBeTruthy();
  expect(screen.getAllByRole("separator")).toHaveLength(1);
  expect(screen.queryByRole("menuitem", { name: "hidden" })).toBeNull();
  fireEvent.click(action);
  expect(edit).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();
  expect(hidden).not.toHaveBeenCalled();
});
