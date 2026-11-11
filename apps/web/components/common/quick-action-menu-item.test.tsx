import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { QuickActionMenuItem } from "./quick-action-menu-item";

const reason = "Only completed cycles can be archived";
function Fixture({ disabled = true, action = vi.fn() }) {
  return (
    <Menu>
      <MenuTrigger>Actions</MenuTrigger>
      <ActionMenuContent>
        <QuickActionMenuItem item={{ key: "edit", title: "Edit", action: vi.fn() }} />
        <QuickActionMenuItem item={{ key: "archive", title: "Archive", disabled, disabledReason: reason, action }} />
      </ActionMenuContent>
    </Menu>
  );
}

it("shows a disabled reason on hover without adding a description or executing the action", async () => {
  const action = vi.fn();
  render(<Fixture action={action} />);
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  const archive = screen.getByRole("menuitem", { name: "Archive" });
  expect(archive.textContent).toBe("Archive");
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.pointerEnter(archive.parentElement!, { pointerType: "mouse" });
  fireEvent.mouseEnter(archive.parentElement!);
  fireEvent.mouseMove(archive.parentElement!);
  expect((await screen.findByRole("tooltip")).textContent).toBe(reason);
  fireEvent.click(archive);
  expect(action).not.toHaveBeenCalled();
});

it("exposes the reason on arrow-key focus and keeps Enter and Space disabled", async () => {
  const action = vi.fn();
  render(<Fixture action={action} />);
  const trigger = screen.getByRole("button", { name: "Actions" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Edit" })));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  const archive = screen.getByRole("menuitem", { name: "Archive" });
  await waitFor(() => expect(document.activeElement).toBe(archive));
  expect((await screen.findByRole("tooltip")).textContent).toBe(reason);
  fireEvent.keyDown(archive, { key: "Enter" });
  fireEvent.keyDown(archive, { key: " " });
  expect(action).not.toHaveBeenCalled();
  expect(screen.getByRole("menu")).toBeTruthy();
});

it("does not show a reason for an enabled archive action", async () => {
  const action = vi.fn();
  render(<Fixture disabled={false} action={action} />);
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  const archive = screen.getByRole("menuitem", { name: "Archive" });
  fireEvent.mouseEnter(archive);
  expect(screen.queryByText(reason)).toBeNull();
  fireEvent.click(archive);
  expect(action).toHaveBeenCalledOnce();
});
