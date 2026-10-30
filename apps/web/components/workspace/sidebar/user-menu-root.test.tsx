import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { UserMenuRoot } from "./user-menu-root";

const mocks = vi.hoisted(() => ({
  adminStatus: vi.fn(),
  toggle: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/services/user.service", () => ({
  UserService: class {
    currentUserInstanceAdminStatus = mocks.adminStatus;
  },
}));
vi.mock("@plane/constants", () => ({
  GOD_MODE_URL: "/god-mode/",
  PROFILE_SETTINGS_CATEGORIES: [],
  GROUPED_PROFILE_SETTINGS: {},
  PROFILE_SETTINGS: {},
  PROFILE_SETTINGS_TABS: [],
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => (key === "enter_god_mode" ? "管理后台" : key) }),
}));
vi.mock("@plane/utils", () => ({ getFileURL: () => "" }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@makeplane/propel/components/avatar", () => ({ Avatar: () => null }));
vi.mock("@makeplane/propel/components/icon", () => ({ Icon: () => null }));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuTrigger: () => null,
  MenuSeparator: () => null,
  MenuItem: ({ label, onClick }: { label: string; onClick: () => void }) => <button onClick={onClick}>{label}</button>,
  MenuLinkItem: ({
    label,
    href,
    external,
    variant,
    icon,
  }: {
    label: string;
    href: string;
    external: boolean;
    variant: string;
    icon: ReactNode;
  }) => (
    <a href={href} target={external ? "_blank" : undefined} data-variant={variant}>
      {icon}
      {label}
    </a>
  ),
}));
vi.mock("@/components/common/cover-image", () => ({ CoverImage: () => null }));
vi.mock("@/components/sidebar/sidebar-item", () => ({ AppSidebarItem: { Icon: () => null } }));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ toggleAnySidebarDropdown: mocks.toggle }),
}));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleProfileSettingsModal: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "user-1" }, signOut: vi.fn() }),
}));
vi.mock("@/hooks/use-password-management", () => ({
  usePasswordManagement: () => ({ canManagePassword: true }),
}));

function renderMenu() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <UserMenuRoot />
    </SWRConfig>
  );
}

describe("instance admin menu entry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the admin panel to instance admins and navigates to it", async () => {
    mocks.adminStatus.mockResolvedValue({ is_instance_admin: true });
    renderMenu();
    const link = await screen.findByRole("link", { name: "管理后台" });
    expect(link.getAttribute("href")).toBe("/god-mode/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("data-variant")).toBe("neutral");
    const signOut = screen.getByRole("button", { name: "sign_out" });
    expect(link.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides the entry from users without instance admin permission", async () => {
    mocks.adminStatus.mockResolvedValue({ is_instance_admin: false });
    renderMenu();
    await vi.waitFor(() => expect(mocks.adminStatus).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link", { name: "管理后台" })).toBeNull();
  });

  it("hides the entry while permission is loading", () => {
    mocks.adminStatus.mockReturnValue(new Promise(() => {}));
    renderMenu();
    expect(screen.queryByRole("link", { name: "管理后台" })).toBeNull();
  });

  it("hides the entry when the permission request fails", async () => {
    mocks.adminStatus.mockRejectedValue(new Error("Forbidden"));
    renderMenu();
    await vi.waitFor(() => expect(mocks.adminStatus).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link", { name: "管理后台" })).toBeNull();
  });
});
