import { AxiosHeaders } from "axios";
import { expect, it, vi } from "vitest";
import { CustomPropertiesService } from "./custom-properties.service";

const response = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

it("uses project and type definition endpoints, and merges value keys with PUT including null", async () => {
  const service = new CustomPropertiesService();
  const definitions = { results: [], count: 0, can_manage: false };
  const get = vi.spyOn(service, "get").mockResolvedValue(response(definitions));
  expect(await service.list("w", "p")).toEqual(definitions);
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/custom-properties/");
  await service.list("w", "p", "bug");
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/issue-types/bug/custom-properties/");
  await service.values("w", "p", "i");
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/issues/i/custom-properties/");
  const put = vi.spyOn(service, "put").mockResolvedValue(response({ values: { p: null } }));
  await service.updateValues("w", "p", "i", { p: null });
  expect(put).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/issues/i/custom-properties/", {
    values: { p: null },
  });
  await service.bindType("w", "p", "bug", "field", { is_active: true, is_required: false });
  expect(put).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/issue-types/bug/custom-properties/field/", {
    is_active: true,
    is_required: false,
  });
});

it("preserves failures for callers to retain input and offer retry", async () => {
  const service = new CustomPropertiesService();
  const failure = new Error("network");
  vi.spyOn(service, "put").mockRejectedValue(failure);
  await expect(service.updateValues("w", "p", "i", { field: 0 })).rejects.toBe(failure);
});
