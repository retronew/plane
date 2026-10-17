import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowExecutions, WorkflowRunner } from "./runner";
const state = vi.hoisted(() => ({
  scripts: [
    {
      id: "script",
      name: "Check",
      description: "",
      versions: [
        {
          id: "v2",
          version: 2,
          source: "return { success: false };",
          capabilities: ["getWorkItem"],
          http_policy: { origins: [], methods: [] },
          created_at: "2026-10-16",
        },
        {
          id: "v1",
          version: 1,
          source: "return { success: true };",
          capabilities: [],
          http_policy: { origins: [], methods: [] },
          created_at: "2026-10-15",
        },
      ],
    },
  ],
  service: {
    testScript: vi.fn(),
    publishVersion: vi.fn(),
    scripts: vi.fn(),
    credentials: vi.fn(),
    executions: vi.fn(),
    createCredential: vi.fn(),
    deleteCredential: vi.fn(),
  },
  executionKey: undefined as unknown,
  executionFetcher: undefined as unknown,
  mutate: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => ({ service: state.service }) }));
vi.mock("swr", () => ({
  default: (key: string[]) => ({ data: key[0] === "workflow-scripts" ? state.scripts : [], mutate: state.mutate }),
}));
vi.mock("swr/infinite", () => ({
  default: (key: unknown, fetcher: unknown) => {
    state.executionKey = key;
    state.executionFetcher = fetcher;
    return { data: [{ results: [], next_offset: null }], mutate: state.mutate };
  },
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
vi.mock("@makeplane/propel/components/input-field", () => ({
  InputField: ({ label, value, onChange }: { label?: string; value?: string; onChange: (event: unknown) => void }) => (
    <label>
      {label}
      <input value={value} onChange={onChange} />
    </label>
  ),
}));
beforeEach(() => {
  state.service.testScript.mockReset().mockResolvedValue({
    id: "run",
    status: "succeeded",
    phase: "pre",
    dry_run: true,
    draft_hash: "hash",
    logs: [],
    actions: [],
    steps: [],
  });
  state.service.publishVersion.mockReset().mockResolvedValue({});
  state.mutate.mockReset().mockResolvedValue({});
  state.toast.mockReset();
});
it("includes the workflow filter in every page key and sends it to the service", async () => {
  render(<WorkflowExecutions workspaceSlug="w" projectId="p" workflowId="flow" />);
  const key = state.executionKey as (index: number, previous: { next_offset: number | null } | null) => unknown;
  const fetcher = state.executionFetcher as (key: unknown) => Promise<unknown>;
  expect(key(0, null)).toEqual(["workflow-executions", "w", "p", 0, "flow"]);
  const next = key(1, { next_offset: 25 });
  expect(next).toEqual(["workflow-executions", "w", "p", 25, "flow"]);
  await fetcher(next);
  expect(state.service.executions).toHaveBeenCalledWith("w", "p", 25, "flow");
  expect(key(2, { next_offset: null })).toBeNull();
});
it("loads the newest immutable version even when the API returns newest first", () => {
  render(<WorkflowRunner workspaceSlug="w" projectId="p" />);
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect((screen.getByLabelText("web.workflow_runner.source") as HTMLTextAreaElement).value).toContain("false");
});
it("runs the draft with selected capabilities and flags results after the source changes", async () => {
  render(<WorkflowRunner workspaceSlug="w" projectId="p" />);
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_runner.run_test" }));
  await waitFor(() =>
    expect(state.service.testScript).toHaveBeenCalledWith(
      "w",
      "p",
      expect.objectContaining({
        source: "return { success: false };",
        phase: "pre",
        capabilities: ["getWorkItem"],
        context: {},
      })
    )
  );
  await waitFor(() => expect(screen.getByText("web.workflow_runner.status.succeeded")).toBeTruthy());
  fireEvent.change(screen.getByLabelText("web.workflow_runner.source"), {
    target: { value: "return { success: true };" },
  });
  expect(screen.getByText("web.workflow_runner.test_stale")).toBeTruthy();
});
it("publishes a new version without changing existing bindings", async () => {
  render(<WorkflowRunner workspaceSlug="w" projectId="p" />);
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.change(screen.getByLabelText("web.workflow_runner.source"), {
    target: { value: "return { success: true };" },
  });
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_runner.publish" }));
  await waitFor(() =>
    expect(state.service.publishVersion).toHaveBeenCalledWith(
      "w",
      "p",
      "script",
      expect.objectContaining({ source: "return { success: true };" })
    )
  );
});
