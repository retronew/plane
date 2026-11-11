import React from "react";
import { observable, runInAction } from "mobx";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CreateUpdateIssueModalBase } from "./base";

const mocks = vi.hoisted(() => ({
  fetchIssue: vi.fn(),
  issue: { getIssueById: vi.fn() },
  sync: vi.fn(),
  updateIssue: vi.fn(),
  toast: vi.fn(),
  allowedProjectIds: ["project", "other"],
  params: { workspaceSlug: "workspace", projectId: undefined as string | undefined },
  draft: undefined as { values: Record<string, unknown>; assetIds: string[] } | undefined,
}));
vi.mock("./composer-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./composer-cache")>()),
  readComposerDraft: () => mocks.draft,
}));
vi.mock("@/hooks/use-issue-detail-sync", () => ({ useIssueDetailSync: mocks.sync }));
vi.mock("next/navigation", () => ({ useParams: () => mocks.params }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@makeplane/propel/components/dialog", async () => {
  const { createPortal } = await import("react-dom");
  return {
    Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DialogContent: ({ children, onClick }: React.ComponentProps<"div">) =>
      createPortal(
        // oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions -- Mirror DialogContent's portal event boundary.
        <div onClick={onClick}>{children}</div>,
        document.body
      ),
  };
});
vi.mock("@/hooks/context/use-issue-modal", () => ({ useIssueModal: () => mocks }));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => ({}) }));
vi.mock("@/hooks/store/use-module", () => ({ useModule: () => ({}) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({ useIssueDetail: () => mocks }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issues: {} }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectByIdentifier: () => undefined }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "user" } }) }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: () => "PROJECT" }));
vi.mock("@/hooks/use-issues-actions", () => ({ useIssuesActions: () => ({ updateIssue: mocks.updateIssue }) }));
vi.mock("../create-issue-toast-action-items", () => ({ useCreateIssueToastActions: () => vi.fn() }));
vi.mock("./draft-issue-layout", () => ({ DraftIssueLayout: () => null }));
vi.mock("./form", () => ({
  IssueFormRoot: ({
    data,
    projectId,
    onSubmit,
  }: {
    data: { name?: string; state_id?: string; assignee_ids?: string[]; description_html?: string; project_id?: string };
    projectId: string;
    onSubmit: (values: { project_id: string; name: string }) => Promise<void>;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ project_id: projectId, name: "Updated title" });
      }}
    >
      <div data-testid="entity">{JSON.stringify([data.name, data.state_id, data.assignee_ids])}</div>
      <div data-testid="description">{data.description_html}</div>
      <div data-testid="project">{data.project_id ?? projectId}</div>
      <button type="submit">Update</button>
    </form>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.params.projectId = undefined;
  mocks.draft = undefined;
});

it("defaults to the current project instead of another project's cached composer", () => {
  mocks.params.projectId = "project";
  mocks.draft = { values: { project_id: "other", description_html: "Other draft" }, assetIds: [] };
  render(<CreateUpdateIssueModalBase isOpen onClose={vi.fn()} withDraftIssueWrapper={false} />);
  expect(screen.getByTestId("project").textContent).toBe("project");
  expect(screen.getByTestId("description").textContent).not.toBe("Other draft");
});
it("requires project selection outside a project even with cached project data", () => {
  mocks.draft = { values: { project_id: "other" }, assetIds: [] };
  render(<CreateUpdateIssueModalBase isOpen onClose={vi.fn()} withDraftIssueWrapper={false} />);
  expect(screen.getByTestId("project").textContent).toBe("");
});
it.each(["", undefined])("restores a draft without a selected project (%s)", (projectId) => {
  mocks.draft = { values: { project_id: projectId, name: "Unselected project draft" }, assetIds: [] };
  render(<CreateUpdateIssueModalBase isOpen onClose={vi.fn()} withDraftIssueWrapper={false} />);
  expect(screen.getByTestId("project").textContent).toBe("");
  expect(screen.getByTestId("entity").textContent).toContain("Unselected project draft");
});
it("preserves explicit projects and drafts from the same project", () => {
  mocks.params.projectId = "other";
  mocks.draft = { values: { project_id: "project", description_html: "Same project draft" }, assetIds: [] };
  render(
    <CreateUpdateIssueModalBase
      isOpen
      data={{ project_id: "project" }}
      onClose={vi.fn()}
      withDraftIssueWrapper={false}
    />
  );
  expect(screen.getByTestId("project").textContent).toBe("project");
  expect(screen.getByTestId("description").textContent).toBe("Same project draft");
});

it("ignores an older issue response and preserves the committed description after closing", async () => {
  let resolveFirst!: (value: { description_html: string }) => void;
  let resolveSecond!: (value: { description_html: string }) => void;
  mocks.fetchIssue
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        })
    );
  const view = (id: string, isOpen = true) => (
    <CreateUpdateIssueModalBase
      isOpen={isOpen}
      onClose={vi.fn()}
      data={{ id, project_id: "project" }}
      withDraftIssueWrapper={false}
    />
  );
  const { rerender } = render(view("first"));
  expect(mocks.fetchIssue).toHaveBeenCalledTimes(1);
  rerender(view("second"));
  await act(async () => {
    resolveSecond({ description_html: "second description" });
  });
  expect(screen.getByTestId("description").textContent).toBe("second description");
  await act(async () => {
    resolveFirst({ description_html: "stale first" });
  });
  expect(screen.getByTestId("description").textContent).toBe("second description");
  rerender(view("second", false));
  expect(screen.getByTestId("description").textContent).toBe("second description");
  expect(mocks.fetchIssue).toHaveBeenCalledTimes(2);
});

it("submits updates from a portalled dialog inside a card that cancels clicks", async () => {
  const onClose = vi.fn();
  const onCardClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
  render(
    <button type="button" onClick={onCardClick}>
      <CreateUpdateIssueModalBase
        isOpen
        onClose={onClose}
        data={{ id: "issue", project_id: "project" }}
        fetchIssueDetails={false}
        withDraftIssueWrapper={false}
      />
    </button>
  );

  fireEvent.click(screen.getByRole("button", { name: "Update" }));

  await waitFor(() =>
    expect(mocks.updateIssue).toHaveBeenCalledWith("project", "issue", {
      project_id: "project",
      name: "Updated title",
    })
  );
  expect(onCardClick).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

it("ignores responses that arrive during the closing transition", async () => {
  let resolve!: (value: { description_html: string }) => void;
  mocks.fetchIssue.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const props = { onClose: vi.fn(), data: { id: "first", project_id: "project" }, withDraftIssueWrapper: false };
  const { rerender } = render(<CreateUpdateIssueModalBase {...props} isOpen />);
  rerender(<CreateUpdateIssueModalBase {...props} isOpen={false} />);
  await act(async () => {
    resolve({ description_html: "late description" });
  });
  expect(screen.getByTestId("description").textContent).toBe("");
});

it("observes shared entity properties and keeps the closing transition stable", () => {
  const entity = observable({ id: "issue", name: "Current", state_id: "s1", assignee_ids: ["u1"] });
  mocks.issue.getIssueById.mockImplementation((id: string) => (id === "issue" ? entity : undefined));
  const onClose = vi.fn();
  const props = {
    data: { id: "issue", project_id: "project", name: "Snapshot" },
    onClose,
    fetchIssueDetails: false,
    withDraftIssueWrapper: false,
  };
  const { rerender } = render(<CreateUpdateIssueModalBase {...props} isOpen />);
  expect(screen.getByTestId("entity").textContent).toContain("Current");
  act(() =>
    runInAction(() => {
      entity.name = "Remote";
      entity.state_id = "s2";
      entity.assignee_ids = ["u2"];
    })
  );
  expect(screen.getByTestId("entity").textContent).toBe(JSON.stringify(["Remote", "s2", ["u2"]]));
  const syncArgs = mocks.sync.mock.calls.at(-1)!;
  expect(syncArgs[2]).toBe("issue");
  act(() => syncArgs[3]());
  expect(onClose).toHaveBeenCalledOnce();
  rerender(<CreateUpdateIssueModalBase {...props} isOpen={false} />);
  act(() =>
    runInAction(() => {
      entity.name = "During exit";
    })
  );
  expect(screen.getByTestId("entity").textContent).toContain("Remote");
  mocks.issue.getIssueById.mockReset();
});
