import { beforeEach, expect, it, vi } from "vitest";
import { ProjectWorkflowStore } from "./project-workflow.store";
const api = vi.hoisted(() => ({ retrieve: vi.fn(), list: vi.fn(), types: vi.fn() }));
vi.mock("@/services/project/workflow.service", () => ({
  ProjectWorkflowService: class {
    retrieve = api.retrieve;
    list = api.list;
    types = api.types;
  },
}));
beforeEach(() => {
  api.retrieve.mockReset();
  api.list.mockReset();
  api.types.mockReset();
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
it("keeps parallel default, list and type reads regardless of response order", async () => {
  const store = new ProjectWorkflowStore();
  api.retrieve.mockResolvedValue(data);
  let completeList!: (value: unknown) => void, completeTypes!: (value: unknown) => void;
  api.list.mockReturnValue(
    new Promise((resolve) => {
      completeList = resolve;
    })
  );
  api.types.mockReturnValue(
    new Promise((resolve) => {
      completeTypes = resolve;
    })
  );
  const reads = [store.fetch("w", "p"), store.fetchList("w", "p"), store.fetchTypes("w", "p")];
  await reads[0];
  completeList({ results: [], count: 0, enabled: false, policy_version: 1, can_manage: true });
  completeTypes({ results: [], count: 0, policy_version: 1, can_manage: true });
  await Promise.all(reads);
  expect(store.lists.p.results).toEqual([]);
  expect(store.issueTypes.p.results).toEqual([]);
});
it("resolves default, explicit null and inactive type-bound workflows independently", async () => {
  const store = new ProjectWorkflowStore();
  const custom = { ...data, id: "custom", is_active: false, issue_type_ids: ["type"] };
  api.list.mockResolvedValue({
    results: [{ ...data, is_default: true }, custom],
    count: 2,
    enabled: true,
    policy_version: 2,
    can_manage: true,
  });
  api.types.mockResolvedValue({
    results: [{ id: "type", workflow_id: "custom", is_default: true }],
    count: 1,
    policy_version: 2,
    can_manage: true,
  });
  await Promise.all([store.fetchList("w", "p"), store.fetchTypes("w", "p")]);
  expect(store.resolve("p", "type")?.id).toBe("custom");
  expect(store.resolve("p")?.id).toBe("custom");
  expect(store.resolve("p", null)?.id).toBe("default");
});
it("does not let an older list overwrite a newly saved workflow and force fetches after pending", async () => {
  const store = new ProjectWorkflowStore();
  const list = {
    results: [{ ...data, is_default: true }],
    count: 1,
    enabled: false,
    policy_version: 1,
    can_manage: true,
  };
  api.list.mockResolvedValueOnce(list);
  await store.fetchList("w", "p");
  let complete!: (value: typeof list) => void;
  api.list
    .mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    )
    .mockResolvedValueOnce({ ...list, enabled: true, results: [{ ...data, is_default: true, enabled: true }] });
  const pending = store.fetchList("w", "p", true);
  store.set("p", { ...data, is_default: true, enabled: true });
  const forced = store.fetchList("w", "p", true);
  complete(list);
  await pending;
  expect(store.lists.p.enabled).toBe(true);
  await forced;
  expect(api.list).toHaveBeenCalledTimes(3);
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
