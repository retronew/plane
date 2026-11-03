import { act, cleanup, render, waitFor } from "@testing-library/react";
import { makeAutoObservable } from "mobx";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TPeekIssue } from "@/store/issue/issue-details/root.store";
import { useIssuePeekUrl } from "./use-issue-peek-url";

const projectId = "900a56f7-6a64-498f-8d64-4c5c349e5625";
const first: TPeekIssue = { workspaceSlug: "wuzuo", projectId, issueId: "b43e5331-5157-43a2-94c0-267f17618dd6" };
const second: TPeekIssue = {
  ...first,
  issueId: "a43e5331-5157-43a2-94c0-267f17618dd6",
  isArchived: true,
  nestingLevel: 2,
};
const basePath = `/wuzuo/projects/${projectId}/issues/`;
const store = makeAutoObservable({
  peekIssue: undefined as TPeekIssue | undefined,
  setPeekIssue(value: TPeekIssue | undefined) {
    this.peekIssue = value;
  },
});
vi.mock("./store/use-issue-detail", () => ({ useIssueDetail: () => store }));

function Sync() {
  useIssuePeekUrl();
  return null;
}
function setup(url = basePath) {
  const router = createMemoryRouter(
    [
      { path: "/:workspaceSlug/projects/:projectId/issues/", element: <Sync /> },
      { path: "/:workspaceSlug/workspace-views/all-issues/", element: <Sync /> },
      { path: "/:workspaceSlug/notifications/", element: <Sync /> },
    ],
    { initialEntries: [url] }
  );
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => store.setPeekIssue(undefined));
afterEach(cleanup);

describe("issue detail URL synchronization", () => {
  it("records card opens, restores back/forward, and clears only peek parameters on close", async () => {
    const router = setup(`${basePath}?filter=a%26b#description`);
    act(() => store.setPeekIssue(first));
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("peekId")).toBe(first.issueId));
    expect(router.state.location.hash).toBe("#description");
    act(() => store.setPeekIssue(second));
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("peekId")).toBe(second.issueId));
    await act(() => router.navigate(-1));
    expect(store.peekIssue?.issueId).toBe(first.issueId);
    await act(() => router.navigate(1));
    expect(store.peekIssue).toEqual(second);
    act(() => store.setPeekIssue(undefined));
    await waitFor(() => expect(router.state.location.search).toBe("?filter=a%26b"));
    expect(router.state.location.hash).toBe("#description");
  });

  it("restores a copied global-view URL without a project route parameter", async () => {
    setup(
      `/wuzuo/workspace-views/all-issues/?peekId=${second.issueId}&peekProjectId=${projectId}&peekArchived=1&peekNestingLevel=2`
    );
    await waitFor(() => expect(store.peekIssue).toEqual(second));
  });

  it("accepts a project-scoped URL with just peekId", async () => {
    setup(`${basePath}?peekId=${first.issueId}`);
    await waitFor(() => expect(store.peekIssue).toEqual({ ...first, isArchived: false }));
  });

  it("closes stale details when navigating to another page", async () => {
    const router = setup(`${basePath}?peekId=${first.issueId}`);
    await waitFor(() => expect(store.peekIssue?.issueId).toBe(first.issueId));
    await act(() => router.navigate("/wuzuo/workspace-views/all-issues/"));
    expect(store.peekIssue).toBeUndefined();
  });

  it("ignores malformed identifiers instead of fetching an invalid detail", () => {
    setup(`${basePath}?peekId=invalid`);
    expect(store.peekIssue).toBeUndefined();
  });

  it("keeps embedded notification previews outside card URL synchronization", async () => {
    const router = setup("/wuzuo/notifications/?notification=one");
    act(() => store.setPeekIssue(first));
    expect(router.state.location.search).toBe("?notification=one");
    expect(store.peekIssue).toEqual(first);
  });
});
