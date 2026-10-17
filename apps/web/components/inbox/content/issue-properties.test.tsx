import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { InboxIssueContentProperties } from "./issue-properties";
import type { TIssueOperations } from "@/components/issues/issue-detail";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ currentProjectDetails: { identifier: "INT" } }) }));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/dropdowns/intake-state/intake-state-select", () => ({
  IntakeStateSelect: () => <button disabled>Triage</button>,
}));
vi.mock("@/components/dropdowns/state/state-select", () => ({
  StateSelect: () => <button disabled>Accepted state</button>,
}));
vi.mock("@/components/dropdowns/member/member-select", () => ({
  MemberSelect: ({ onChange, disabled }: { onChange: (value: string[]) => void; disabled: boolean }) => (
    <button disabled={disabled} onClick={() => onChange(["member"])}>
      Choose member
    </button>
  ),
}));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({
  PrioritySelect: ({ onChange, disabled }: { onChange: (value: string) => void; disabled: boolean }) => (
    <button disabled={disabled} onClick={() => onChange("high")}>
      Choose priority
    </button>
  ),
}));
vi.mock("@plane/blocks/property-select", () => ({
  DateSelect: ({ onChange, disabled }: { onChange: (value: null) => void; disabled: boolean }) => (
    <button disabled={disabled} onClick={() => onChange(null)}>
      Clear date
    </button>
  ),
}));
vi.mock("@/components/issues/issue-detail/label", () => ({
  IssueLabel: ({ onLabelUpdate, disabled }: { onLabelUpdate: (value: string[]) => void; disabled: boolean }) => (
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      <span>First long label</span>
      <span>Second long label</span>
      <button disabled={disabled} onClick={() => onLabelUpdate(["first", "second"])}>
        Choose labels
      </button>
    </div>
  ),
}));

it("keeps property controls wired with multiple labels", () => {
  const update = vi.fn();
  render(
    <InboxIssueContentProperties
      workspaceSlug="workspace"
      projectId="project"
      issue={{ id: "issue", state_id: "state" }}
      issueOperations={{ update } as unknown as TIssueOperations}
      isEditable
      duplicateIssueDetails={undefined}
      isIntakeAccepted={false}
    />
  );
  fireEvent.click(screen.getByText("Choose member"));
  fireEvent.click(screen.getByText("Choose priority"));
  fireEvent.click(screen.getByText("Clear date"));
  fireEvent.click(screen.getByText("Choose labels"));
  expect(update.mock.calls.map((call) => call[3])).toEqual([
    { assignee_ids: ["member"] },
    { priority: "high" },
    { target_date: null },
    { label_ids: ["first", "second"] },
  ]);
  expect(screen.getByText("First long label")).toBeTruthy();
  expect(screen.getByText("Second long label")).toBeTruthy();
});

it("keeps all editable properties disabled for read-only intake items", () => {
  render(
    <InboxIssueContentProperties
      workspaceSlug="workspace"
      projectId="project"
      issue={{ id: "issue", state_id: "state" }}
      issueOperations={{ update: vi.fn() } as unknown as TIssueOperations}
      isEditable={false}
      duplicateIssueDetails={undefined}
      isIntakeAccepted={false}
    />
  );
  for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
});
