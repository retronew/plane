import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowApprovalCard } from "./approval-card";
const state = vi.hoisted(() => ({
  loading: false,
  canDecide: true,
  canWithdraw: false,
  withdraw: vi.fn(),
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
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { name?: string }) => (params?.name ? `${key}: ${params.name}` : key),
  }),
  // `getDateTimeFormatter` (used for the run timestamps) reads the active language.
  getCurrentLanguage: () => "en",
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@plane/blocks/dialog", () => ({
  ConfirmDialog: ({
    isOpen,
    title,
    content,
    children,
    handleClose,
    handleSubmit,
  }: {
    isOpen: boolean;
    title: string;
    content: string;
    children?: ReactNode;
    handleClose: () => void;
    handleSubmit: () => void;
  }) =>
    isOpen ? (
      <div role="alertdialog" aria-label={title}>
        <p>{content}</p>
        {children}
        <button onClick={handleClose}>cancel</button>
        <button onClick={handleSubmit}>confirm</button>
      </div>
    ) : null,
}));
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
    service: { decide: state.decide, reapply: state.reapply, withdraw: state.withdraw },
  }),
}));
vi.mock("swr", () => ({
  default: () => ({
    data: state.loading
      ? undefined
      : {
          pending: state.pending
            ? {
                id: "approval",
                version: 4,
                can_decide: state.canDecide,
                can_withdraw: state.canWithdraw,
                previous_state_id: "todo",
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
  state.loading = false;
  state.canDecide = true;
  state.canWithdraw = false;
  state.withdraw.mockReset().mockResolvedValue({});
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
it("does not add a loading text above the description skeleton while approvals load", () => {
  state.loading = true;
  const view = render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(view.container.childElementCount).toBe(0);

  state.loading = false;
  view.rerender(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled />);
  expect(screen.getByText(/Snapshot name/)).toBeTruthy();
});

it("submits a versioned branch decision and reloads both approval and work item", async () => {
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.getByText(/Snapshot name/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.approve" }));
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
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
it("requires confirmation and leaves the approval unchanged when cancelled", () => {
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.reject" }));
  expect(screen.getByRole("alertdialog", { name: "web.workflow_ui.confirm_reject" })).toBeTruthy();
  expect(state.decide).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(state.decide).not.toHaveBeenCalled();
});

it("shows the actor from the decision's matching branch snapshot and its destination", () => {
  state.pending = false;
  state.history = [
    {
      id: "past",
      source_id: "review",
      status: "rejected",
      created_at: "2026-10-16",
      branches: [
        {
          id: "branch",
          destination_id: "done",
          reject_state_id: "todo",
          approvers: [{ id: "past-user", name: "Historical reviewer" }],
        },
      ],
      decision: {
        actor_id: "past-user",
        transition_id: "branch",
        outcome: "reject",
        at: "2026-11-04T08:00:00Z",
        note: "Missing acceptance evidence.",
      },
    },
  ];
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.getByText("web.workflow_ui.decision_by: Historical reviewer")).toBeTruthy();
  const actorLink = screen.getByRole("link", { name: "Historical reviewer" });
  expect(actorLink.getAttribute("href")).toBe("/w/profile/past-user/");
  expect(actorLink.querySelector('[data-slot="avatar"], img, [role="img"]')).toBeTruthy();
  expect(screen.getByText("Todo")).toBeTruthy();
  expect(screen.getByText("Missing acceptance evidence.")).toBeTruthy();
});

it("shows withdrawn history with the applicant link and restored state", () => {
  state.pending = false;
  state.history = [
    {
      id: "withdrawn",
      source_id: "review",
      status: "cancelled",
      created_at: "2026-10-16",
      branches: [],
      decision: null,
      withdrawal: {
        actor_id: "requester",
        actor_name: "Original requester",
        at: "2026-11-04T09:00:00Z",
        previous_state_id: "todo",
      },
    },
  ];
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.getByText("web.workflow_ui.withdrawn")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Original requester" }).getAttribute("href")).toBe("/w/profile/requester/");
  expect(screen.getByText("Todo")).toBeTruthy();
});

it("submits approval notes only after confirmation and preserves them in the request", async () => {
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.reject" }));
  fireEvent.change(screen.getByRole("textbox", { name: "web.workflow_ui.approval_note_optional" }), {
    target: { value: "Please add acceptance evidence." },
  });
  expect(state.decide).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await waitFor(() =>
    expect(state.decide).toHaveBeenCalledWith(
      "w",
      "p",
      "i",
      "approval",
      expect.objectContaining({ outcome: "reject", note: "Please add acceptance evidence." })
    )
  );
});

it("requires confirmation to withdraw and submits the approval version", async () => {
  state.canWithdraw = true;
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.withdraw_approval" }));
  expect(state.withdraw).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(state.withdraw).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.withdraw_approval" }));
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await waitFor(() =>
    expect(state.withdraw).toHaveBeenCalledWith(
      "w",
      "p",
      "i",
      "approval",
      expect.objectContaining({ version: 4, idempotency_key: expect.any(String) })
    )
  );
});

it("hides withdrawal when the server does not grant it", () => {
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.queryByRole("button", { name: "web.workflow_ui.withdraw_approval" })).toBeNull();
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
it("does not show an empty history disclosure when only the pending approval exists", () => {
  state.history = [{ id: "approval", status: "pending", created_at: "2026-10-16", decision: null }];
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.queryByText("web.workflow_ui.approval_history")).toBeNull();
  expect(screen.getByRole("button", { name: "web.workflow_ui.approve" })).toBeTruthy();
});

it("shows past approvals separately from the current pending approval", () => {
  state.history = [
    { id: "approval", status: "pending", created_at: "2026-10-16", decision: null },
    { id: "past", status: "cancelled", created_at: "2026-10-15", branches: [], decision: null },
  ];
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.getByText("web.workflow_ui.approval_history")).toBeTruthy();
  expect(screen.getByText("1")).toBeTruthy();
  expect(screen.getByText("web.workflow_ui.approval_status.cancelled")).toBeTruthy();
  expect(screen.queryByText("web.workflow_ui.approval_status.pending")).toBeNull();
});

it("retains history after workflow enforcement is paused", () => {
  state.pending = false;
  state.enabled = false;
  state.history = [{ id: "past", status: "cancelled", created_at: "2026-10-16", branches: [], decision: null }];
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  expect(screen.getByText("web.workflow_ui.approval_status.cancelled")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "web.workflow_ui.reapply" })).toBeNull();
});
it("keeps the same idempotency key when retrying a failed decision", async () => {
  state.decide.mockRejectedValueOnce({ workflow: "WORKFLOW_APPROVAL_STALE" }).mockResolvedValueOnce({});
  render(<WorkflowApprovalCard workspaceSlug="w" projectId="p" issueId="i" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.approve" }));
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await waitFor(() => expect(state.toast).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.approve" }));
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await waitFor(() => expect(state.decide).toHaveBeenCalledTimes(2));
  expect(state.decide.mock.calls[0][4].idempotency_key).toBe(state.decide.mock.calls[1][4].idempotency_key);
});
