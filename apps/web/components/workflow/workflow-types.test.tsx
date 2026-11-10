import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TProjectIssueType, TProjectWorkflow } from "@plane/types";
import { WorkflowTypes } from "./workflow-types";
const state = vi.hoisted(() => ({
  store: {
    issueTypes: {} as Record<string, { results: TProjectIssueType[] }>,
    service: { preview: vi.fn(), apply: vi.fn() },
  },
  toast: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      key === "web.runtime.remove_named" ? `Remove ${values?.name}` : key,
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => state.store }));
vi.mock("./types-logo", () => ({ TypesLogo: () => <span data-testid="type-logo" /> }));
vi.mock("./impact-dialog", () => ({
  WorkflowImpactDialog: ({ request, open }: { request: unknown; open: boolean }) =>
    open ? <dialog open>{JSON.stringify(request)}</dialog> : null,
}));
const workflow: TProjectWorkflow = {
  id: "custom",
  workflow_id: "custom",
  is_default: false,
  can_manage: true,
  enabled: true,
  is_active: true,
  initial_state_id: null,
  effective_initial_state_id: null,
  states: [],
  transitions: [],
};
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.clearAllMocks();
  // The shared Select virtualizes options; jsdom otherwise measures a zero-height list.
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(256);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(240);
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  state.store.issueTypes = {
    p: {
      results: [
        { id: "task", project_issue_type_id: "pt", name: "Task", is_active: true, is_default: true, workflow_id: null },
        {
          id: "bug",
          project_issue_type_id: "pb",
          name: "Bug",
          is_active: true,
          is_default: false,
          workflow_id: "custom",
        },
        {
          id: "inactive",
          project_issue_type_id: "pi",
          name: "Inactive",
          is_active: false,
          is_default: false,
          workflow_id: null,
        },
      ],
    },
  };
  state.store.service.preview.mockReset().mockResolvedValue({ token: "token" });
});
async function choose(name: string) {
  fireEvent.focus(screen.getByRole("combobox", { name: "web.workflow_ui.issue_types" }));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
}
it("renders an integrated searchable chips field and previews binding a type", async () => {
  render(<WorkflowTypes workflow={workflow} projectId="p" workspaceSlug="w" disabled={false} />);
  const input = screen.getByRole("combobox", { name: "web.workflow_ui.issue_types" });
  expect(screen.getByText("Bug").closest("[data-testid=workflow-types-picker]")?.contains(input)).toBe(true);
  expect(screen.queryByRole("button", { name: "web.workflow_ui.types_settings.add" })).toBeNull();
  await choose("Task");
  await waitFor(() =>
    expect(state.store.service.preview).toHaveBeenCalledWith("w", "p", {
      operation: "bind_type",
      type_id: "task",
      workflow_id: "custom",
    })
  );
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(state.store.service.apply).not.toHaveBeenCalled();
});
it("removes a custom binding from its chip through impact preview", async () => {
  render(<WorkflowTypes workflow={workflow} projectId="p" workspaceSlug="w" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove Bug" }));
  await waitFor(() =>
    expect(state.store.service.preview).toHaveBeenCalledWith("w", "p", {
      operation: "bind_type",
      type_id: "bug",
      workflow_id: undefined,
    })
  );
});
it("shows default workflow types and lets another type return to that workflow", async () => {
  render(
    <WorkflowTypes
      workflow={{ ...workflow, id: "default", workflow_id: "persisted-default", is_default: true }}
      projectId="p"
      workspaceSlug="w"
      disabled={false}
    />
  );
  expect(screen.getByText("Task")).toBeTruthy();
  await choose("Bug");
  await waitFor(() =>
    expect(state.store.service.preview).toHaveBeenCalledWith("w", "p", {
      operation: "bind_type",
      type_id: "bug",
      workflow_id: undefined,
    })
  );
});
it("preserves existing chips after a preview fails", async () => {
  state.store.service.preview.mockRejectedValue({ code: "WORKFLOW_INVALID_TYPE" });
  render(<WorkflowTypes workflow={workflow} projectId="p" workspaceSlug="w" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove Bug" }));
  await waitFor(() => expect(state.toast).toHaveBeenCalled());
  expect(screen.getByTestId("workflow-types-picker").textContent).toContain("Bug");
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("disables the complete selector and chip removal for read-only members", () => {
  render(
    <WorkflowTypes workflow={{ ...workflow, can_manage: false }} projectId="p" workspaceSlug="w" disabled={false} />
  );
  expect(screen.getByText("Bug")).toBeTruthy();
  expect(screen.getByRole<HTMLInputElement>("combobox", { name: "web.workflow_ui.issue_types" }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Remove Bug" }).disabled).toBe(true);
});
