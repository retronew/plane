import { beforeEach, expect, it, vi } from "vitest";
import { BaseIssuesStore } from "./base-issues.store";
import { ProjectWorkflowStore } from "@/store/project-workflow.store";
vi.mock("@/services/issue", () => ({ IssueService: vi.fn(), IssueArchiveService: vi.fn() }));
vi.mock("@/services/cycle.service", () => ({ CycleService: vi.fn() }));
vi.mock("@/services/module.service", () => ({ ModuleService: vi.fn() }));
vi.mock("./base-issues-utils", () => ({ getStateChangeTimestamps: () => ({}) }));

const defaultWorkflow = {
  id: "default",
  enabled: true,
  is_active: true,
  is_default: true,
  can_manage: true,
  initial_state_id: "a",
  effective_initial_state_id: "a",
  states: [
    { id: "a", name: "Todo", color: "#555", group: "unstarted" as const, allow_creation: true },
    { id: "b", name: "Done", color: "#555", group: "completed" as const, allow_creation: false },
  ],
  transitions: [{ id: "r", source_id: "a", destination_id: "a", member_ids: [] }],
};
const customWorkflow = {
  ...defaultWorkflow,
  id: "custom",
  is_default: false,
  issue_type_ids: ["bug"],
  states: defaultWorkflow.states.map((state) => ({ ...state, allow_creation: true })),
  transitions: [],
};
const workflow = new ProjectWorkflowStore();
const create = vi.fn(),
  patch = vi.fn(),
  update = vi.fn();
const fake = {
  rootIssueStore: {
    rootStore: { workflow, user: { data: { id: "member" } }, state: { getStateById: () => undefined } },
    issues: { getIssueById: () => ({ id: "i", project_id: "p", state_id: "a", type_id: "bug" }), updateIssue: update },
  },
  issueService: { createIssue: create, patchIssue: patch },
  addIssue: vi.fn(),
  fetchParentStats: vi.fn(),
  updateIssueList: vi.fn(),
  updateParentStats: vi.fn(),
};
beforeEach(() => {
  workflow.lists.p = {
    results: [defaultWorkflow, customWorkflow],
    count: 2,
    enabled: true,
    policy_version: 1,
    can_manage: true,
  };
  workflow.issueTypes.p = {
    results: [
      { id: "bug", project_issue_type_id: "pt", name: "Bug", is_default: true, is_active: true, workflow_id: "custom" },
    ],
    count: 1,
    can_manage: true,
    policy_version: 1,
  };
  vi.spyOn(workflow, "fetchList").mockResolvedValue(workflow.lists.p);
  vi.spyOn(workflow, "fetchTypes").mockResolvedValue(workflow.issueTypes.p);
  create.mockReset().mockResolvedValue({ id: "i" });
  patch.mockReset().mockResolvedValue({});
  update.mockReset();
});
it("creates a custom type in a state forbidden by the default workflow", async () => {
  await BaseIssuesStore.prototype.createIssue.call(fake as never, "w", "p", { type_id: "bug", state_id: "b" });
  expect(create).toHaveBeenCalledWith("w", "p", { type_id: "bug", state_id: "b" });
});
it("uses the existing type for update transition prechecks", async () => {
  await BaseIssuesStore.prototype.issueUpdate.call(fake as never, "w", "p", "i", { state_id: "b" });
  expect(patch).toHaveBeenCalledWith("w", "p", "i", { state_id: "b" });
});
it("reconciles optimistic changes with the saved server response", async () => {
  const saved = { id: "i", priority: "high", type_id: "bug", state_id: "a" };
  patch.mockResolvedValue(saved);
  await BaseIssuesStore.prototype.issueUpdate.call(fake as never, "w", "p", "i", { priority: "high" });
  expect(update).toHaveBeenLastCalledWith("i", saved);
});
it("keeps the store bound when updateIssue is passed as a drag-and-drop callback", async () => {
  class TestIssuesStore extends BaseIssuesStore {
    updateIssue = this.issueUpdate;
    fetchParentStats = vi.fn();
    updateParentStats = vi.fn();
    updateIssueList = vi.fn();
  }
  const store = new TestIssuesStore(fake.rootIssueStore as never, {} as never);
  store.issueService = fake.issueService as never;
  const { updateIssue } = store;

  await updateIssue("w", "p", "i", { sort_order: 100 });

  expect(patch).toHaveBeenCalledWith("w", "p", "i", { sort_order: 100 });
  expect(store.updateIssueList).toHaveBeenCalled();
});
it("keeps explicit null on creation mapped to the default workflow", async () => {
  await expect(
    BaseIssuesStore.prototype.createIssue.call(fake as never, "w", "p", { type_id: null, state_id: "b" })
  ).rejects.toEqual({ workflow: ["WORKFLOW_CREATION_NOT_ALLOWED"] });
  expect(create).not.toHaveBeenCalled();
});
