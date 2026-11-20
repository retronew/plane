import { describe, expect, it, vi } from "vitest";
import type { TNotification, TNotificationPaginatedInfo } from "@plane/types";
import { collectNotifications, notificationPath, shouldNotify } from "./feed";
const item = (id: string, time = "2026-11-17T00:00:00Z", extra: Partial<TNotification> = {}) =>
  ({ id, created_at: time, receiver: "user", ...extra }) as TNotification;
const page = (items: TNotification[], more = false, cursor?: string) =>
  ({ results: items, next_page_results: more, next_cursor: cursor }) as TNotificationPaginatedInfo;

describe("notification feed", () => {
  it("establishes a baseline without notifying historical items, including timestamp ties across pages", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page([item("a")], true, "next"))
      .mockResolvedValueOnce(page([item("b"), item("older", "2026-11-16T00:00:00Z")]));
    const result = await collectNotifications(fetch, true);
    expect(result.notifications).toEqual([]);
    expect(result.checkpoint.ids).toEqual(["a", "b"]);
    expect(fetch).toHaveBeenLastCalledWith(true, "next");
  });
  it("handles an empty initial stream", async () => {
    expect((await collectNotifications(async () => page([]), false)).checkpoint).toEqual({ time: 0, ids: [] });
  });
  it("deduplicates repeated pages and processes new items oldest first, including equal timestamps", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page([item("c", "2026-11-18T00:00:00Z"), item("b")], true, "next"))
      .mockResolvedValueOnce(page([item("b"), item("a"), item("old", "2026-11-16T00:00:00Z")]));
    const result = await collectNotifications(fetch, false, { time: Date.parse("2026-11-17T00:00:00Z"), ids: ["a"] });
    expect(result.notifications.map((n) => n.id)).toEqual(["b", "c"]);
    expect(result.checkpoint.ids).toEqual(["c"]);
  });
  it("does not silently advance on failed or cyclic pagination", async () => {
    const fetch = vi.fn().mockResolvedValue(page([item("a")], true, "same"));
    await expect(collectNotifications(fetch, false, { time: 0, ids: [] })).rejects.toThrow("cursor");
    await expect(
      collectNotifications(async () => {
        throw new Error("offline");
      }, false)
    ).rejects.toThrow("offline");
  });
  it("rejects malformed responses rather than establishing a false empty baseline", async () => {
    await expect(collectNotifications(async () => ({}) as TNotificationPaginatedInfo, false)).rejects.toThrow(
      "response"
    );
  });
  it("excludes read, archived, snoozed and other recipients", () => {
    expect(shouldNotify(item("a"), "user")).toBe(true);
    for (const extra of [
      { read_at: "today" },
      { archived_at: "today" },
      { snoozed_till: "today" },
      { receiver: "other" },
    ]) {
      expect(shouldNotify(item("a", undefined, extra), "user")).toBe(false);
    }
  });
  it("builds captured-workspace links for issues, approvals, intake and digests", () => {
    const issue = item("a", undefined, { entity_name: "issue", project: "project", data: { issue_id: "issue" } });
    expect(notificationPath(issue, "workspace")).toBe("/workspace/projects/project/issues/issue/");
    expect(notificationPath({ ...issue, is_inbox_issue: true }, "workspace")).toBe(
      "/workspace/projects/project/intake?inboxIssueId=issue"
    );
    expect(notificationPath(item("digest", undefined, { entity_name: "daily_digest" }), "workspace")).toBe(
      "/workspace/notifications/"
    );
    expect(notificationPath(item("unknown"), "other")).toBe("/other/notifications/");
  });
});
