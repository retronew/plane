import { expect, it, vi } from "vitest";
import { runInAction } from "mobx";
import { StickyStore } from "./sticky.store";

vi.mock("@/services/sticky.service", () => ({ StickyService: vi.fn() }));

it("deduplicates incoming stickies against existing IDs and within a page, keeping order and last data", async () => {
  const store = new StickyStore();
  runInAction(() => {
    store.workspaceStickies.w = ["old", "old"];
  });
  store.paginationInfo = { next_cursor: "next", next_page_results: true } as never;
  store.stickyService = {
    getStickies: vi.fn().mockResolvedValue({
      results: [
        { id: "old", name: "updated" },
        { id: "new", name: "first" },
        { id: "new", name: "last" },
        { id: "last" },
      ],
      next_cursor: "end",
      next_page_results: false,
    }),
  } as never;
  await store.fetchNextWorkspaceStickies("w");
  expect(store.workspaceStickies.w).toEqual(["old", "old", "new", "last"]);
  expect(store.stickies.new.name).toBe("last");
  expect(store.loader).toBe("loaded");
});
