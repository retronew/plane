/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SettingsSidebarProvider, SettingsDesktopSidebar, SettingsSidebarToggle } from "./collapse";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
function Settings({ scope = "workspace" }: { scope?: "workspace" | "project" }) {
  return (
    <SettingsSidebarProvider scope={scope}>
      <SettingsDesktopSidebar>
        <SettingsSidebarToggle />
        <a href="/settings/members">Members</a>
      </SettingsDesktopSidebar>
      <SettingsSidebarToggle onlyWhenCollapsed />
    </SettingsSidebarProvider>
  );
}
beforeEach(() => {
  localStorage.removeItem("workspace_settings_sidebar_collapsed");
  localStorage.removeItem("project_settings_sidebar_collapsed");
});
it("collapses, removes hidden navigation from accessibility and restores it", () => {
  render(<Settings />);
  fireEvent.click(screen.getByRole("button", { name: "web.workspace_sidebar.collapse" }));
  expect(screen.queryByRole("link", { name: "Members" })).toBeNull();
  expect(document.getElementById("workspace-settings-sidebar")?.hasAttribute("inert")).toBe(true);
  expect(localStorage.getItem("workspace_settings_sidebar_collapsed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "web.workspace_sidebar.expand" }));
  expect(screen.getByRole("link", { name: "Members" })).toBeTruthy();
  expect(localStorage.getItem("workspace_settings_sidebar_collapsed")).toBe("false");
});
it("restores the user's collapsed preference on a fresh mount", async () => {
  localStorage.setItem("workspace_settings_sidebar_collapsed", "true");
  render(<Settings />);
  await waitFor(() => expect(screen.getByRole("button", { name: "web.workspace_sidebar.expand" })).toBeTruthy());
  expect(screen.queryByRole("link", { name: "Members" })).toBeNull();
});

it("persists project collapse independently from workspace settings and targets the active sidebar", () => {
  const view = render(<Settings scope="project" />);
  const collapse = screen.getByRole("button", { name: "web.workspace_sidebar.collapse" });
  expect(collapse.getAttribute("aria-controls")).toBe("project-settings-sidebar");
  fireEvent.click(collapse);
  expect(localStorage.getItem("project_settings_sidebar_collapsed")).toBe("true");
  expect(localStorage.getItem("workspace_settings_sidebar_collapsed")).toBeNull();
  expect(document.getElementById("project-settings-sidebar")?.hasAttribute("inert")).toBe(true);

  view.rerender(<Settings scope="workspace" />);
  expect(screen.getByRole("link", { name: "Members" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "web.workspace_sidebar.collapse" }).getAttribute("aria-controls")).toBe(
    "workspace-settings-sidebar"
  );

  view.rerender(<Settings scope="project" />);
  expect(screen.queryByRole("link", { name: "Members" })).toBeNull();
  expect(screen.getByRole("button", { name: "web.workspace_sidebar.expand" }).getAttribute("aria-controls")).toBe(
    "project-settings-sidebar"
  );
});
