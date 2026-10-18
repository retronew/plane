import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { THierarchyPreview, THierarchyRequest, TProjectIssueHierarchy } from "@plane/types";
import type { ProjectWorkflowService } from "@/services/project/workflow.service";
import { HierarchyImpactDialog } from "./hierarchy-impact-dialog";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const request: THierarchyRequest = {
  enabled: true,
  default_level: 0,
  policy_version: 1,
  type_levels: [{ type_id: "task", level: 0 }],
};
const config: TProjectIssueHierarchy = {
  enabled: true,
  default_level: 0,
  policy_version: 2,
  can_manage: true,
  levels: [0],
  issue_types: [
    {
      id: "task",
      project_issue_type_id: "pt",
      name: "Task",
      level: 0,
      is_active: true,
      is_default: true,
      workflow_id: null,
    },
  ],
};
const preview: THierarchyPreview = {
  ...request,
  levels: [0],
  token: "signed",
  conflict_count: 1,
  examples: [
    {
      kind: "issue",
      id: "child",
      name: "Child",
      parent_id: "parent",
      parent_name: "Parent",
      level: 0,
      parent_level: 0,
      reason: "level",
    },
  ],
};
const service = { previewHierarchy: vi.fn(), applyHierarchy: vi.fn(), hierarchy: vi.fn() };
beforeEach(() => {
  service.previewHierarchy.mockReset().mockResolvedValue(preview);
  service.applyHierarchy.mockReset().mockResolvedValue({ applied: true, config, detached_count: 1 });
  service.hierarchy.mockReset().mockResolvedValue(config);
});
function setup(onApplied = vi.fn().mockResolvedValue(undefined)) {
  render(
    <HierarchyImpactDialog
      open
      request={request}
      service={service as unknown as ProjectWorkflowService}
      workspaceSlug="w"
      projectId="p"
      onClose={vi.fn()}
      onClosed={vi.fn()}
      onApplied={onApplied}
    />
  );
  return onApplied;
}
it("requires explicit text before detaching conflicting relationships and sends the signed full request", async () => {
  const onApplied = setup();
  await screen.findByText("Parent → Child");
  const confirm = screen.getByRole("button", { name: "confirm" });
  expect(confirm.matches(":disabled")).toBe(true);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "web.issue_hierarchy.confirm_word" } });
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(service.applyHierarchy).toHaveBeenCalledWith("w", "p", { ...request, token: "signed", confirm_detach: true })
  );
  expect(onApplied).toHaveBeenCalledWith(config);
  expect(screen.getByText("web.issue_hierarchy.detach_hint")).toBeTruthy();
});
it("keeps the draft after 409 and requires a new preview and confirmation", async () => {
  service.applyHierarchy.mockRejectedValueOnce({ response: { status: 409 } });
  setup();
  await screen.findByRole("textbox");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "web.issue_hierarchy.confirm_word" } });
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await screen.findByText("web.issue_hierarchy.stale");
  expect(screen.queryByRole("button", { name: "confirm" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.refresh_preview" }));
  await screen.findByRole("textbox");
  expect(service.previewHierarchy).toHaveBeenLastCalledWith("w", "p", { ...request, policy_version: 2 });
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("button", { name: "confirm" }).matches(":disabled")).toBe(true);
});
it("does not repeat a successful mutation when refresh fails", async () => {
  service.previewHierarchy.mockResolvedValue({ ...preview, conflict_count: 0, examples: [] });
  setup(vi.fn().mockRejectedValue(new Error("refresh failed")));
  await screen.findByText("web.issue_hierarchy.final_levels");
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await waitFor(() => expect(service.applyHierarchy).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "confirm" }).matches(":disabled")).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  expect(service.applyHierarchy).toHaveBeenCalledTimes(1);
});
