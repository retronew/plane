/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENotificationLoader, ENotificationQueryParamType, ENotificationTab } from "@plane/constants";
import type { TNotification, TNotificationPaginatedInfo } from "@plane/types";
import type { CoreRootStore } from "@/store/root.store";
import service from "@/services/workspace-notification.service";
import { WorkspaceNotificationStore } from "./workspace-notifications.store";
vi.mock("@/services/workspace-notification.service", () => ({
  default: { fetchNotifications: vi.fn(), fetchUnreadNotificationsCount: vi.fn(), markAllNotificationsAsRead: vi.fn() },
}));
const notification = (id: string) =>
  ({ id, workspace: "workspace", created_at: "2026-10-14", is_mentioned_notification: false }) as TNotification;
const page = (...ids: string[]) =>
  ({ results: ids.map(notification), next_cursor: "300:1:0" }) as TNotificationPaginatedInfo;
const store = () => new WorkspaceNotificationStore({ router: { workspaceSlug: "test" } } as CoreRootStore);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(service.fetchUnreadNotificationsCount).mockResolvedValue({
    total_unread_notifications_count: 2,
    mention_unread_notifications_count: 1,
  });
});
describe("notification queries", () => {
  it("sends all filters and keeps server ordering across pagination", async () => {
    const s = store();
    s.filters = {
      ...s.filters,
      priority: ["high", "urgent"],
      state_group: ["started"],
      project: ["p"],
      triggered_by: ["u"],
      assignees: ["a"],
      search: " word ",
      order_by: "priority",
    };
    vi.mocked(service.fetchNotifications).mockResolvedValueOnce(page("b", "a")).mockResolvedValueOnce(page("c"));
    await s.getNotifications("test");
    await s.getNotifications("test", ENotificationLoader.PAGINATION_LOADER, ENotificationQueryParamType.NEXT);
    expect(s.notificationIdsByWorkspaceId("workspace")).toEqual(["b", "a", "c"]);
    expect(service.fetchNotifications).toHaveBeenLastCalledWith(
      "test",
      expect.objectContaining({
        priority: "high,urgent",
        state_group: "started",
        project: "p",
        triggered_by: "u",
        assignees: "a",
        search: "word",
        order_by: "priority",
        cursor: "300:1:0",
      })
    );
  });
  it("ignores stale responses after filters change", async () => {
    const s = store();
    let resolveOld!: (value: TNotificationPaginatedInfo) => void;
    vi.mocked(service.fetchNotifications)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValueOnce(page("new"));
    const old = s.getNotifications("test");
    await vi.waitFor(() => expect(resolveOld).toBeDefined());
    await s.getNotifications("test");
    resolveOld(page("old"));
    await old;
    expect(s.notificationIdsByWorkspaceId("workspace")).toEqual(["new"]);
  });
  it("refresh replaces deleted or excluded results", async () => {
    const s = store();
    vi.mocked(service.fetchNotifications).mockResolvedValueOnce(page("old")).mockResolvedValueOnce(page("new"));
    await s.getNotifications("test");
    await s.getNotifications("test", ENotificationLoader.REFRESH, ENotificationQueryParamType.CURRENT);
    expect(s.notificationIdsByWorkspaceId("workspace")).toEqual(["new"]);
  });
  it("bulk read uses the complete active query and refreshes real counts", async () => {
    const s = store();
    s.currentNotificationTab = ENotificationTab.MENTIONS;
    s.filters.priority = ["high"];
    s.filters.read = true;
    await s.markAllNotificationsAsRead("test");
    expect(service.markAllNotificationsAsRead).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({ mentioned: true, priority: "high", read: false })
    );
    expect(s.unreadNotificationsCount.total_unread_notifications_count).toBe(2);
  });
});
