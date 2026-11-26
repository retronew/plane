import { useRef } from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { Menu, MenuContent } from "@makeplane/propel/components/menu";
import type { TIssue } from "@plane/types";
import { useAllIssueMenuItems } from "./helper";
import { createIssueQuickActionMenu } from "./quick-action-menu";
import { IssueQuickActionMenuItems } from "./menu-items";
vi.mock("./property-menu-items", () => ({ usePropertyMenuItems: () => [] }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
beforeEach(() => {
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
const props = () => ({
  issue: { id: "issue", project_id: "project" } as TIssue,
  workspaceSlug: "workspace",
  isEditingAllowed: true,
  isDeletingAllowed: true,
  isArchivingAllowed: true,
  isInArchivableGroup: false,
  setIssueToEdit: vi.fn(),
  setCreateUpdateIssueModal: vi.fn(),
  setDeleteIssueModal: vi.fn(),
  setArchiveIssueModal: vi.fn(),
});
it("groups edit, open/copy, archive and red delete, preserving disabled archive and action handlers", async () => {
  const options = props();
  const { result } = renderHook(() => useAllIssueMenuItems(options));
  render(
    <Menu open>
      <MenuContent>
        <IssueQuickActionMenuItems items={result.current} />
      </MenuContent>
    </Menu>
  );
  const items = await screen.findAllByRole("menuitem");
  expect(items).toHaveLength(6);
  expect(items.map((item) => item.textContent)).toEqual([
    "common.actions.edit",
    "common.actions.open_in_new_tab",
    "common.actions.copy",
    "common.actions.make_a_copy",
    "common.actions.archive",
    "common.actions.delete",
  ]);
  expect(screen.getAllByRole("separator")).toHaveLength(3);
  expect(items[3].nextElementSibling?.getAttribute("role")).toBe("separator");
  expect(items[4].hasAttribute("data-disabled")).toBe(true);
  // the disabled reason moves out of the row into a tooltip
  expect(items[4].textContent).toBe("common.actions.archive");
  expect(items[5].className).toContain("text-danger-primary");
  fireEvent.click(items[4]);
  expect(options.setArchiveIssueModal).not.toHaveBeenCalled();
  fireEvent.click(items[5]);
  expect(options.setDeleteIssueModal).toHaveBeenCalledWith(true);
});
it("drops the archive group when archiving is unavailable, and none for read-only navigation", async () => {
  const options = { ...props(), isArchivingAllowed: false };
  const { result, rerender } = renderHook(() => useAllIssueMenuItems(options));
  const view = render(
    <Menu open>
      <MenuContent>
        <IssueQuickActionMenuItems items={result.current} />
      </MenuContent>
    </Menu>
  );
  await screen.findAllByRole("menuitem");
  expect(screen.getAllByRole("separator")).toHaveLength(2);
  options.isEditingAllowed = false;
  options.isDeletingAllowed = false;
  rerender();
  view.rerender(
    <Menu open>
      <MenuContent>
        <IssueQuickActionMenuItems items={result.current} />
      </MenuContent>
    </Menu>
  );
  expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  expect(screen.queryByRole("separator")).toBeNull();
});

it.each(["context", "more"])("constructs candidates only when the %s menu opens", async (entry) => {
  const open = vi.fn();
  const action = vi.fn();
  const build = vi.fn(() => [{ key: "edit", title: "Edit", action, onMenuOpen: open }]);
  const QuickActions = createIssueQuickActionMenu(build);
  const dialogs = vi.fn(() => null);
  const Dialogs = dialogs;
  function Card() {
    const ref = useRef<HTMLDivElement>(null);
    return (
      <div ref={ref}>
        <span>Card</span>
        <QuickActions parentRef={ref} menuItemProps={props()} placements="bottom-end">
          <Dialogs />
        </QuickActions>
      </div>
    );
  }
  render(<Card />);
  expect(dialogs).not.toHaveBeenCalled();
  expect(build).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
  if (entry === "context") fireEvent.contextMenu(screen.getByText("Card"));
  else fireEvent.keyDown(screen.getByRole("button", { name: "aria_labels.common.more_actions" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
  expect(dialogs).toHaveBeenCalled();
  expect(open).toHaveBeenCalledTimes(1);
  expect(action).toHaveBeenCalledTimes(1);
});
