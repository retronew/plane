import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TIssueOperations } from "../issue-detail";
import { PeekOverviewProperties } from "./properties";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ estimate: true, module_view: true, cycle_view: true }) }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: { getIssueById: () => ({ id: "issue", project_id: "project", state_id: "state", created_by: "creator" }) },
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: () => ({ group: "started" }) }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: () => ({ id: "creator", display_name: "Long creator name" }) }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: {} }) }));
vi.mock("@/components/dropdowns/member/avatar", () => ({ ButtonAvatars: () => null }));
vi.mock("@/components/dropdowns/state/state-select", () => ({
  StateSelect: ({ disabled, onChange }: { disabled: boolean; onChange: (value: string) => void }) => (
    <button disabled={disabled} onClick={() => onChange("next")}>
      Change state
    </button>
  ),
}));
vi.mock("@/components/dropdowns/member/member-select", () => ({
  MemberSelect: ({ disabled, onChange }: { disabled: boolean; onChange: (value: string[]) => void }) => (
    <button disabled={disabled} onClick={() => onChange(["member"])}>
      Change assignees
    </button>
  ),
}));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({
  PrioritySelect: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Priority</button>,
}));
vi.mock("@/components/dropdowns/estimate/estimate-select", () => ({
  EstimateSelect: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Estimate</button>,
}));
vi.mock("@plane/blocks/property-select", () => ({
  DateSelect: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Date</button>,
}));
vi.mock("../issue-detail/module-select", () => ({
  IssueModuleSelect: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Modules</button>,
}));
vi.mock("../issue-detail/cycle-select", () => ({
  IssueCycleSelect: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Cycle</button>,
}));
vi.mock("@/components/issues/parent-select-root", () => ({
  IssueParentSelectRoot: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Parent</button>,
}));
vi.mock("../issue-detail/label", () => ({
  IssueLabel: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Labels</button>,
}));
vi.mock("@/components/issues/custom-properties", () => ({
  IssueCustomProperties: ({ disabled }: { disabled: boolean }) => (
    <button disabled={disabled}>Custom properties</button>
  ),
}));

const props = { workspaceSlug: "workspace", projectId: "project", issueId: "issue", embedIssue: true };
it("retains all regular issue properties and update operations in embedded notifications", () => {
  const update = vi.fn();
  render(
    <PeekOverviewProperties {...props} disabled={false} issueOperations={{ update } as unknown as TIssueOperations} />
  );
  for (const label of ["Estimate", "Modules", "Cycle", "Parent", "Labels", "Custom properties"])
    expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText("Long creator name")).toBeTruthy();
  fireEvent.click(screen.getByText("Change state"));
  fireEvent.click(screen.getByText("Change assignees"));
  expect(update).toHaveBeenCalledWith("workspace", "project", "issue", { state_id: "next" });
  expect(update).toHaveBeenCalledWith("workspace", "project", "issue", { assignee_ids: ["member"] });
});
it("retains read-only controls for embedded notifications", () => {
  render(
    <PeekOverviewProperties {...props} disabled issueOperations={{ update: vi.fn() } as unknown as TIssueOperations} />
  );
  for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
});
