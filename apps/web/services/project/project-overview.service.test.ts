/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { expect, it, vi } from "vitest";
import { ProjectOverviewService, projectOverviewKey } from "./project-overview.service";

it("sends reaction deletion in the request body so only the current actor's selection is removed", async () => {
  const service = new ProjectOverviewService();
  const remove = vi.spyOn(service, "delete").mockResolvedValue({ data: undefined } as never);
  await service.deleteReaction("workspace", "project", "128077");
  expect(remove).toHaveBeenCalledWith("/api/workspaces/workspace/projects/project/reactions/", { reaction: "128077" });
});

it("passes the activity cursor with the default newest-first order and preserves the pagination response", async () => {
  const service = new ProjectOverviewService();
  const page = { results: [], next_cursor: "next", next_page_results: true };
  const read = vi.spyOn(service, "get").mockResolvedValue({ data: page } as never);
  expect(await service.getActivities("workspace", "project", "cursor:20")).toBe(page);
  expect(read).toHaveBeenCalledWith("/api/workspaces/workspace/projects/project/activities/", {
    params: { per_page: 20, order_by: "-created_at", cursor: "cursor:20" },
  });
});

it("requests the first activity page newest-first when optional arguments are omitted", async () => {
  const service = new ProjectOverviewService();
  const read = vi.spyOn(service, "get").mockResolvedValue({ data: { results: [] } } as never);
  await service.getActivities("workspace", "project");
  expect(read).toHaveBeenCalledWith("/api/workspaces/workspace/projects/project/activities/", {
    params: { per_page: 20, order_by: "-created_at" },
  });
});

it.each(["-created_at", "created_at"] as const)(
  "passes the %s activity order with both initial and subsequent page requests",
  async (orderBy) => {
    const service = new ProjectOverviewService();
    const page = { results: [], next_cursor: "20:1:0", next_page_results: true };
    const read = vi.spyOn(service, "get").mockResolvedValue({ data: page } as never);
    expect(await service.getActivities("workspace", "project", undefined, orderBy)).toBe(page);
    expect(read).toHaveBeenLastCalledWith("/api/workspaces/workspace/projects/project/activities/", {
      params: { per_page: 20, order_by: orderBy },
    });
    expect(await service.getActivities("workspace", "project", page.next_cursor, orderBy)).toBe(page);
    expect(read).toHaveBeenLastCalledWith("/api/workspaces/workspace/projects/project/activities/", {
      params: { per_page: 20, order_by: orderBy, cursor: "20:1:0" },
    });
  }
);

it("uses the authenticated project asset routes for attachment listing and deletion", async () => {
  const service = new ProjectOverviewService();
  const read = vi.spyOn(service, "get").mockResolvedValue({ data: [] } as never);
  const remove = vi.spyOn(service, "delete").mockResolvedValue({ data: undefined } as never);
  await service.getAttachments("workspace", "project");
  await service.deleteAttachment("workspace", "project", "attachment");
  expect(read).toHaveBeenCalledWith("/api/assets/v2/workspaces/workspace/projects/project/");
  expect(remove).toHaveBeenCalledWith("/api/assets/v2/workspaces/workspace/projects/project/attachment/");
});

it("preserves network failures for the component retry state", async () => {
  const service = new ProjectOverviewService();
  const error = new Error("offline");
  vi.spyOn(service, "get").mockRejectedValueOnce(error);
  await expect(service.getUpdates("workspace", "project")).rejects.toBe(error);
});

it("scopes update comments and reactions to their parent update", async () => {
  const service = new ProjectOverviewService();
  const comment = { id: "comment", body: "Hello" };
  const read = vi.spyOn(service, "get").mockResolvedValue({ data: [comment] } as never);
  const create = vi.spyOn(service, "post").mockResolvedValue({ data: comment } as never);
  const remove = vi.spyOn(service, "delete").mockResolvedValue({ data: undefined } as never);
  const patch = vi.spyOn(service, "patch").mockResolvedValue({ data: comment } as never);
  expect(await service.updateUpdateComment("workspace", "project", "update", "comment", "Edited")).toBe(comment);
  expect(patch).toHaveBeenCalledWith("/api/workspaces/workspace/projects/project/updates/update/comments/comment/", {
    body: "Edited",
  });
  expect(await service.getUpdateComments("workspace", "project", "update")).toEqual([comment]);
  expect(await service.createUpdateComment("workspace", "project", "update", "Hello")).toBe(comment);
  await service.deleteUpdateComment("workspace", "project", "update", "comment");
  await service.addUpdateReaction("workspace", "project", "update", "128077");
  await service.deleteUpdateReaction("workspace", "project", "update", "128077");
  const base = "/api/workspaces/workspace/projects/project/updates/update";
  expect(read).toHaveBeenCalledWith(`${base}/comments/`);
  expect(create).toHaveBeenCalledWith(`${base}/comments/`, { body: "Hello" });
  expect(remove).toHaveBeenCalledWith(`${base}/comments/comment/`);
  expect(create).toHaveBeenCalledWith(`${base}/reactions/`, { reaction: "128077" });
  expect(remove).toHaveBeenCalledWith(`${base}/reactions/`, { reaction: "128077" });
});

it("isolates overview cache entries by workspace, project and resource", () => {
  const entries = [
    projectOverviewKey("one", "project", "links"),
    projectOverviewKey("two", "project", "links"),
    projectOverviewKey("one", "other", "links"),
    projectOverviewKey("one", "project", "updates"),
  ];
  expect(new Set(entries.map((entry) => JSON.stringify(entry))).size).toBe(4);
});
