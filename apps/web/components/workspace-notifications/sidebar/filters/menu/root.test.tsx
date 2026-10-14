/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NotificationFilter } from "./root";
import { NotificationHeaderMenuOption } from "../../header/options/menu-option";
const { updateFilters, filters } = vi.hoisted(() => ({
  updateFilters: vi.fn(),
  filters: {
    type: { assigned: false, created: false, subscribed: false },
    read: false,
    archived: false,
    snoozed: false,
  },
}));
vi.mock("@/hooks/store/notifications", () => ({
  useWorkspaceNotifications: () => ({ filters, updateFilters, updateBulkFilters: vi.fn() }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ workspace: { workspaceMemberIds: [] }, getUserDetails: vi.fn() }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ workspaceProjectIds: [], getProjectById: vi.fn() }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
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
it("opens grouped filters and selects a priority without closing the menu", async () => {
  render(<NotificationFilter />);
  fireEvent.click(screen.getByRole("button", { name: "web.inbox_filters.label" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "priority" }));
  const high = await screen.findByRole("menuitemcheckbox", { name: "high" });
  fireEvent.click(high);
  await waitFor(() => expect(updateFilters).toHaveBeenCalledWith("priority", ["high"]));
  expect(screen.getByRole("menuitemcheckbox", { name: "high" })).toBeTruthy();
});
it("opens sort options and sends server-side ordering", async () => {
  render(<NotificationHeaderMenuOption />);
  fireEvent.click(screen.getByRole("button", { name: "web.inbox_filters.sort" }));
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "web.inbox_filters.oldest" }));
  expect(updateFilters).toHaveBeenCalledWith("order_by", "created_at");
});
