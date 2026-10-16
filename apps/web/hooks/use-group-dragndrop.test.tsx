import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import type { TIssue } from "@plane/types";
import type { GroupDropLocation } from "@/components/issues/issue-layouts/utils";
import { useGroupIssuesDragNDrop } from "./use-group-dragndrop";

const state = vi.hoisted(() => ({
  allowed: true,
  update: vi.fn(),
  cycle: vi.fn(),
  module: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "w" }) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("./store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueById: () => ({ state_id: "a" }) } }),
}));
vi.mock("./store/use-issues", () => ({
  useIssues: () => ({
    issues: {
      getIssueIds: vi.fn(),
      addCycleToIssue: state.cycle,
      removeCycleFromIssue: vi.fn(),
      changeModulesInIssue: state.module,
    },
  }),
}));
vi.mock("./use-issues-actions", () => ({ useIssuesActions: () => ({ updateIssue: state.update }) }));
vi.mock("./store/user", () => ({ useUser: () => ({ data: { id: "u" } }) }));
vi.mock("./store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({ fetch: vi.fn().mockResolvedValue({}) }),
}));
vi.mock("@/helpers/workflow", () => ({
  workflowAllowsTransition: () => state.allowed,
  getWorkflowErrorCode: () => "WORKFLOW_TRANSITION_NOT_ALLOWED",
}));
vi.mock("@/store/issue/helpers/base-issues.store", () => ({
  ISSUE_FILTER_DEFAULT_DATA: { module: "module_ids", cycle: "cycle_id" },
}));
vi.mock("@/components/issues/issue-layouts/utils", () => ({
  handleGroupDragDrop: (
    _source: unknown,
    _destination: unknown,
    _getIssue: unknown,
    _getIds: unknown,
    update: (project: string, issue: string, data: Partial<TIssue>, changes: object) => Promise<void>
  ) =>
    update("p", "i", { state_id: "b", cycle_id: "c", module_ids: ["m"] }, { module_ids: { ADD: ["m"], REMOVE: [] } }),
}));

beforeEach(() => {
  state.allowed = true;
  for (const mock of [state.update, state.cycle, state.module]) mock.mockReset().mockResolvedValue(undefined);
  state.toast.mockReset();
});
const source = { id: "a" } as GroupDropLocation;
const destination = { id: "b" } as GroupDropLocation;

it("rejects a forbidden drag before changing any grouping dimension", async () => {
  state.allowed = false;
  const { result } = renderHook(() => useGroupIssuesDragNDrop(EIssuesStoreType.PROJECT, "sort_order", "state"));
  await result.current(source, destination);
  expect(state.update).not.toHaveBeenCalled();
  expect(state.cycle).not.toHaveBeenCalled();
  expect(state.module).not.toHaveBeenCalled();
});

it("leaves cycle and module unchanged if the API rejects a stale rule", async () => {
  state.update.mockRejectedValueOnce({ workflow: ["WORKFLOW_TRANSITION_NOT_ALLOWED"] });
  const { result } = renderHook(() => useGroupIssuesDragNDrop(EIssuesStoreType.PROJECT, "sort_order", "state"));
  await result.current(source, destination);
  expect(state.update).toHaveBeenCalledWith("p", "i", { state_id: "b" });
  expect(state.cycle).not.toHaveBeenCalled();
  expect(state.module).not.toHaveBeenCalled();
  expect(state.toast).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "web.workflow_errors.WORKFLOW_TRANSITION_NOT_ALLOWED",
    })
  );
});

it("saves an allowed state before changing cycle and module", async () => {
  const { result } = renderHook(() => useGroupIssuesDragNDrop(EIssuesStoreType.PROJECT, "sort_order", "state"));
  await result.current(source, destination);
  expect(state.cycle).toHaveBeenCalledWith("w", "p", "c", "i");
  expect(state.module).toHaveBeenCalledWith("w", "p", "i", ["m"], []);
  expect(state.update.mock.invocationCallOrder[0]).toBeLessThan(state.cycle.mock.invocationCallOrder[0]);
});
