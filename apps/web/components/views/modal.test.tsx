import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { IProjectView } from "@plane/types";
import { CreateUpdateProjectViewModal } from "./modal";

const mocks = vi.hoisted(() => ({
  project: { issue_views_view: true } as { issue_views_view?: boolean } | undefined,
  createView: vi.fn(),
  updateView: vi.fn(),
  onClose: vi.fn(),
  push: vi.fn(),
  mutateFilters: vi.fn(),
  resetExpression: vi.fn(),
  submit: undefined as ((payload: IProjectView) => Promise<void>) | undefined,
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getPartialProjectById: () => mocks.project }),
}));
vi.mock("@/hooks/store/use-project-view", () => ({ useProjectView: () => mocks }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issuesFilter: mocks }) }));
vi.mock("@/hooks/store/work-item-filters/use-work-item-filters", () => ({ useWorkItemFilters: () => mocks }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? children : null),
  DialogContent: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./form", () => ({
  ProjectViewForm: ({ handleFormSubmit }: { handleFormSubmit: (payload: IProjectView) => Promise<void> }) => {
    mocks.submit = handleFormSubmit;
    return <button onClick={() => void handleFormSubmit({ name: "My view" } as IProjectView)}>Submit view</button>;
  },
}));
const props = {
  workspaceSlug: "workspace",
  projectId: "project",
  isOpen: true,
  onClose: mocks.onClose,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.project = { issue_views_view: true };
  mocks.submit = undefined;
  mocks.createView.mockResolvedValue({ id: "new-view" });
  mocks.updateView.mockResolvedValue({ id: "existing-view", rich_filters: null });
});

it.each([undefined, {}, { issue_views_view: false }])(
  "hides and closes creation when views are unavailable: %j",
  (project) => {
    mocks.project = project;
    render(<CreateUpdateProjectViewModal {...props} />);
    expect(screen.queryByRole("button", { name: "Submit view" })).toBeNull();
    expect(mocks.onClose).toHaveBeenCalledOnce();
    expect(mocks.createView).not.toHaveBeenCalled();
  }
);

it("creates enabled project views and navigates to the result", async () => {
  render(<CreateUpdateProjectViewModal {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Submit view" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workspace/projects/project/views/new-view"));
  expect(mocks.createView).toHaveBeenCalledWith("workspace", "project", { name: "My view" });
  expect(mocks.onClose).toHaveBeenCalledOnce();
});

it("removes an already open form when views are disabled", () => {
  const project = observable({ issue_views_view: true });
  mocks.project = project;
  render(<CreateUpdateProjectViewModal {...props} />);
  expect(screen.getByRole("button", { name: "Submit view" })).toBeTruthy();
  act(() =>
    runInAction(() => {
      project.issue_views_view = false;
    })
  );
  expect(screen.queryByRole("button", { name: "Submit view" })).toBeNull();
  expect(mocks.onClose).toHaveBeenCalledOnce();
});

it.each([undefined, {}, { issue_views_view: false }])(
  "blocks a previously captured submit callback after project state changes: %j",
  async (project) => {
    render(<CreateUpdateProjectViewModal {...props} />);
    const submit = mocks.submit!;
    mocks.project = project;
    await submit({ name: "Stale form" } as IProjectView);
    expect(mocks.createView).not.toHaveBeenCalled();
    expect(mocks.updateView).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.onClose).toHaveBeenCalledOnce();
  }
);

it("preserves updates while views are enabled", async () => {
  render(<CreateUpdateProjectViewModal {...props} data={{ id: "existing-view" } as IProjectView} />);
  fireEvent.click(screen.getByRole("button", { name: "Submit view" }));
  await waitFor(() => expect(mocks.onClose).toHaveBeenCalledOnce());
  expect(mocks.updateView).toHaveBeenCalledWith("workspace", "project", "existing-view", { name: "My view" });
  expect(mocks.mutateFilters).toHaveBeenCalled();
  expect(mocks.createView).not.toHaveBeenCalled();
});
