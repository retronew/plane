import { AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APIService } from "../api.service";
import { NotificationPreferencesService } from "./notification-preferences.service";
const response = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});
afterEach(() => vi.restoreAllMocks());
describe("notification preference API contract", () => {
  it("passes workspace and project IDs as query parameters", async () => {
    const scope = { workspace_id: "workspace", project_id: "project" };
    const get = vi.spyOn(APIService.prototype, "get").mockResolvedValue(response({ scope }));
    const service = new NotificationPreferencesService();
    await expect(service.retrieve(scope)).resolves.toEqual({ scope });
    expect(get).toHaveBeenCalledWith("/api/users/me/notification-preferences/v2/", { params: scope });
  });
  it("preserves null inheritance in sparse patches", async () => {
    const scope = { workspace_id: "workspace" };
    const patch = vi.spyOn(APIService.prototype, "patch").mockResolvedValue(response({}));
    const data = { events: { email: { mention: null, comment: false } } };
    await new NotificationPreferencesService().update(data, scope);
    expect(patch).toHaveBeenCalledWith("/api/users/me/notification-preferences/v2/", data, { params: scope });
  });
  it("uses the personal Feishu endpoints for status and test", async () => {
    const get = vi.spyOn(APIService.prototype, "get").mockResolvedValue(response({ enabled: true, binding: null }));
    const post = vi.spyOn(APIService.prototype, "post").mockResolvedValue(response({ status: "pending" }));
    const destroy = vi.spyOn(APIService.prototype, "delete").mockResolvedValue(response(undefined));
    const service = new NotificationPreferencesService();
    await service.feishuStatus();
    await service.testFeishu();
    expect(get).toHaveBeenCalledWith("/api/users/me/integrations/feishu/");
    expect(post).toHaveBeenCalledWith("/api/users/me/integrations/feishu/test/", {});
    expect(post).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
    expect(service).not.toHaveProperty("authorizeFeishu");
    expect(service).not.toHaveProperty("unlinkFeishu");
  });
  it("preserves network errors for caller recovery", async () => {
    const error = new Error("offline");
    vi.spyOn(APIService.prototype, "get").mockRejectedValue(error);
    await expect(new NotificationPreferencesService().retrieve()).rejects.toBe(error);
  });
});
