import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TProjectWorkflow } from "@plane/types";
import { WorkflowMetadata } from "./workflow-metadata";
import { WorkflowImpactDialog } from "./impact-dialog";
import { WorkflowRuleEditor } from "./rule-editor";
import type { DraftRule } from "./rule-editor";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({ lists: {}, service: {} }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getProjectStateIds: () => [], getStateById: () => undefined }),
}));
vi.mock("@/components/dropdowns/state/state-select", () => ({ StateSelect: () => null }));
vi.mock("@/components/dropdowns/member/member-select", () => ({ MemberSelect: () => null }));
vi.mock("./steps-editor", () => ({ WorkflowStepsEditor: () => null }));
vi.mock("./rule-cell", () => ({ WorkflowRulePreview: () => null }));
vi.mock("@makeplane/propel/components/input-field", () => ({
  InputField: ({ label, value }: { label: string; value: string }) => (
    <label>
      {label}
      <input value={value} readOnly />
    </label>
  ),
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick?: () => void }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("@makeplane/propel/components/icon-button", () => ({
  IconButton: ({ icon, ...props }: { icon: ReactNode; "aria-label": string; onClick: () => void }) => (
    <button {...props}>{icon}</button>
  ),
}));

const workflow = {
  id: "flow",
  name: "Workflow name",
  description: "Description",
  states: [{ id: "source", name: "Source state" }],
  transitions: [],
} as unknown as TProjectWorkflow;
const impact = {
  token: "preview",
  policy_version: 1,
  affected_count: 2,
  examples: [{ id: "issue", name: "Affected work item", state_id: "source", type_id: null }],
  required_state_ids: [],
  invalidated_approval_count: 0,
  warnings: [],
  state_mapping: {},
};

let finishAnimation: () => void;
beforeEach(() => {
  const finished = new Promise<void>((resolve) => {
    finishAnimation = resolve;
  });
  // JSDOM has no CSS transitions. Hold Base UI's real animation lifecycle open until settled.
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [{ finished }],
  });
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  vi.unstubAllGlobals();
});

it("animates metadata on its initial mount and waits for the close animation before completing", async () => {
  const onOpenChangeComplete = vi.fn();
  const props = {
    workflow,
    projectId: "p",
    workspaceSlug: "w",
    onClose: vi.fn(),
    onPreview: vi.fn(),
    onOpenChangeComplete,
  };
  const { rerender } = render(<WorkflowMetadata {...props} />);
  const dialog = screen.getByRole("dialog");
  expect(dialog.hasAttribute("data-starting-style")).toBe(true);
  await waitFor(() => expect(dialog.hasAttribute("data-starting-style")).toBe(false));

  rerender(<WorkflowMetadata {...props} open={false} />);
  expect(dialog.isConnected).toBe(true);
  expect(dialog.hasAttribute("data-ending-style")).toBe(true);
  expect((screen.getByLabelText("name") as HTMLInputElement).value).toBe("Workflow name");
  expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

  await act(async () => finishAnimation());
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
});

it("animates a new impact preview and retains affected items while closing", async () => {
  const onOpenChangeComplete = vi.fn();
  const props = {
    request: { operation: "delete" as const, workflow_id: "flow" },
    impact,
    projectId: "p",
    workspaceSlug: "w",
    onClose: vi.fn(),
    onApplied: vi.fn(),
    onOpenChangeComplete,
  };
  const { rerender } = render(<WorkflowImpactDialog {...props} />);
  const dialog = screen.getByRole("dialog");
  expect(dialog.hasAttribute("data-starting-style")).toBe(true);
  await waitFor(() => expect(dialog.hasAttribute("data-starting-style")).toBe(false));

  rerender(<WorkflowImpactDialog {...props} open={false} />);
  expect(dialog.hasAttribute("data-ending-style")).toBe(true);
  expect(screen.getByText("Affected work item")).toBeTruthy();
  expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

  await act(async () => finishAnimation());
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
});

it("retains the last rule until the drawer has finished closing and shows a new draft when reopened", async () => {
  const draft: DraftRule = { source_id: "source", destination_id: "target", member_ids: [] };
  const props = {
    workflow,
    projectId: "p",
    workspaceSlug: "w",
    onChange: vi.fn(),
    onSave: vi.fn(),
    busy: false,
  };
  const { rerender } = render(<WorkflowRuleEditor {...props} draft={null} />);
  rerender(<WorkflowRuleEditor {...props} draft={draft} />);
  const drawer = screen.getByRole("dialog");
  await waitFor(() => expect(drawer.hasAttribute("data-starting-style")).toBe(false));

  rerender(<WorkflowRuleEditor {...props} draft={null} />);
  expect(drawer.hasAttribute("data-ending-style")).toBe(true);
  expect(screen.getByText("Source state")).toBeTruthy();

  const nextWorkflow = { ...workflow, states: [...workflow.states, { id: "next", name: "Next state" }] };
  rerender(
    <WorkflowRuleEditor
      {...props}
      workflow={nextWorkflow as TProjectWorkflow}
      draft={{ ...draft, source_id: "next" }}
    />
  );
  expect(screen.getByText("Next state")).toBeTruthy();
  expect(screen.queryByText("Source state")).toBeNull();

  rerender(<WorkflowRuleEditor {...props} draft={null} />);
  await act(async () => finishAnimation());
  await waitFor(() => expect(drawer.isConnected).toBe(false));
});
