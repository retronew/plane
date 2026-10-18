import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CreateUpdateIssueModalBase } from "./base";

const mocks = vi.hoisted(() => ({ fetchIssue: vi.fn(), allowedProjectIds: ["project"] }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/context/use-issue-modal", () => ({ useIssueModal: () => mocks }));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => ({}) }));
vi.mock("@/hooks/store/use-module", () => ({ useModule: () => ({}) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({ useIssueDetail: () => mocks }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issues: {} }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectByIdentifier: () => undefined }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({}) }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: () => "PROJECT" }));
vi.mock("@/hooks/use-issues-actions", () => ({ useIssuesActions: () => ({}) }));
vi.mock("../create-issue-toast-action-items", () => ({ useCreateIssueToastActions: () => vi.fn() }));
vi.mock("./draft-issue-layout", () => ({ DraftIssueLayout: () => null }));
vi.mock("./form", () => ({
  IssueFormRoot: ({ data }: { data: { description_html?: string } }) => (
    <div data-testid="description">{data.description_html}</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
