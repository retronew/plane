import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TProjectWorkflow } from "@plane/types";
import { StateSelect } from "./state-select";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  toast: vi.fn(),
  states: [
    { id: "a", name: "Backlog", project_id: "p", group: "backlog", color: "#555" },
    { id: "b", name: "Todo", project_id: "p", group: "unstarted", color: "#555" },
    { id: "c", name: "Done", project_id: "p", group: "completed", color: "#555" },
  ],
  workflow: {} as TProjectWorkflow,
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "w" }) }));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    getProjectStateIds: () => state.states.map((s) => s.id),
    getStateById: (id: string) => state.states.find((s) => s.id === id),
    fetchProjectStates: vi.fn(),
  }),
}));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({
    workflows: { p: state.workflow },
    fetch: state.fetch,
    fetchList: state.fetch,
    fetchTypes: state.fetch,
    resolve: (_projectId: string, typeId?: string) =>
      typeId === "custom"
        ? { ...state.workflow, states: state.workflow.states.filter((item) => item.id !== "b"), transitions: [] }
        : state.workflow,
  }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "viewer" } }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@plane/blocks/property-select", () => ({
  StateSelect: (props: {
    getValues: (args: object) => Promise<{ results: { id: string; name: string }[] }>;
    onChange: (id: string) => void;
    allowedStateIds?: Set<string> | null;
  }) => (
    <button
      onClick={async () => {
        const data = await props.getValues({ search: "" });
        state.toast(
          data.results.filter((item) => !props.allowedStateIds || props.allowedStateIds.has(item.id)).map((s) => s.id)
        );
      }}
    >
      open
    </button>
  ),
}));

beforeEach(() => {
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
  state.fetch.mockReset().mockImplementation(async () => state.workflow);
  state.toast.mockReset();
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
