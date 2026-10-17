import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowRunnerSettings } from "./runner-settings";

const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  setParams: vi.fn(),
  store: {
    lists: {} as Record<string, { can_manage: boolean; results: { workflow_id: string; name: string }[] }>,
    workflows: {} as Record<string, { can_manage: boolean }>,
    errors: {} as Record<string, unknown>,
    fetch: vi.fn().mockResolvedValue(undefined),
    fetchList: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("react-router", () => ({
  useParams: () => ({ workspaceSlug: "w", projectId: "p" }),
  useSearchParams: () => [state.params, state.setParams],
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => state.store }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/settings/page-header", () => ({ SettingsPageHeader: () => null }));
vi.mock("@/components/common/breadcrumb-link", () => ({ BreadcrumbLink: () => null }));
vi.mock("./runner", () => ({
  WorkflowRunner: () => <div data-testid="scripts" />,
  WorkflowExecutions: ({ workflowId }: { workflowId?: string }) => (
    <div data-testid="executions" data-workflow={workflowId} />
  ),
}));
beforeEach(() => {
  state.params = new URLSearchParams();
  state.setParams.mockReset();
  state.store.lists = { p: { can_manage: true, results: [{ workflow_id: "flow", name: "Development" }] } };
  state.store.workflows = {};
  state.store.errors = {};
  state.store.fetch.mockClear();
  state.store.fetchList.mockClear();
});
it("opens script management by default and makes execution history directly addressable", () => {
  render(<WorkflowRunnerSettings />);
  expect(screen.getByTestId("scripts")).toBeTruthy();
  expect(screen.queryByTestId("executions")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "web.workflow_runner.executions" }));
  expect(state.setParams.mock.calls[0][0].get("tab")).toBe("executions");
});
it("opens workflow execution links with their filter and lets the user clear it", () => {
  state.params = new URLSearchParams("tab=executions&workflow_id=flow");
  render(<WorkflowRunnerSettings />);
  expect(screen.getByTestId("executions").getAttribute("data-workflow")).toBe("flow");
  expect(screen.queryByTestId("scripts")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_runner.show_all_executions" }));
  const params = state.setParams.mock.calls[0][0] as URLSearchParams;
  expect(params.has("workflow_id")).toBe(false);
  expect(params.get("tab")).toBe("executions");
});
it("does not mount management components for members opening the route directly", () => {
  state.store.lists.p.can_manage = false;
  render(<WorkflowRunnerSettings />);
  expect(screen.queryByTestId("scripts")).toBeNull();
  expect(screen.queryByTestId("executions")).toBeNull();
  expect(screen.getByText("you_do_not_have_the_permission_to_access_this_page")).toBeTruthy();
});
it("waits for project permissions and offers a retry after a failed load", () => {
  state.store.lists = {};
  state.store.errors.p = "failed";
  render(<WorkflowRunnerSettings />);
  expect(screen.queryByTestId("scripts")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
  expect(state.store.fetch).toHaveBeenCalledWith("w", "p", true);
  expect(state.store.fetchList).toHaveBeenCalledWith("w", "p", true);
});
