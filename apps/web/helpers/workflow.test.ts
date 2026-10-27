import { expect, it } from "vitest";
import type { TProjectWorkflow } from "@plane/types";
import {
  getWorkflowErrorCode,
  getWorkflowErrorReason,
  workflowAllowsCreation,
  workflowAllowsTransition,
} from "./workflow";

const workflow: TProjectWorkflow = {
  id: "default",
  enabled: true,
  is_active: true,
  can_manage: true,
  initial_state_id: "todo",
  effective_initial_state_id: "todo",
  states: [
    { id: "backlog", name: "Backlog", color: "#60646c", group: "backlog", allow_creation: true },
    { id: "todo", name: "Todo", color: "#60646c", group: "unstarted", allow_creation: true },
    { id: "done", name: "Done", color: "#46a758", group: "completed", allow_creation: false },
  ],
  transitions: [{ id: "rule", source_id: "backlog", destination_id: "todo", member_ids: [] }],
};
it("keeps unconfigured and paused workflows unrestricted", () => {
  for (const policy of [undefined, { ...workflow, enabled: false }, { ...workflow, is_active: false }]) {
    expect(workflowAllowsCreation(policy, "done")).toBe(true);
    expect(workflowAllowsTransition(policy, "backlog", "done")).toBe(true);
  }
});
it("intersects state creation flags with workflow rules even when paused", () => {
  for (const policy of [undefined, workflow, { ...workflow, enabled: false }]) {
    expect(workflowAllowsCreation(policy, "todo", { allow_new_work_items: false })).toBe(false);
  }
  expect(workflowAllowsCreation(workflow, "done", { allow_new_work_items: true })).toBe(false);
  expect(workflowAllowsTransition(undefined, "todo", "done")).toBe(true);
});
it("uses creation policy independently from transition policy", () => {
  expect(workflowAllowsCreation(workflow, "todo")).toBe(true);
  expect(workflowAllowsCreation(workflow, "done")).toBe(false);
  expect(workflowAllowsTransition(workflow, "todo", "done")).toBe(true);
});
it("restricts only sources that have rules and permits same-state sorting", () => {
  expect(workflowAllowsTransition(workflow, "backlog", "todo")).toBe(true);
  expect(workflowAllowsTransition(workflow, "backlog", "done")).toBe(false);
  expect(workflowAllowsTransition(workflow, "backlog", "backlog")).toBe(true);
});
it("treats an empty member list as all, and otherwise requires a listed user", () => {
  const restricted = { ...workflow, transitions: [{ ...workflow.transitions[0], member_ids: ["reviewer"] }] };
  expect(workflowAllowsTransition(restricted, "backlog", "todo", "reviewer")).toBe(true);
  expect(workflowAllowsTransition(restricted, "backlog", "todo", "admin")).toBe(false);
  expect(workflowAllowsTransition(restricted, "backlog", "todo")).toBe(false);
});
it("extracts a readable precondition reason from direct and Axios errors", () => {
  expect(getWorkflowErrorReason({ workflow: "WORKFLOW_PRECONDITION_FAILED", reason: "请先提高优先级" })).toBe(
    "请先提高优先级"
  );
  expect(getWorkflowErrorReason({ response: { data: { reason: "Check required fields" } } })).toBe(
    "Check required fields"
  );
  expect(getWorkflowErrorReason({ reason: "x".repeat(600) })).toHaveLength(500);
});
it("extracts app, API and Axios policy errors without assuming their shape", () => {
  expect(getWorkflowErrorCode({ workflow: ["WORKFLOW_MEMBER_NOT_ALLOWED"] })).toBe("WORKFLOW_MEMBER_NOT_ALLOWED");
  expect(getWorkflowErrorCode({ response: { data: { destination_id: ["WORKFLOW_DUPLICATE_TRANSITION"] } } })).toBe(
    "WORKFLOW_DUPLICATE_TRANSITION"
  );
  expect(getWorkflowErrorCode({ response: { data: { workflow: "WORKFLOW_NO_CREATION_STATE" } } })).toBe(
    "WORKFLOW_NO_CREATION_STATE"
  );
  for (const value of [undefined, null, "failed", { detail: "Network error" }, { workflow: [] }])
    expect(getWorkflowErrorCode(value)).toBeUndefined();
});
