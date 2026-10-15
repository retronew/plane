import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LinkItemBlock } from "./link-item-block";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const open = vi.fn();
const edit = vi.fn();
const remove = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
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

it("keeps menu actions independent from opening the link and separates deletion", async () => {
  render(
    <LinkItemBlock
      title="Example"
      url="https://example.com"
      onClick={open}
      menuItems={[
        { key: "edit", title: "Edit", action: edit },
        { key: "delete", title: "Delete", variant: "danger", action: remove },
        { key: "hidden", title: "Hidden", shouldRender: false, action: vi.fn() },
      ]}
    />
  );
  const trigger = screen.getByRole("button", { name: "aria_labels.common.more_actions" });
  expect(trigger.closest("button")).toBe(trigger);
  fireEvent.click(trigger);
  const editAction = await screen.findByRole("menuitem", { name: "Edit" });
  expect(screen.getAllByRole("separator")).toHaveLength(1);
  expect(screen.queryByRole("menuitem", { name: "Hidden" })).toBeNull();
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(editAction);
  expect(edit).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Example" }));
  expect(open).toHaveBeenCalledOnce();
});
