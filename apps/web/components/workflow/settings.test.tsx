import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { StateGroupIcon } from "@plane/blocks/icons";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowSettings } from "./settings";
import type { TProjectWorkflow } from "@plane/types";

const state = vi.hoisted(() => ({
  store: {
    workflows: {} as Record<string, TProjectWorkflow>,
    errors: {},
    lists: {} as Record<
      string,
      { results: TProjectWorkflow[]; count: number; enabled: boolean; policy_version: number; can_manage: boolean }
    >,
    issueTypes: {} as Record<
      string,
      { results: { id: string; name: string; workflow_id: string | null; logo_props?: Record<string, unknown> }[] }
    >,
    historyRevision: {},
    fetch: vi.fn(),
    set: vi.fn(),
    service: {
      update: vi.fn(),
      setCreation: vi.fn(),
      saveTransition: vi.fn(),
      deleteTransition: vi.fn(),
      history: vi.fn(),
      scripts: vi.fn(),
    },
  },
  toast: vi.fn(),
}));
vi.mock("react-router", () => ({
  useParams: () => ({ workspaceSlug: "w", projectId: "p" }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("use-font-face-observer", () => ({ default: () => true }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => state.store }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
    <div>
      {children}
      {aside}
    </div>
  ),
}));
vi.mock("@/components/settings/page-header", () => ({ SettingsPageHeader: () => null }));
vi.mock("@/components/common/breadcrumb-link", () => ({ BreadcrumbLink: () => null }));
vi.mock("@/components/dropdowns/member/avatar", () => ({ ButtonAvatars: () => <span>avatars</span> }));
vi.mock("@/components/dropdowns/state/state-select", () => ({
  StateSelect: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <select aria-label="destination" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">none</option>
      <option value="b">Todo</option>
      <option value="c">Done</option>
    </select>
  ),
}));
vi.mock("@/components/dropdowns/member/member-select", () => ({ MemberSelect: () => <span>member select</span> }));
vi.mock("@makeplane/propel/components/drawer", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
    DrawerPanel: Part,
    DrawerHeader: Part,
    DrawerHeaderContent: Part,
    DrawerHeaderActions: Part,
    DrawerTitle: Part,
    DrawerBody: Part,
    DrawerFooter: Part,
  };
});
Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  state.store.lists = {};
  state.store.issueTypes = {};
  state.store.workflows.p = {
    id: "default",
    enabled: true,
    is_active: true,
    can_manage: true,
    initial_state_id: "a",
    effective_initial_state_id: "a",
    states: [
      { id: "a", name: "Backlog", group: "backlog", color: "#555", allow_creation: true },
      { id: "b", name: "Todo", group: "unstarted", color: "#555", allow_creation: true },
    ],
    transitions: [],
  };
  for (const mock of Object.values(state.store.service)) mock.mockReset().mockResolvedValue(state.store.workflows.p);
  state.store.service.history.mockResolvedValue({ results: [], count: 0, next_offset: null });
  state.store.service.scripts.mockResolvedValue([]);
  state.toast.mockReset();
  state.store.set.mockReset();
});
it("renders project controls and the synthetic default workflow for an empty persisted list", () => {
  state.store.lists.p = { results: [], count: 0, enabled: false, policy_version: 1, can_manage: true };
  render(<WorkflowSettings />);
  expect(screen.getByRole("switch", { name: "web.workflow_ui.enable" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "web.workflow_ui.new_workflow" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "web.workflow_ui.default_name" })).toBeTruthy();
});
it("labels the workflow list and puts the type settings action in an alert", () => {
  render(<WorkflowSettings />);
  expect(screen.getAllByRole("heading", { name: "common.workflows" })).toHaveLength(2);
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("web.workflow_ui.types_workflow_hint");
  const action = screen.getByRole("link", { name: "web.workflow_ui.type_settings" });
  expect(alert.contains(action)).toBe(true);
  expect(action.getAttribute("href")).toBe("/w/settings/projects/p/issue-types/");
});
it("filters through the shared expandable search and restores rows when cleared", () => {
  render(<WorkflowSettings />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.search" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no match" } });
  expect(screen.queryByRole("link", { name: "web.workflow_ui.default_name" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "common.clear" }));
  expect(screen.getByRole("link", { name: "web.workflow_ui.default_name" })).toBeTruthy();
});
it("filters and sorts persisted workflows through the shared selects", async () => {
  const alpha = {
    ...state.store.workflows.p,
    id: "alpha",
    name: "Alpha",
    is_active: false,
    states: [state.store.workflows.p.states[0]],
    issue_type_ids: ["task"],
  };
  const zulu = {
    ...state.store.workflows.p,
    id: "zulu",
    name: "Zulu",
    states: [state.store.workflows.p.states[1]],
    issue_type_ids: ["bug"],
  };
  state.store.lists.p = { results: [zulu, alpha], count: 2, enabled: true, policy_version: 1, can_manage: true };
  state.store.issueTypes.p = {
    results: [
      { id: "task", name: "Task", workflow_id: "alpha" },
      { id: "bug", name: "Bug", workflow_id: "zulu" },
    ],
  };
  render(<WorkflowSettings />);
  const choose = async (label: string, option: string) => {
    fireEvent.click(screen.getByRole("combobox", { name: label }));
    const item = await screen.findByRole("option", { name: option });
    fireEvent.pointerDown(item, { pointerType: "mouse" });
    fireEvent.click(item);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  };
  await choose("web.workflow_ui.filter_state", "Todo");
  expect(screen.queryByRole("link", { name: "Alpha" })).toBeNull();
  expect(screen.getByRole("link", { name: "Zulu" })).toBeTruthy();
  await choose("web.workflow_ui.filter_state", "web.workflow_ui.all_states");
  await choose("web.workflow_ui.filter_type", "Task");
  expect(screen.getByRole("link", { name: "Alpha" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Zulu" })).toBeNull();
  await choose("web.workflow_ui.filter_type", "web.workflow_ui.all_types");
  await choose("common.sort.label", "web.workflow_ui.sort_name_desc");
  expect(
    screen
      .getAllByRole("link")
      .filter((link) => ["Alpha", "Zulu"].includes(link.textContent ?? ""))
      .map((link) => link.textContent)
  ).toEqual(["Zulu", "Alpha"]);
});
it("renders semantic icons for every toolbar option while preserving trigger icons", async () => {
  state.store.workflows.p.states = [
    { id: "a", name: "Backlog", group: "backlog", color: "#123456", allow_creation: true },
    { id: "b", name: "Done", group: "completed", color: "#46a758", allow_creation: true },
  ];
  state.store.issueTypes.p = {
    results: [
      {
        id: "bug",
        name: "Bug",
        workflow_id: null,
        logo_props: { in_use: "icon", icon: { name: "bug_report", color: "#ef4444" } },
      },
      {
        id: "task",
        name: "Task",
        workflow_id: null,
        logo_props: { in_use: "emoji", emoji: { value: "128027" } },
      },
      { id: "legacy", name: "Legacy", workflow_id: null },
    ],
  };
  render(<WorkflowSettings />);
  const close = async () => {
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  };
  const stateTrigger = screen.getByRole("combobox", { name: "web.workflow_ui.filter_state" });
  expect(stateTrigger.querySelector("svg.lucide-circle-dashed")).toBeTruthy();
  fireEvent.click(stateTrigger);
  expect(
    (await screen.findByRole("option", { name: "web.workflow_ui.all_states" })).querySelector(
      "svg.lucide-circle-dashed"
    )
  ).toBeTruthy();
  for (const workflowState of state.store.workflows.p.states) {
    const icon = screen.getByRole("option", { name: workflowState.name }).querySelector("svg");
    expect(icon?.outerHTML).toBe(
      renderToStaticMarkup(
        <StateGroupIcon stateGroup={workflowState.group} color={workflowState.color} className="size-3.5" />
      )
    );
  }
  await close();

  const typeTrigger = screen.getByRole("combobox", { name: "web.workflow_ui.filter_type" });
  expect(typeTrigger.querySelector("svg.lucide-shapes")).toBeTruthy();
  fireEvent.click(typeTrigger);
  expect(
    (await screen.findByRole("option", { name: "web.workflow_ui.all_types" })).querySelector("svg.lucide-shapes")
  ).toBeTruthy();
  const bugIcon = screen.getByRole("option", { name: "Bug" }).querySelector(".material-symbols-rounded");
  expect(bugIcon?.textContent).toBe("bug_report");
  expect((bugIcon as HTMLElement).style.color).toBe("rgb(239, 68, 68)");
  expect(screen.getByRole("option", { name: "Task" }).textContent).toContain(String.fromCodePoint(128027));
  expect(screen.getByRole("option", { name: "Legacy" }).querySelector("svg.lucide-shapes")).toBeTruthy();
  await close();

  const sortTrigger = screen.getByRole("combobox", { name: "common.sort.label" });
  expect(sortTrigger.querySelector("svg.lucide-list-ordered")).toBeTruthy();
  fireEvent.click(sortTrigger);
  expect(
    (await screen.findByRole("option", { name: "web.workflow_ui.sort_name" })).querySelector(
      "svg.lucide-arrow-up-narrow-wide"
    )
  ).toBeTruthy();
  expect(
    screen
      .getByRole("option", { name: "web.workflow_ui.sort_name_desc" })
      .querySelector("svg.lucide-arrow-down-wide-narrow")
  ).toBeTruthy();
  expect(
    screen.getByRole("option", { name: "web.workflow_ui.columns.status" }).querySelector("svg.lucide-circle-dashed")
  ).toBeTruthy();
});
it("groups row actions in a menu and protects the default workflow from deletion", async () => {
  render(<WorkflowSettings />);
  expect(screen.queryByRole("menuitem")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions web.workflow_ui.default_name" }));
  expect(await screen.findByRole("menuitem", { name: "edit" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "web.workflow_ui.disable" })).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "delete" })).toBeNull();
  fireEvent.click(screen.getByRole("menuitem", { name: "workflows.quick_actions.view_change_history" }));
  await waitFor(() => expect(state.store.service.history).toHaveBeenCalled());
  expect(screen.getByText("web.workflow_ui.no_history")).toBeTruthy();
});
it("only exposes history in row actions without management permission", async () => {
  state.store.workflows.p.can_manage = false;
  render(<WorkflowSettings />);
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions web.workflow_ui.default_name" }));
  expect(await screen.findByRole("menuitem", { name: "workflows.quick_actions.view_change_history" })).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "edit" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "web.workflow_ui.disable" })).toBeNull();
});
it("keeps script management out of workflow settings and links persisted workflows to their executions", () => {
  state.store.workflows.p.workflow_id = "workflow-id";
  render(<WorkflowSettings detail />);
  expect(screen.queryByRole("button", { name: "web.workflow_runner.scripts" })).toBeNull();
  expect(screen.getByRole("link", { name: "web.workflow_runner.view_executions" }).getAttribute("href")).toBe(
    "/w/settings/projects/p/runner/?tab=executions&workflow_id=workflow-id"
  );
});
it("does not send a synthetic default workflow to the UUID execution filter", () => {
  render(<WorkflowSettings detail />);
  expect(screen.queryByRole("link", { name: "web.workflow_runner.view_executions" })).toBeNull();
});
it("uses the persisted project toggle instead of a cosmetic switch", async () => {
  render(<WorkflowSettings />);
  fireEvent.click(screen.getByRole("switch", { name: "web.workflow_ui.enable" }));
  await waitFor(() => expect(state.store.service.update).toHaveBeenCalledWith("w", "p", { enabled: false }));
  expect(state.store.set).toHaveBeenCalled();
});
it("keeps the initial state creation switch locked and supports the rule side panel", async () => {
  render(<WorkflowSettings detail />);
  expect(
    screen
      .getByRole("switch", { name: "Backlog workflows.workflow_states.work_item_creation" })
      .getAttribute("aria-disabled")
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Backlog" }));
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.add_flow" }));
  expect(screen.getByRole("button", { name: "save" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("destination"), { target: { value: "b" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(state.store.service.saveTransition).toHaveBeenCalledWith(
      "w",
      "p",
      expect.objectContaining({ source_id: "a", destination_id: "b", member_ids: [] }),
      undefined,
      "default",
      undefined
    )
  );
  await waitFor(() => expect(screen.queryByLabelText("destination")).toBeNull());
});
it("previews unsaved choices in the main area and clears only the next rule on save and continue", async () => {
  render(<WorkflowSettings detail />);
  fireEvent.click(screen.getByRole("button", { name: "Backlog" }));
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.add_flow" }));
  fireEvent.change(screen.getByLabelText("destination"), { target: { value: "b" } });
  expect(screen.getByTestId("workflow-draft-preview").textContent).toContain("Todo");
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.save_continue" }));
  await waitFor(() => expect((screen.getByLabelText("destination") as HTMLSelectElement).value).toBe(""));
  expect(screen.getByTestId("workflow-draft-preview")).toBeTruthy();
  expect(state.store.service.saveTransition).toHaveBeenCalledTimes(1);
});
it("retains the rule draft after save failure and permits retry", async () => {
  state.store.service.saveTransition
    .mockRejectedValueOnce({ response: { data: { destination_id: ["WORKFLOW_DUPLICATE_TRANSITION"] } } })
    .mockResolvedValueOnce(state.store.workflows.p);
  render(<WorkflowSettings detail />);
  fireEvent.click(screen.getByRole("button", { name: "Backlog" }));
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.add_flow" }));
  fireEvent.change(screen.getByLabelText("destination"), { target: { value: "b" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(state.toast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "web.workflow_errors.WORKFLOW_DUPLICATE_TRANSITION" })
    )
  );
  expect((screen.getByLabelText("destination") as HTMLSelectElement).value).toBe("b");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(state.store.service.saveTransition).toHaveBeenCalledTimes(2));
});
it("renders settings read-only for members without management permissions", () => {
  state.store.workflows.p.can_manage = false;
  render(<WorkflowSettings detail />);
  fireEvent.click(screen.getByRole("button", { name: "Backlog" }));
  expect(screen.queryByRole("button", { name: "web.workflow_ui.add_flow" })).toBeNull();
  for (const control of screen.getAllByRole("switch")) expect(control.getAttribute("aria-disabled")).toBe("true");
});
