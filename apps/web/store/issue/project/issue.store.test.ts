import { expect, it, vi } from "vitest";
import type { IIssueRootStore } from "../root.store";
import type { IProjectIssuesFilter } from "./filter.store";
import { ProjectIssues } from "./issue.store";

vi.mock("@/lib/store-context", () => ({ store: {} }));

it.each(["resolve", "reject"] as const)(
  "keeps loaded issues visible during a mutation refresh that will %s",
  async (result) => {
    const applyResponse = vi.spyOn(ProjectIssues.prototype, "onfetchIssues").mockImplementation(() => {});
    const store = new ProjectIssues(
      { rootStore: { router: {} } } as unknown as IIssueRootStore,
      { getFilterParams: () => ({ sub_issue: false }) } as unknown as IProjectIssuesFilter
    );
    store.beginIssueRequest(JSON.stringify(["workspace", "project"]), "init-loader", false);
    store.groupedIssueIds = { allIssues: ["existing"] };
    store.groupedIssueCount = { allIssues: 1 };
    const previousIds = store.groupedIssueIds;
    const previousCounts = store.groupedIssueCount;
    const previousController = store.controller;
    let resolve!: (value: never) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<never>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const request = { promise, resolve, reject };
    vi.spyOn(store.issueService, "getIssues").mockReturnValue(request.promise);
    const refresh = store.fetchIssues("workspace", "project", "mutation", { canGroup: true, perPageCount: 30 }, true);
    expect(store.groupedIssueIds).toBe(previousIds);
    expect(store.groupedIssueCount).toBe(previousCounts);
    expect(previousController.signal.aborted).toBe(true);
    expect(store.controller.signal.aborted).toBe(false);
    if (result === "reject") {
      const error = new Error("network failure");
      request.reject(error);
      await expect(refresh).rejects.toBe(error);
      expect(store.groupedIssueIds).toBe(previousIds);
    } else {
      request.resolve({} as never);
      await refresh;
      expect(applyResponse).toHaveBeenCalledOnce();
    }
  }
);
