import { beforeEach, expect, it, vi } from "vitest";
import { runInAction } from "mobx";
import type { IState } from "@plane/types";
import type { RootStore } from "./root.store";
import { StateStore } from "./state.store";
const { patchState } = vi.hoisted(() => ({ patchState: vi.fn() }));
vi.mock("@/services/project/project-state.service", () => ({
  ProjectStateService: class {
    patchState = patchState;
  },
}));
beforeEach(() => vi.clearAllMocks());
const makeStore = () => {
  const s = new StateStore({ router: { workspaceSlug: "test", projectId: "p" } } as RootStore);
  runInAction(() => {
    s.stateMap = {
      a: { id: "a", group: "backlog", sequence: 100, name: "First" } as IState,
      b: { id: "b", group: "started", sequence: 200, name: "Other" } as IState,
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
