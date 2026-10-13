/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSidebarItemData } from "@/components/sidebar/sidebar-item";
import { withDockItems } from "./app-rail-hoc";

const state = vi.hoisted(() => ({
  pathname: "/acme/",
  lastWorkPath: "/acme/projects/p1/issues/",
  unread: 0,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "acme" }),
  usePathname: () => state.pathname,
}));
vi.mock("@/lib/app-rail/use-last-work-path", () => ({ useLastWorkPath: () => state.lastWorkPath }));
vi.mock("@/hooks/store/notifications", () => ({
  useWorkspaceNotifications: () => ({ unreadNotificationsCount: { total_unread_notifications_count: state.unread } }),
}));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));

type DockItem = AppSidebarItemData & { shouldRender: boolean };

const renderDockItems = (): DockItem[] => {
  let captured: DockItem[] = [];
  const Probe = withDockItems(({ dockItems }: { dockItems: DockItem[] }) => {
    captured = dockItems;
    return null;
  });
  render(<Probe />);
  return captured;
};

const byLabel = (items: DockItem[], label: string) => items.find((item) => item.label === label);

describe("withDockItems", () => {
  beforeEach(() => {
    state.pathname = "/acme/";
    state.unread = 0;
  });

  it("renders Projects and Inbox", () => {
    const items = renderDockItems();
    expect(items.map((item) => item.label)).toEqual(["web.projects", "web.inbox"]);
    expect(items.every((item) => item.shouldRender)).toBe(true);
    expect(byLabel(items, "web.inbox")?.href).toBe("/acme/notifications/");
  });

  it("points Projects at the workspace home while inside the work area", () => {
    state.pathname = "/acme/projects/p1/issues/";
    const projects = byLabel(renderDockItems(), "web.projects");
    expect(projects?.href).toBe("/acme/");
    expect(projects?.isActive).toBe(true);
  });

  it.each(["/acme/notifications/", "/acme/settings/members/"])(
    "points Projects back to the last work page from %s",
    (pathname) => {
      state.pathname = pathname;
      const projects = byLabel(renderDockItems(), "web.projects");
      expect(projects?.href).toBe("/acme/projects/p1/issues/");
      expect(projects?.isActive).toBe(false);
    }
  );

  it("marks Inbox active on the notifications page", () => {
    state.pathname = "/acme/notifications/";
    expect(byLabel(renderDockItems(), "web.inbox")?.isActive).toBe(true);
  });

  it("shows the unread dot only when there are unread notifications", () => {
    const { container: quiet } = render(<>{byLabel(renderDockItems(), "web.inbox")?.icon}</>);
    expect(quiet.querySelector(".bg-danger-primary")).toBeNull();
    state.unread = 3;
    const { container: busy } = render(<>{byLabel(renderDockItems(), "web.inbox")?.icon}</>);
    expect(busy.querySelector(".bg-danger-primary")).not.toBeNull();
  });
});
