/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SitesIssueService } from "../issue/sites-issue.service";
import { UserService } from "../user/user.service";
import { APIService } from "../api.service";
import { InstanceService } from "../instance/instance.service";
import { SitesProjectPublishService } from "./sites-publish.service";

afterEach(() => vi.restoreAllMocks());
const response = (data: Record<string, unknown>) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});

describe("public site startup requests", () => {
  const requests = [
    () => new InstanceService().info(),
    () => new SitesProjectPublishService().retrieveSettingsByAnchor("demo"),
    () => new SitesProjectPublishService().retrieveSettingsByProjectId("workspace", "project"),
  ];
  it.each(requests)("preserves network errors so loading can terminate", async (request) => {
    const failure = new Error("Network Error");
    vi.spyOn(APIService.prototype, "get").mockRejectedValue(failure);
    await expect(request()).rejects.toBe(failure);
  });
  it.each(requests)("rejects malformed successful responses", async (request) => {
    vi.spyOn(APIService.prototype, "get").mockResolvedValue(response({}));
    await expect(request()).rejects.toThrow(/Invalid/);
  });
  it.each(requests)("bounds request duration without accepting HTTP errors", async (request) => {
    const get = vi.spyOn(APIService.prototype, "get").mockResolvedValue(response({ instance: {}, anchor: "demo" }));
    await request();
    expect(get.mock.calls[0][1]).toEqual({ timeout: 15_000 });
  });
  it("rejects network errors and invalid work-item lists, while accepting an empty board", async () => {
    const service = new SitesIssueService();
    const failure = new Error("Network Error");
    const get = vi
      .spyOn(APIService.prototype, "get")
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ results: [] }));
    await expect(service.list("demo", {})).rejects.toBe(failure);
    await expect(service.list("demo", {})).rejects.toThrow("Invalid public issues response");
    await expect(service.list("demo", {})).resolves.toEqual({ results: [] });
    expect(get).toHaveBeenLastCalledWith("/api/public/anchor/demo/issues/", { params: {}, timeout: 15_000 });
  });
  it("passes Space initialization deadlines through to user requests", async () => {
    const get = vi.spyOn(APIService.prototype, "get").mockResolvedValue(response({}));
    await new UserService().me({ timeout: 15_000 });
    await new UserService().profile({ timeout: 15_000 });
    expect(get).toHaveBeenNthCalledWith(1, "/api/users/me/", {}, { timeout: 15_000 });
    expect(get).toHaveBeenNthCalledWith(2, "/api/users/me/profile/", {}, { timeout: 15_000 });
  });
  it("preserves HTTP status for a missing published board", async () => {
    const missingResponse = { status: 404, data: { detail: "Not found" } };
    vi.spyOn(APIService.prototype, "get").mockRejectedValue({ response: missingResponse });
    await expect(new SitesProjectPublishService().retrieveSettingsByAnchor("missing")).rejects.toBe(missingResponse);
  });
});
