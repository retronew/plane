import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { expect, it, vi } from "vitest";
import { IssuePeekOverview } from "./root";

const detail = vi.hoisted(() => ({
  peekIssue: { workspaceSlug: "workspace", projectId: "project", issueId: "first" },
  issue: { fetchIssue: vi.fn() },
  setPeekIssue: vi.fn(),
  fetchActivities: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-issue-detail", () => ({ useIssueDetail: () => detail }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issues: {} }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("@/hooks/use-issue-detail-sync", () => ({ useIssueDetailSync: () => {} }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: () => "PROFILE" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/workspace/profile/me/assigned/" }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./view", () => ({
  IssueView: ({ issueId, isError, isLoading }: { issueId: string; isError: boolean; isLoading: boolean }) => (
    <div>
      {issueId} {isError ? "error" : isLoading ? "loading" : "ready"}
    </div>
  ),
}));

it("keeps the newly selected work item visible if the previous request fails later", async () => {
  let rejectFirst!: (error: Error) => void;
  detail.issue.fetchIssue.mockImplementation((_workspace, _project, id) =>
    id === "first"
      ? new Promise((_resolve, reject) => {
          rejectFirst = reject;
        })
      : Promise.resolve()
  );
  const cache = { provider: () => new Map() };
  const view = () => (
    <SWRConfig value={cache}>
      <IssuePeekOverview />
    </SWRConfig>
  );
  const { rerender } = render(view());
  await waitFor(() => expect(detail.issue.fetchIssue).toHaveBeenCalledWith("workspace", "project", "first"));
  detail.peekIssue = { ...detail.peekIssue, issueId: "second" };
  rerender(view());
  await screen.findByText("second ready");
  await act(async () => rejectFirst(new Error("first unavailable")));
  expect(screen.getByText("second ready")).toBeTruthy();
});
