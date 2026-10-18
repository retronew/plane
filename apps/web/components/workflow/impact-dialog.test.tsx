import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowImpactDialog } from "./impact-dialog";
const state = vi.hoisted(() => ({
  preview: vi.fn(),
  apply: vi.fn(),
  refresh: vi.fn(),
  onApplied: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({
    lists: {},
    service: { preview: state.preview, apply: state.apply },
    refresh: state.refresh,
  }),
}));
vi.mock("@makeplane/propel/components/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Part,
    DialogContent: Part,
    DialogMain: Part,
    DialogHeader: Part,
    DialogHeading: Part,
    DialogTitle: Part,
    DialogBody: Part,
    DialogActions: Part,
  };
});
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick?: () => void }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("@/components/dropdowns/state/state-select", () => ({
  StateSelect: ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
    <select aria-label="mapping" value={value || ""} onChange={(event) => onChange(event.target.value)}>
      <option value="">none</option>
      <option value="target">Target</option>
    </select>
  ),
}));
const impact = {
  token: "first",
  policy_version: 1,
  affected_count: 2,
  examples: [],
  required_state_ids: ["old"],
  invalidated_approval_count: 1,
  warnings: [],
  state_mapping: {},
};
beforeEach(() => {
  state.preview.mockReset().mockResolvedValue({ ...impact, token: "mapped" });
  state.apply.mockReset().mockResolvedValue({});
  state.refresh.mockReset().mockResolvedValue({});
  state.onApplied.mockReset();
});
it("requires a new preview token after mapping changes before applying", async () => {
  render(
    <WorkflowImpactDialog
      workspaceSlug="w"
      projectId="p"
      request={{ operation: "states", workflow_id: "flow", state_ids: ["target"] }}
      impact={impact}
      onClose={() => undefined}
      onApplied={state.onApplied}
    />
  );
  expect((screen.getByRole("button", { name: "confirm" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("mapping"), { target: { value: "target" } });
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.refresh_preview" }));
  await waitFor(() =>
    expect(state.preview).toHaveBeenCalledWith("w", "p", expect.objectContaining({ state_mapping: { old: "target" } }))
  );
  expect(state.apply).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "confirm" }));
  await waitFor(() =>
    expect(state.apply).toHaveBeenCalledWith(
      "w",
      "p",
      expect.objectContaining({ token: "mapped", state_mapping: { old: "target" } })
    )
  );
  await waitFor(() => expect(state.onApplied).toHaveBeenCalled());
});

it("does not notify a parent after an in-flight apply is unmounted", async () => {
  let finish!: () => void;
  state.apply.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const { unmount } = render(
    <WorkflowImpactDialog
      workspaceSlug="w"
      projectId="p"
      request={{ operation: "states", workflow_id: "flow", state_ids: ["target"] }}
      impact={{ ...impact, required_state_ids: [] }}
      onClose={vi.fn()}
      onApplied={state.onApplied}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  expect(state.apply).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => finish());
  expect(state.refresh).toHaveBeenCalledWith("w", "p");
  expect(state.onApplied).not.toHaveBeenCalled();
});
it("suppresses errors from a preview after the dialog closes", async () => {
  let fail!: (reason: Error) => void;
  state.toast.mockClear();
  state.preview.mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      })
  );
  const props = {
    workspaceSlug: "w",
    projectId: "p",
    request: { operation: "states" as const, workflow_id: "flow", state_ids: ["target"] },
    impact,
    onClose: vi.fn(),
    onApplied: state.onApplied,
  };
  const { rerender } = render(<WorkflowImpactDialog {...props} />);
  fireEvent.change(screen.getByLabelText("mapping"), { target: { value: "target" } });
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.refresh_preview" }));
  rerender(<WorkflowImpactDialog {...props} open={false} />);
  await act(async () => fail(new Error("late failure")));
  expect(state.toast).not.toHaveBeenCalled();
});
