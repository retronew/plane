import { beforeEach, expect, it, vi } from "vitest";
import { runInAction } from "mobx";
import type { IState, TProjectWorkflow } from "@plane/types";
import type { RootStore } from "./root.store";
import { StateStore } from "./state.store";
const { patchState, createState, refreshWorkflow } = vi.hoisted(() => ({
  patchState: vi.fn(),
  createState: vi.fn(),
  refreshWorkflow: vi.fn(),
}));
vi.mock("@/services/project/project-state.service", () => ({
  ProjectStateService: class {
    patchState = patchState;
    createState = createState;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  refreshWorkflow.mockResolvedValue(undefined);
});
const makeStore = () => {
  const s = new StateStore({
    router: { workspaceSlug: "test", projectId: "p" },
    workflow: { workflows: {}, refreshAfterStateChange: refreshWorkflow },
  } as unknown as RootStore);
  runInAction(() => {
    s.fetchedMap.p = true;
    s.stateMap = {
      a: { id: "a", project_id: "p", default: true, group: "backlog", sequence: 100, name: "First" } as IState,
      b: { id: "b", project_id: "p", group: "started", sequence: 200, name: "Other" } as IState,
    };
  });
  return s;
};
it("keeps an optimistic move after it is persisted", async () => {
  patchState.mockResolvedValue({});
  const s = makeStore();
  await s.moveStatePosition("test", "p", "a", { group: "started", sequence: 300 });
  expect(s.stateMap.a).toMatchObject({ group: "started", sequence: 300 });
  expect(patchState).toHaveBeenCalledWith("test", "p", "a", { group: "started", sequence: 300 });
  expect(refreshWorkflow).toHaveBeenCalledWith("test", "p");
});
it("refreshes workflow creation choices after creating a project state", async () => {
  const s = makeStore();
  createState.mockResolvedValue({ id: "new", project_id: "p", group: "unstarted", name: "New" });
  await s.createState("test", "p", { name: "New", group: "unstarted" });
  expect(s.stateMap.new.name).toBe("New");
  expect(refreshWorkflow).toHaveBeenCalledWith("test", "p");
});
it("uses the active workflow initial state and falls back to the project default when disabled", () => {
  const s = makeStore();
  s.rootStore.workflow.workflows.p = {
    enabled: true,
    is_active: true,
    effective_initial_state_id: "b",
  } as TProjectWorkflow;
  expect(s.getProjectDefaultStateId("p")).toBe("b");
  s.rootStore.workflow.workflows.p.enabled = false;
  expect(s.getProjectDefaultStateId("p")).toBe("a");
});
it("restores the moved state on failure while preserving unrelated concurrent edits", async () => {
  let reject!: (reason: Error) => void;
  patchState.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  const s = makeStore();
  const pending = s.moveStatePosition("test", "p", "a", { group: "started", sequence: 300 });
  expect(s.stateMap.a.group).toBe("started");
  runInAction(() => {
    s.stateMap.b.name = "Concurrent edit";
  });
  reject(new Error("Network failed"));
  await expect(pending).rejects.toThrow("Network failed");
  expect(s.stateMap.a).toMatchObject({ group: "backlog", sequence: 100 });
  expect(s.stateMap.b.name).toBe("Concurrent edit");
});
