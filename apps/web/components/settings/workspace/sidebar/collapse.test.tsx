/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  WorkspaceSettingsSidebarProvider,
  WorkspaceSettingsDesktopSidebar,
  WorkspaceSettingsSidebarToggle,
} from "./collapse";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
function Settings() {
  return (
    <WorkspaceSettingsSidebarProvider>
      <WorkspaceSettingsDesktopSidebar>
        <WorkspaceSettingsSidebarToggle />
        <a href="/settings/members">Members</a>
      </WorkspaceSettingsDesktopSidebar>
      <WorkspaceSettingsSidebarToggle onlyWhenCollapsed />
    </WorkspaceSettingsSidebarProvider>
  );
}
beforeEach(() => localStorage.removeItem("workspace_settings_sidebar_collapsed"));
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
