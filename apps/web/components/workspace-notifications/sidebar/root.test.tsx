/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { NotificationsSidebarRoot } from "./root";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/notifications", () => ({
  useWorkspaceNotifications: () => ({
    filters: { type: { assigned: false, created: false, subscribed: false } },
    updateFilters: vi.fn(),
    currentSelectedNotificationId: undefined,
    unreadNotificationsCount: { total_unread_notifications_count: 0, mention_unread_notifications_count: 0 },
    loader: "init-loader",
    notificationIdsByWorkspaceId: () => undefined,
    currentNotificationTab: "all",
    setCurrentNotificationTab: vi.fn(),
  }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace-id", slug: "workspace" }) }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ workspace: { workspaceMemberIds: [] }, getUserDetails: vi.fn() }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ workspaceProjectIds: [], getProjectById: vi.fn() }),
}));
vi.mock("../notification-card/root", () => ({ NotificationCardListRoot: () => null }));

it("renders the notification sidebar on its route while notifications load", () => {
  render(
    <MemoryRouter initialEntries={["/workspace/notifications"]}>
      <Routes>
        <Route path="/:workspaceSlug/notifications" element={<NotificationsSidebarRoot />} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByRole("heading", { name: "notification.label" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "notification.tabs.all" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "web.inbox_filters.label" })).toBeTruthy();
});
