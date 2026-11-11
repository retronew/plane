import { expect, it, vi } from "vitest";
import { AxiosHeaders } from "axios";
import { MemberWorkService, memberWorkParams, memberWorkItemHref } from "./member-work.service";
import type { MemberWorkItem } from "./member-work.service";

it("omits date params for all deadlines and normalizes projects", () => {
  expect(memberWorkParams({ projectIds: [] })).toEqual({});
  expect(memberWorkParams({ projectIds: ["b", "a", "b"] })).toEqual({ project_ids: "a,b" });
  expect(memberWorkParams({ projectIds: [], startDate: "2026-01-01", endDate: "2026-01-01" })).toEqual({
    start_date: "2026-01-01",
    end_date: "2026-01-01",
  });
});
it.each([
  ["2026-01-01", undefined],
  [undefined, "2026-01-01"],
  ["2026-1-01", "2026-01-02"],
  ["2026-02-30", "2026-03-01"],
  ["2026-03-02", "2026-03-01"],
])("rejects invalid paired range %s %s", (startDate, endDate) => {
  expect(() => memberWorkParams({ projectIds: [], startDate, endDate })).toThrow();
});
it("requests only the selected member page with the same scope and status", async () => {
  const service = new MemberWorkService();
  const get = vi.spyOn(service, "get").mockResolvedValue({
    data: { results: [], count: 0, next_page: null },
    status: 200,
    statusText: "OK",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
  await service.getMember(
    "workspace",
    "user",
    { projectIds: ["p"], startDate: "2026-01-01", endDate: "2026-02-01" },
    "unreviewed",
    2
  );
  expect(get).toHaveBeenCalledWith("/api/workspaces/workspace/member-work/user/", {
    params: {
      project_ids: "p",
      start_date: "2026-01-01",
      end_date: "2026-02-01",
      status: "unreviewed",
      page: 2,
      page_size: 20,
    },
  });
});
it("preserves network errors for retry", async () => {
  const service = new MemberWorkService();
  const error = new Error("offline");
  vi.spyOn(service, "get").mockRejectedValue(error);
  await expect(service.getOverview("w", { projectIds: [] })).rejects.toBe(error);
});
it("uses the real browse URL and existing comment anchor only when available", () => {
  const item = { project_identifier: "TASK", sequence_id: 42, reason_comment_id: "comment-id" } as MemberWorkItem;
  expect(memberWorkItemHref("w", item)).toBe("/w/browse/TASK-42/");
  expect(memberWorkItemHref("w", item, true)).toBe("/w/browse/TASK-42/#comment-comment-id");
  expect(memberWorkItemHref("w", { ...item, reason_comment_id: null }, true)).toBe("/w/browse/TASK-42/");
});
