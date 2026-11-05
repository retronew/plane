import { AxiosHeaders } from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { APIService } from "../api.service";
import { DailyDigestService } from "./daily-digest.service";

const response = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});
afterEach(() => vi.restoreAllMocks());
it("uses personal digest endpoints and previews without posting a delivery", async () => {
  const get = vi.spyOn(APIService.prototype, "get").mockResolvedValue(response({ enabled: false }));
  const patch = vi.spyOn(APIService.prototype, "patch").mockResolvedValue(response({ include_details: false }));
  const post = vi.spyOn(APIService.prototype, "post").mockResolvedValue(response({ sections: [] }));
  const service = new DailyDigestService();
  await service.retrieve();
  await service.update({ include_details: false });
  await service.preview();
  expect(get).toHaveBeenCalledWith("/api/users/me/daily-digest/");
  expect(patch).toHaveBeenCalledWith("/api/users/me/daily-digest/", { include_details: false });
  expect(post).toHaveBeenCalledExactlyOnceWith("/api/users/me/daily-digest/preview/", {});
});
it("preserves errors for the caller to handle", async () => {
  const error = new Error("offline");
  vi.spyOn(APIService.prototype, "patch").mockRejectedValue(error);
  await expect(new DailyDigestService().update({ enabled: true })).rejects.toBe(error);
});
