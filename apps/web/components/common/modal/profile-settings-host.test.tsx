import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProfileSettingsHost } from "./profile-settings-host";

const state = vi.hoisted(() => ({ user: { id: "user" } as { id: string } | null, toggle: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: state.user }) }));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleProfileSettingsModal: state.toggle }),
}));
vi.mock("@/components/settings/profile/modal", () => ({ ProfileSettingsModal: () => <div>profile modal host</div> }));

function Location() {
  const location = useLocation();
  return (
    <output>
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProfileSettingsHost />
      <Location />
    </MemoryRouter>
  );
}

describe("global personal settings host", () => {
  beforeEach(() => {
    state.user = { id: "user" };
    vi.clearAllMocks();
  });

  it("opens without workspace context and only removes its own query marker", async () => {
    const view = mount(
      "/create-workspace?profileSettings=general&oidc_linked=1&oidc_email=a%40example.com&other=keep#return"
    );
    await waitFor(() => expect(state.toggle).toHaveBeenCalledWith({ activeTab: "general", isOpen: true }));
    expect(view.container.querySelector("output")?.textContent).toBe(
      "/create-workspace?oidc_linked=1&oidc_email=a%40example.com&other=keep#return"
    );
  });

  it("waits until the compatibility route has reached its background page", () => {
    mount("/settings/profile/general?profileSettings=general&oidc_linked=1");
    expect(state.toggle).not.toHaveBeenCalled();
  });

  it("does not expose personal settings before authentication", () => {
    state.user = null;
    const view = mount("/create-workspace?profileSettings=security");
    expect(state.toggle).not.toHaveBeenCalled();
    expect(view.queryByText("profile modal host")).toBeNull();
  });
});
