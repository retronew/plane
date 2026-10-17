import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { IUserProfileProjectSegregation } from "@plane/types";
import { ProfileSidebar } from "./sidebar";

const mock = vi.hoisted(() => ({ toggle: vi.fn(), edit: vi.fn() }));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ userId: "self" }) }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
  getCurrentLanguage: () => "en",
}));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ ProjectLogo: () => <span>Icon</span> }));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ profileSidebarCollapsed: false, toggleProfileSidebar: mock.toggle }),
}));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleProfileSettingsModal: mock.edit }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: (id: string) => ({ name: `Project ${id}` }) }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "self" } }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/common/cover-image", () => ({ CoverImage: () => null }));
vi.mock("./time", () => ({ ProfileSidebarTime: () => <span>12:00 Asia/Shanghai</span> }));
const data: IUserProfileProjectSegregation = {
  user_data: {
    first_name: "QA",
    last_name: "User",
    display_name: "qa",
    avatar_url: "",
    cover_image_url: null,
    date_joined: new Date("2026-10-14"),
    user_timezone: "Asia/Shanghai",
  },
  project_data: [
    { id: "One", created_issues: 4, assigned_issues: 2, completed_issues: 1, pending_issues: 1 },
    { id: "Two", created_issues: 0, assigned_issues: 0, completed_issues: 0, pending_issues: 0 },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
});
it("opens each project independently and keeps the completion count and details", async () => {
  render(<ProfileSidebar userProjectsData={data} />);
  const first = screen.getByRole("button", { name: /Project One/ });
  const second = screen.getByRole("button", { name: /Project Two/ });
  fireEvent.click(first);
  expect(first.getAttribute("aria-expanded")).toBe("true");
  expect(second.getAttribute("aria-expanded")).toBe("false");
  expect(await screen.findByText("4 issues")).toBeTruthy();
  expect(screen.getByText("50%")).toBeTruthy();
  expect(screen.queryByText("NaN%")).toBeNull();
  fireEvent.click(screen.getByText("50%"));
  expect(first.getAttribute("aria-expanded")).toBe("false");
});
it("opens profile editing from the current user's card", () => {
  render(<ProfileSidebar userProjectsData={data} />);
  fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
  expect(mock.edit).toHaveBeenCalledWith({ activeTab: "general", isOpen: true });
});
