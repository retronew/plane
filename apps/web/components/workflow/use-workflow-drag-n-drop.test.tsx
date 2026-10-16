import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useWorkFlowFDragNDrop } from "./use-workflow-drag-n-drop";
const workflow = {
  enabled: true,
  is_active: true,
  states: [
    { id: "a", allow_creation: true },
    { id: "b", allow_creation: false },
    { id: "c", allow_creation: true },
  ],
  transitions: [{ source_id: "a", destination_id: "b", member_ids: ["reviewer"] }],
};
vi.mock("react-router", () => ({ useParams: () => ({ projectId: "p" }) }));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => ({ workflows: { p: workflow } }) }));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: (id: string) => ({ id, project_id: "p" }) }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "reviewer" } }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it("provides creation gating and sortable feedback for state columns", () => {
  const { result } = renderHook(() => useWorkFlowFDragNDrop("state"));
  expect(result.current.getIsWorkflowWorkItemCreationDisabled("b")).toBe(true);
  act(() => result.current.handleWorkFlowState("a", "c"));
  expect(result.current.isWorkflowDropDisabled).toBe(true);
  act(() => result.current.handleWorkFlowState("a", "b"));
  expect(result.current.isWorkflowDropDisabled).toBe(false);
});
it("respects state subgroups without restricting unrelated grouping", () => {
  const { result } = renderHook(() => useWorkFlowFDragNDrop("priority", "state"));
  expect(result.current.getIsWorkflowWorkItemCreationDisabled("high", "b")).toBe(true);
  act(() => result.current.handleWorkFlowState("high", "low", "a", "c"));
  expect(result.current.isWorkflowDropDisabled).toBe(true);
  const unrelated = renderHook(() => useWorkFlowFDragNDrop("priority"));
  expect(unrelated.result.current.getIsWorkflowWorkItemCreationDisabled("high")).toBe(false);
});
