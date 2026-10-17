import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowApprovalCard } from "./approval-card";
const state = vi.hoisted(() => ({
  canDecide: true,
  decide: vi.fn(),
  fetch: vi.fn(),
  mutate: vi.fn(),
  toast: vi.fn(),
  pending: true,
  enabled: true,
  secondBranch: false,
  reapply: vi.fn(),
  history: [] as unknown[],
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "member" } }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: { getIssueById: () => ({ type_id: "type", state_id: "review" }), fetchIssue: state.fetch },
  }),
}));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({
    resolve: () => ({
      enabled: state.enabled,
      is_active: true,
      version: 3,
      states: [
        { id: "done", name: "Done" },
        { id: "todo", name: "Todo" },
      ],
      transitions: [{ kind: "approval", source_id: "review" }],
    }),
    service: { decide: state.decide, reapply: state.reapply },
  }),
}));
vi.mock("swr", () => ({
  default: () => ({
    data: {
      pending: state.pending
        ? {
            id: "approval",
            version: 4,
            can_decide: state.canDecide,
            branches: [
              {
                id: "branch",
                destination_id: "done",
                reject_state_id: "todo",
                approvers: [{ id: "member", name: "Snapshot name" }],
              },
              ...(state.secondBranch
                ? [
                    {
                      id: "other",
                      destination_id: "todo",
                      reject_state_id: "done",
                      approvers: [{ id: "bob", name: "Bob" }],
                    },
                  ]
                : []),
            ],
          }
        : null,
      results: state.history,
    },
    mutate: state.mutate,
  }),
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({
    label,
    disabled,
    onClick,
    children,
  }: {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
    children?: ReactNode;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
      {children}
    </button>
  ),
}));
beforeEach(() => {
  state.canDecide = true;
  state.pending = true;
  state.enabled = true;
  state.secondBranch = false;
  state.history = [];
  state.reapply.mockReset().mockResolvedValue({});
  state.decide.mockReset().mockResolvedValue({});
  state.fetch.mockReset().mockResolvedValue({});
  state.mutate.mockReset().mockResolvedValue({});
  state.toast.mockReset();
});
it("submits a versioned branch decision and reloads both approval and work item", async () => {
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.getByText(/Snapshot name/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.approve" }));
  await waitFor(() =>
    expect(state.decide).toHaveBeenCalledWith(
      "w",
      "p",
      "i",
      "approval",
      expect.objectContaining({
        transition_id: "branch",
        outcome: "approve",
        version: 4,
        idempotency_key: expect.any(String),
      })
    )
  );
  await waitFor(() => expect(state.fetch).toHaveBeenCalledWith("w", "p", "i"));
  expect(state.mutate).toHaveBeenCalled();
});
it("keeps decision controls disabled for ineligible or read-only members", () => {
  state.canDecide = false;
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect((screen.getByRole("button", { name: "web.workflow_ui.approve" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "web.workflow_ui.reject" }) as HTMLButtonElement).disabled).toBe(true);
});
it("disables other branches when the actor belongs to only one approver snapshot", () => {
  state.secondBranch = true;
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  const approve = screen.getAllByRole("button", { name: "web.workflow_ui.approve" }) as HTMLButtonElement[];
  expect(approve[0].disabled).toBe(false);
  expect(approve[1].disabled).toBe(true);
});
it("reapplies without confusing the workflow version with an approval version", async () => {
  state.pending = false;
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.reapply" }));
  await waitFor(() => expect(state.reapply).toHaveBeenCalledWith("w", "p", "i"));
});
it("retains history after workflow enforcement is paused", () => {
  state.pending = false;
  state.enabled = false;
  state.history = [{ id: "past", status: "cancelled", created_at: "2026-10-16", decision: null }];
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.getByText("web.workflow_ui.approval_status.cancelled")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "web.workflow_ui.reapply" })).toBeNull();
});
it("keeps the same idempotency key when retrying a failed decision", async () => {
  state.decide.mockRejectedValueOnce({ workflow: "WORKFLOW_APPROVAL_STALE" }).mockResolvedValueOnce({});
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.approve" }));
  await waitFor(() => expect(state.toast).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.approve" }));
  await waitFor(() => expect(state.decide).toHaveBeenCalledTimes(2));
  expect(state.decide.mock.calls[0][4].idempotency_key).toBe(state.decide.mock.calls[1][4].idempotency_key);
});
