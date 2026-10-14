/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TNotification } from "@plane/types";
import { NotificationContent } from "./content";

vi.mock("@/components/editor/lite-text", () => ({ LiteTextEditor: () => <div>评论正文</div> }));
const notification = (field: string, verb: string, newValue: string, oldValue = "") =>
  ({
    triggered_by_details: { display_name: "Alice", is_bot: false },
    data: { issue_activity: { field, verb, new_value: newValue, old_value: oldValue } },
  }) as TNotification;

describe("notification sentence localization", () => {
  beforeEach(async () => {
    await setLanguage("zh-CN");
  });
  afterEach(async () => {
    await act(async () => {
      await setLanguage("en");
    });
  });
  it.each([
    ["assignees", "created", "Bob", "", "Alice添加了负责人Bob。"],
    ["labels", "deleted", "", "Bug", "Alice移除了标签Bug。"],
    ["priority", "updated", "high", "", "Alice将优先级设为高。"],
    ["None", "created", "", "", "Alice将工作项分配给了您。"],
  ])("localizes %s notifications", (field, verb, newValue, oldValue, expected) => {
    const { container } = render(
      <NotificationContent
        notification={notification(field, verb, newValue, oldValue)}
        workspaceId="w"
        workspaceSlug="workspace"
        projectId="p"
      />
    );
    expect(container.textContent?.replace(/\s/g, "")).toBe(expected);
  });
  it("preserves rich comments and updates language", async () => {
    const { container } = render(
      <NotificationContent
        notification={notification("comment", "created", "<p>hello</p>")}
        workspaceId="w"
        workspaceSlug="workspace"
        projectId="p"
        renderCommentBox
      />
    );
    expect(container.textContent?.replace(/\s/g, "")).toBe("Alice发表了评论。评论正文");
    await act(async () => {
      await setLanguage("en");
    });
    expect(container.textContent).toContain("commented.");
    expect(container.textContent).toContain("评论正文");
  });
});
