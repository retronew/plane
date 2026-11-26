import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TProjectWorkflow } from "@plane/types";
import { StateSelect } from "./state-select";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  resolve: vi.fn(),
  listStates: vi.fn(),
  options: vi.fn(),
  toast: vi.fn(),
  select: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(),
  states: [
    { id: "a", name: "Backlog", project_id: "p", allow_new_work_items: true, group: "backlog", color: "#555" },
    {
      id: "b",
      name: "Todo",
      project_id: "p",
      allow_new_work_items: true,
      group: "unstarted",
      color: "#555",
      order: 20000,
    },
    { id: "c", name: "Done", project_id: "p", allow_new_work_items: true, group: "completed", color: "#555" },
  ],
  workflow: {} as TProjectWorkflow,
}));
vi.mock("@/components/workflow/use-approval-transition-confirmation", () => ({
  useApprovalTransitionConfirmation: () => ({ requestConfirmation: state.confirm, confirmationDialog: null }),
}));
vi.mock("swr", () => ({ useSWRConfig: () => ({ mutate: state.refresh }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "w" }) }));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    getProjectStateIds: state.listStates,
    getStateById: (id: string) => state.states.find((s) => s.id === id),
    fetchProjectStates: vi.fn(),
    getStatePercentageInGroup: (id: string) => (id === "b" ? 50 : 100),
  }),
}));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflowStore: () => ({ loadPolicy: state.fetch, resolve: state.resolve }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => undefined }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "viewer" } }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@plane/blocks/property-select", () => ({
  StateSelect: (props: {
    getValues: (args: object) => Promise<{ results: { id: string; name: string }[] }>;
    onChange: (id: string) => void;
    onOpenChange: (open: boolean) => void;
    allowedStateIds?: Set<string> | null;
  }) => {
    state.select = props.onChange as typeof state.select;
    return (
      <button
        onClick={async () => {
          props.onOpenChange(true);
          const data = await props.getValues({ search: "" }).catch((error) => {
            state.toast(error);
            return undefined;
          });
          if (!data) return;
          state.options(data.results);
          state.toast(
            data.results.filter((item) => !props.allowedStateIds || props.allowedStateIds.has(item.id)).map((s) => s.id)
          );
        }}
      >
        open
      </button>
    );
  },
}));

beforeEach(() => {
  state.states.forEach((item) => {
    item.allow_new_work_items = true;
  });
  state.workflow = {
    id: "default",
    enabled: true,
    is_active: true,
    can_manage: true,
    initial_state_id: "a",
    effective_initial_state_id: "a",
    states: state.states.map((s) => ({ ...s, group: s.group as "backlog", allow_creation: s.id !== "c" })),
    transitions: [{ id: "rule", source_id: "a", destination_id: "b", member_ids: [] }],
  };
  state.listStates.mockReset().mockImplementation(() => state.states.map((s) => s.id));
  state.resolve
    .mockReset()
    .mockImplementation((_project: string, type?: string) =>
      type === "custom"
        ? { ...state.workflow, states: state.workflow.states.filter((item) => item.id !== "b"), transitions: [] }
        : state.workflow
    );
  state.fetch.mockReset().mockImplementation(async (_slug, project, type) => state.resolve(project, type));
  state.toast.mockReset();
  state.confirm.mockReset().mockResolvedValue(true);
  state.refresh.mockReset().mockResolvedValue(undefined);
  state.options.mockReset();
});
it("waits for approval entry confirmation before changing state", async () => {
  state.workflow.transitions.push({
    id: "approval",
    source_id: "b",
    destination_id: "c",
    member_ids: [],
    kind: "approval",
  });
  const onChange = vi.fn();
  state.confirm.mockResolvedValue(false);
  render(<StateSelect projectId="p" value="a" onChange={onChange} variant="pill-md" />);
  state.select("b");
  await waitFor(() => expect(state.confirm).toHaveBeenCalledWith("Todo"));
  expect(onChange).not.toHaveBeenCalled();
});
it("reports approval entry only after the confirmed save succeeds", async () => {
  state.workflow.transitions.push({
    id: "approval",
    source_id: "b",
    destination_id: "c",
    member_ids: [],
    kind: "approval",
  });
  const onChange = vi.fn().mockResolvedValue(undefined);
  render(<StateSelect projectId="p" value="a" onChange={onChange} variant="pill-md" />);
  state.select("b");
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("b"));
  expect(state.refresh).toHaveBeenCalledWith(expect.any(Function));
  expect(state.refresh.mock.calls[0][0](["workflow-approvals", "w", "p", "issue"])).toBe(true);
  expect(state.refresh.mock.calls[0][0](["workflow-approvals", "w", "other", "issue"])).toBe(false);
  expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(state.refresh.mock.invocationCallOrder[0]);
  expect(state.toast).toHaveBeenCalledWith(
    expect.objectContaining({ type: "success", title: "web.workflow_ui.entered_approval" })
  );
});

it("passes the group percentage rather than the sort order to state icons", async () => {
  render(<StateSelect projectId="p" value="b" onChange={() => undefined} variant="pill-md" bypassWorkflow />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() =>
    expect(state.options).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "b", color: "#555", percentage: 50 })])
    )
  );
  expect(state.options.mock.calls[0][0].find((option: { id: string }) => option.id === "b")).not.toHaveProperty(
    "order"
  );
});

it("filters disabled creation states while the workflow is off", async () => {
  state.workflow.enabled = false;
  state.states[1].allow_new_work_items = false;
  render(<StateSelect projectId="p" value="a" onChange={() => undefined} variant="pill-md" isForWorkItemCreation />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a", "c"]));
});
it("keeps disabled creation states available for existing work item transitions", async () => {
  state.workflow.enabled = false;
  state.states[1].allow_new_work_items = false;
  render(<StateSelect projectId="p" value="a" onChange={() => undefined} variant="pill-md" />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a", "b", "c"]));
});
it("filters creation states using the same project policy", async () => {
  render(<StateSelect projectId="p" value="a" onChange={() => undefined} variant="pill-md" isForWorkItemCreation />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a", "b"]));
});
it("filters transitions and preserves the selected state", async () => {
  render(<StateSelect projectId="p" value="a" onChange={() => undefined} variant="pill-md" />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a", "b"]));
});
it("hides paths restricted to another member", async () => {
  state.workflow.transitions[0].member_ids = ["other"];
  render(<StateSelect projectId="p" value="a" onChange={() => undefined} variant="pill-md" />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a"]));
});
it("resolves the work item type before filtering workflow states", async () => {
  render(<StateSelect projectId="p" issueTypeId="custom" value="a" onChange={() => undefined} variant="pill-md" />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a", "c"]));
});
it.each(["enabled", "is_active"] as const)("offers states outside a custom set when %s is false", async (flag) => {
  state.workflow[flag] = false;
  render(<StateSelect projectId="p" issueTypeId="custom" value="a" onChange={() => undefined} variant="pill-md" />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a", "b", "c"]));
});
it("prevents ordinary state selection from leaving an approval source", async () => {
  state.workflow.transitions[0].kind = "approval";
  render(<StateSelect projectId="p" value="a" onChange={() => undefined} variant="pill-md" />);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a"]));
});
it("lets the configuration picker use all states except its source without applying workflow gates", async () => {
  render(
    <StateSelect
      projectId="p"
      value=""
      onChange={() => undefined}
      variant="pill-md"
      bypassWorkflow
      excludeStateIds={["a"]}
    />
  );
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["b", "c"]));
  expect(state.fetch).not.toHaveBeenCalled();
});

it("renders the selected state without loading projects or enumerating candidates", () => {
  render(
    <>
      {Array.from({ length: 18 }, (_, index) => (
        <StateSelect key={index} projectId={`p${index}`} value="a" onChange={vi.fn()} variant="icon-sm" />
      ))}
    </>
  );
  expect(state.fetch).not.toHaveBeenCalled();
  expect(state.resolve).not.toHaveBeenCalled();
  expect(state.listStates).not.toHaveBeenCalled();
});

it("propagates a failed load to the picker and rejects unavailable or forbidden transitions", async () => {
  const offline = new Error("offline");
  const onChange = vi.fn();
  render(<StateSelect projectId="p" value="a" onChange={onChange} variant="icon-sm" />);
  state.fetch.mockRejectedValueOnce(offline).mockRejectedValueOnce(offline);
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(offline));
  expect(state.options).not.toHaveBeenCalled();
  state.select("b");
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  state.select("c");
  await waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(3));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("open"));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(["a", "b"]));
});
