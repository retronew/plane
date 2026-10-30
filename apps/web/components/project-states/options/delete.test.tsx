import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import type { IState } from "@plane/types";
import { StateDelete } from "./delete";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Translation: () => "Confirm deletion",
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));

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
afterEach(() => vi.unstubAllGlobals());

it("keeps the delete confirmation mounted after the state actions menu closes", async () => {
  const deleteState = vi.fn().mockResolvedValue(undefined);
  function StateActions() {
    const [open, setOpen] = useState(false);
    return (
      <StateDelete
        state={{ id: "ready", name: "Ready", default: false } as IState}
        totalStates={2}
        deleteStateCallback={deleteState}
        renderMenu={(deleteAction) => (
          <Menu open={open} onOpenChange={setOpen}>
            <MenuTrigger>Actions</MenuTrigger>
            <MenuContent>{deleteAction}</MenuContent>
          </Menu>
        )}
      />
    );
  }
  render(<StateActions />);
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "common.actions.delete" }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(await screen.findByRole("alertdialog", { name: "web.delete_state" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "delete" }));
  await waitFor(() => expect(deleteState).toHaveBeenCalledWith("ready"));
});
