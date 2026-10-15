import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Menu, MenuTrigger, MenuItem } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "./action-menu-content";
it("preserves menu keyboard navigation and action selection", async () => {
  const edit = vi.fn();
  render(
    <Menu>
      <MenuTrigger>Actions</MenuTrigger>
      <ActionMenuContent>
        <MenuItem label="Edit" onClick={edit} />
        <MenuItem label="Delete" />
      </ActionMenuContent>
    </Menu>
  );
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  const menu = await screen.findByRole("menu");
  expect(menu.getAttribute("data-align")).toBe("end");
  fireEvent.keyDown(menu, { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
  expect(edit).toHaveBeenCalledOnce();
});
