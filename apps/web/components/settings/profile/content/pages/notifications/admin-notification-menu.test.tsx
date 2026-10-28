import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { IInstanceUser } from "@plane/types";
import { UserActionsMenu } from "../../../../../../../admin/components/users/user-actions-menu";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../../../../../admin/hooks/store", () => ({ useInstance: vi.fn(), useUser: vi.fn() }));
vi.mock("@plane/services", () => ({
  InstanceService: vi.fn(function () {
    return {};
  }),
}));
vi.mock("@plane/blocks/dialog", () => ({ ConfirmDialog: () => null }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuContent: ({ children }: { children: ReactNode }) => <div role="menu">{children}</div>,
  MenuTrigger: () => null,
  MenuSeparator: () => <hr />,
  MenuItem: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button role="menuitem" onClick={onClick}>
      {label}
    </button>
  ),
}));
afterEach(cleanup);

it("opens notifications independently of profile editing, including for the current admin", () => {
  const onEdit = vi.fn();
  const onNotifications = vi.fn();
  const onAction = vi.fn();
  const user = { id: "alice", email: "alice@example.com", is_active: true, is_instance_admin: true } as IInstanceUser;
  render(
    <UserActionsMenu
      user={user}
      currentUserId="alice"
      admins={[]}
      onEdit={onEdit}
      onNotifications={onNotifications}
      onAction={onAction}
    />
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "admin.users.notifications.title" }));
  expect(onNotifications).toHaveBeenCalledOnce();
  expect(onEdit).not.toHaveBeenCalled();
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("menuitem", { name: "admin.users.details.edit_profile" }));
  expect(onEdit).toHaveBeenCalledOnce();
});
