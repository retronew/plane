/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TNotification } from "@plane/types";
import { NotificationItem } from "./item";

const { state, markNotificationAsRead, setCurrentSelectedNotificationId, setPeekIssue } = vi.hoisted(() => ({
  state: { notification: undefined as TNotification | undefined },
  markNotificationAsRead: vi.fn(),
  setCurrentSelectedNotificationId: vi.fn(),
  setPeekIssue: vi.fn(),
}));
vi.mock("@/hooks/store/notifications", () => ({
  useWorkspaceNotifications: () => ({ setCurrentSelectedNotificationId }),
}));
vi.mock("@/hooks/store/notifications/use-notification", () => ({
  useNotification: () => ({ asJson: state.notification, markNotificationAsRead }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ getIsIssuePeeked: () => false, setPeekIssue }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace-id" }) }),
}));
vi.mock("@/components/editor/lite-text", () => ({ LiteTextEditor: () => null }));
vi.mock("./options", () => ({ NotificationOption: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  // Matches the payload written by sync_issue_approval, without issue_activity.
  state.notification = {
    id: "approval-notification",
    workspace: "workspace-id",
    project: "project-id",
    title: "Approval requested: Review release",
    sender: "in_app",
    data: {
      issue_id: "issue-id",
      project_id: "project-id",
      approval_id: "approval-id",
      event: "approval_requested",
      entry_sequence: 1,
    },
    is_inbox_issue: false,
    read_at: null,
  } as unknown as TNotification;
});

it("renders an existing approval notification without an issue activity", () => {
  render(<NotificationItem workspaceSlug="workspace" notificationId="approval-notification" />);
  expect(screen.getByText("Awaiting approval")).toBeTruthy();
  expect(screen.getByText("Approval requested: Review release")).toBeTruthy();
  expect(markNotificationAsRead).not.toHaveBeenCalled();
});

afterEach(async () => {
  await act(async () => {
    await setLanguage("en");
  });
});

it("localizes existing approval titles and responds to language changes", async () => {
  await setLanguage("zh-CN");
  render(<NotificationItem workspaceSlug="workspace" notificationId="approval-notification" />);
  expect(screen.getByText("待审批")).toBeTruthy();
  expect(screen.getByText("审批请求：Review release")).toBeTruthy();
  expect(screen.queryByText(/Approval requested/)).toBeNull();
  await act(async () => {
    await setLanguage("en");
  });
  expect(screen.getByText("Approval requested: Review release")).toBeTruthy();
});

it("preserves colons and repeated approval prefixes in work item names", async () => {
  await setLanguage("zh-CN");
  state.notification!.title = "Approval requested: Approval requested: release: v2";
  render(<NotificationItem workspaceSlug="workspace" notificationId="approval-notification" />);
  expect(screen.getByText("审批请求：Approval requested: release: v2")).toBeTruthy();
});

it("renders approval notifications with no title", async () => {
  await setLanguage("zh-CN");
  state.notification!.title = undefined;
  render(<NotificationItem workspaceSlug="workspace" notificationId="approval-notification" />);
  expect(screen.getAllByText("待审批")).toHaveLength(2);
});

it("preserves ordinary notification titles", async () => {
  await setLanguage("zh-CN");
  state.notification!.data = {} as TNotification["data"];
  state.notification!.title = "Approval requested: user-written title";
  render(<NotificationItem workspaceSlug="workspace" notificationId="approval-notification" />);
  expect(screen.getAllByText("Approval requested: user-written title")).toHaveLength(2);
});

it("opens the work item referenced by an approval notification", async () => {
  render(<NotificationItem workspaceSlug="workspace" notificationId="approval-notification" />);
  fireEvent.click(screen.getByText("Awaiting approval"));
  await waitFor(() =>
    expect(setPeekIssue).toHaveBeenLastCalledWith({
      workspaceSlug: "workspace",
      projectId: "project-id",
      issueId: "issue-id",
    })
  );
  expect(setCurrentSelectedNotificationId).toHaveBeenCalledWith("approval-notification");
  expect(markNotificationAsRead).toHaveBeenCalledWith("workspace");
});

it("ignores a notification that has not loaded yet", () => {
  state.notification = undefined;
  const { container } = render(<NotificationItem workspaceSlug="workspace" notificationId="missing" />);
  expect(container.textContent).toBe("");
});
