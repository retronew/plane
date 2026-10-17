import { expect, it, vi } from "vitest";
import type { AxiosResponse } from "axios";
import { CycleService } from "./cycle.service";

it.each([
  { incomplete_action: "keep" } as const,
  { incomplete_action: "transfer", target_cycle_id: "target" } as const,
])("posts the completion payload unchanged: $incomplete_action", async (payload) => {
  const service = new CycleService();
  const response = { cycle: { id: "source" }, target_cycle: null, transferred_issues_count: 0 };
  const post = vi.spyOn(service, "post").mockResolvedValue({ data: response } as AxiosResponse);
  await expect(service.completeCycle("workspace", "project", "source", payload)).resolves.toBe(response);
  expect(post).toHaveBeenCalledWith("/api/workspaces/workspace/projects/project/cycles/source/complete/", payload);
});

it("preserves completion validation details", async () => {
  const service = new CycleService();
  const details = { error: "The target cycle must be upcoming." };
  vi.spyOn(service, "post").mockRejectedValue({ response: { data: details } });
  await expect(service.completeCycle("w", "p", "c", { incomplete_action: "keep" })).rejects.toBe(details);
});

it("preserves completion network errors", async () => {
  const service = new CycleService();
  const error = new Error("Network error");
  vi.spyOn(service, "post").mockRejectedValue(error);
  await expect(service.completeCycle("w", "p", "c", { incomplete_action: "keep" })).rejects.toBe(error);
});
