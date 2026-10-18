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

it("previews and merges properties with the backend contract", async () => {
  const service = new CustomPropertiesService();
  const counts = { work_items_count: 12, draft_count: 2, type_count: 3 };
  const post = vi.spyOn(service, "post").mockResolvedValue(response(counts));
  expect(await service.previewMerge("w", "p", ["a", "b"])).toEqual(counts);
  expect(post).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/custom-properties/merge/preview/", {
    source_property_ids: ["a", "b"],
  });
  const input = { source_property_ids: ["a", "b"], name: "Combined", description: "Details" };
  const result = { ...counts, merged_count: 2, property: { id: "new" } };
  post.mockResolvedValue(response(result));
  expect(await service.merge("w", "p", input)).toEqual(result);
  expect(post).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/custom-properties/merge/", input);
});

it("preserves merge conflict responses for the dialog", async () => {
  const service = new CustomPropertiesService();
  const failure = { response: { status: 400, data: { code: "CUSTOM_PROPERTY_MERGE_TYPE_BINDING_CONFLICT" } } };
  vi.spyOn(service, "post").mockRejectedValue(failure);
  await expect(service.previewMerge("w", "p", ["a", "b"])).rejects.toBe(failure);
  await expect(service.merge("w", "p", { source_property_ids: ["a", "b"], name: "New", description: "" })).rejects.toBe(
    failure
  );
});

it("preserves failures for callers to retain input and offer retry", async () => {
  const service = new CustomPropertiesService();
  const failure = new Error("network");
  vi.spyOn(service, "put").mockRejectedValue(failure);
  await expect(service.updateValues("w", "p", "i", { field: 0 })).rejects.toBe(failure);
});
