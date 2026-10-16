import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowSettings } from "./settings";
import type { TProjectWorkflow } from "@plane/types";

const state = vi.hoisted(() => ({
  store: {
    workflows: {} as Record<string, TProjectWorkflow>,
    errors: {},
    fetch: vi.fn(),
    set: vi.fn(),
    service: {
      update: vi.fn(),
      setCreation: vi.fn(),
      saveTransition: vi.fn(),
      deleteTransition: vi.fn(),
      history: vi.fn(),
    },
  },
  toast: vi.fn(),
}));
vi.mock("react-router", () => ({
  useParams: () => ({ workspaceSlug: "w", projectId: "p" }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => state.store }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  state.toast.mockReset();
  state.store.set.mockReset();
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
      { source_id: "a", destination_id: "b", member_ids: [] },
      undefined
    )
  );
  await waitFor(() => expect(screen.queryByLabelText("destination")).toBeNull());
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
