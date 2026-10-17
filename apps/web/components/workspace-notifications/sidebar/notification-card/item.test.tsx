/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
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
