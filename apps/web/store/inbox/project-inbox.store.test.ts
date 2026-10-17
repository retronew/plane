import { expect, it, vi } from "vitest";
import { ProjectInboxStore } from "./project-inbox.store";
import { EInboxIssueCurrentTab, EInboxIssueStatus } from "@plane/types";
import type { CoreRootStore } from "../root.store";

const mocks = vi.hoisted(() => ({ list: vi.fn(async () => ({ results: [], total_results: 0 })) }));
vi.mock("@/services/inbox", () => ({
  InboxIssueService: class {
    list = mocks.list;
  },
}));
it.each([EInboxIssueCurrentTab.OPEN, EInboxIssueCurrentTab.CLOSED])(
  "resets filters atomically for %s and fetches once without changing sorting",
  (tab) => {
    const store = new ProjectInboxStore({ router: { workspaceSlug: "workspace" } } as CoreRootStore);
    store.currentInboxProjectId = "project";
    store.currentTab = tab;
    store.filtersMap.project = {
      status: [EInboxIssueStatus.SNOOZED],
      labels: ["label"],
      priority: ["high"],
      created_by: ["ada"],
    };
    store.sortingMap.project = { order_by: "issue__updated_at", sort_by: "asc" };
    mocks.list.mockClear();
    store.clearInboxIssueFilters();
    expect(store.inboxFilters).toEqual({
      status:
        tab === EInboxIssueCurrentTab.OPEN
          ? [EInboxIssueStatus.PENDING]
          : [EInboxIssueStatus.ACCEPTED, EInboxIssueStatus.DECLINED, EInboxIssueStatus.DUPLICATE],
    });
    expect(store.inboxSorting).toEqual({ order_by: "issue__updated_at", sort_by: "asc" });
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(mocks.list).toHaveBeenCalledWith(
      "workspace",
      "project",
      expect.objectContaining({ status: tab === EInboxIssueCurrentTab.OPEN ? "-2" : "1,-1,2" })
    );
  }
);
