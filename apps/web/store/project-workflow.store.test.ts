import { beforeEach, expect, it, vi } from "vitest";
import { ProjectWorkflowStore } from "./project-workflow.store";
const api = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock("@/services/project/workflow.service", () => ({
  ProjectWorkflowService: class {
    retrieve = api.retrieve;
  },
}));
beforeEach(() => {
  api.retrieve.mockReset();
});
const data = {
  id: "default",
  enabled: false,
  is_active: true,
  can_manage: true,
  states: [],
  transitions: [],
  initial_state_id: null,
  effective_initial_state_id: null,
};
it("deduplicates requests from many mounted controls and reuses the shared cache", async () => {
  api.retrieve.mockResolvedValue(data);
  const store = new ProjectWorkflowStore();
  await Promise.all([store.fetch("w", "p"), store.fetch("w", "p"), store.fetch("w", "p")]);
  await store.fetch("w", "p");
  expect(api.retrieve).toHaveBeenCalledTimes(1);
});
it("retains failed-request state and permits retry instead of caching a failure", async () => {
  api.retrieve.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(data);
  const store = new ProjectWorkflowStore();
  await expect(store.fetch("w", "p")).rejects.toThrow("offline");
  expect(store.errors.p).toBeTruthy();
  await store.fetch("w", "p");
  expect(store.errors.p).toBeUndefined();
  expect(store.workflows.p.enabled).toBe(false);
});
it("separates projects and replaces policy immediately after a successful edit", async () => {
  api.retrieve.mockResolvedValue(data);
  const store = new ProjectWorkflowStore();
  await Promise.all([store.fetch("w", "p1"), store.fetch("w", "p2")]);
  store.set("p1", { ...data, enabled: true });
  expect((await store.fetch("w", "p1")).enabled).toBe(true);
  expect((await store.fetch("w", "p2")).enabled).toBe(false);
  expect(api.retrieve).toHaveBeenCalledTimes(2);
});
it("does not let an older fetch replace a policy that was just saved", async () => {
  let complete!: (value: typeof data) => void;
  api.retrieve.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  const store = new ProjectWorkflowStore();
  const request = store.fetch("w", "p");
  store.set("p", { ...data, enabled: true });
  complete(data);
  expect((await request).enabled).toBe(true);
  expect(store.workflows.p.enabled).toBe(true);
});
it("refreshes creation choices and the initial state after project state edits, without loading unused policies", async () => {
  const store = new ProjectWorkflowStore();
  await store.refreshAfterStateChange("w", "unused");
  expect(api.retrieve).not.toHaveBeenCalled();
  store.set("p", data);
  api.retrieve.mockResolvedValue({
    ...data,
    enabled: true,
    effective_initial_state_id: "new",
    states: [{ id: "new", name: "New", group: "backlog", color: "#555", allow_creation: true }],
  });
  await store.refreshAfterStateChange("w", "p");
  expect(store.workflows.p.states.map((s) => s.id)).toEqual(["new"]);
  expect(store.workflows.p.effective_initial_state_id).toBe("new");
});
