import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useIssueDetailSync } from "./use-issue-detail-sync";
const mocks = vi.hoisted(() => ({
  sync: { subscribe: vi.fn(), revision: 0, paused: false, invalidate: vi.fn() },
  get: vi.fn(),
  addIssue: vi.fn(),
  removeIssue: vi.fn(),
  getIssueById: vi.fn(() => ({ id: "i", description_html: "local editor" })),
}));
vi.mock("@/lib/sync/issue-sync", () => ({ issueSync: mocks.sync }));
vi.mock("@/services/api.service", () => ({
  APIService: class {
    get = mocks.get;
  },
}));
const list = { removeIssueFromList: vi.fn() };
const store = {
  projectIssues: list,
  cycleIssues: list,
  moduleIssues: list,
  projectViewIssues: list,
  workspaceIssues: list,
  profileIssues: list,
  archivedIssues: list,
  teamIssues: list,
  teamViewIssues: list,
  issues: { addIssue: mocks.addIssue, removeIssue: mocks.removeIssue, getIssueById: mocks.getIssueById },
};
vi.mock("./store/use-issue-detail", () => ({ useIssueDetail: () => ({ rootIssueStore: store }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.sync.revision = 0;
  mocks.sync.paused = false;
  mocks.sync.subscribe.mockReturnValue(() => {});
});
it("merges properties without replacing the collaborative description", async () => {
  mocks.get.mockResolvedValue({ data: { id: "i", name: "remote", description_html: "remote description" } });
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  await mocks.sync.subscribe.mock.calls[0][0].refresh();
  expect(mocks.addIssue).toHaveBeenCalledWith([{ id: "i", name: "remote", description_html: "local editor" }]);
  hook.unmount();
});
it("discards a GET crossing a mutation and schedules another refresh", async () => {
  mocks.get.mockImplementation(async () => {
    mocks.sync.revision++;
    return { data: { id: "i" } };
  });
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  await mocks.sync.subscribe.mock.calls[0][0].refresh();
  expect(mocks.addIssue).not.toHaveBeenCalled();
  expect(mocks.sync.invalidate).toHaveBeenCalledWith("p");
  hook.unmount();
});
it.each([403, 404])("clears inaccessible entities and closes their surface on %s", async (status) => {
  mocks.get.mockRejectedValue({ response: { status } });
  const close = vi.fn();
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i", close));
  await mocks.sync.subscribe.mock.calls[0][0].refresh();
  expect(list.removeIssueFromList).toHaveBeenCalledWith("i");
  expect(mocks.removeIssue).toHaveBeenCalledWith("i");
  expect(close).toHaveBeenCalledOnce();
  hook.unmount();
});
it("does not apply a response after closing", async () => {
  let finish!: (value: unknown) => void;
  mocks.get.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  const refresh = mocks.sync.subscribe.mock.calls[0][0].refresh();
  hook.unmount();
  finish({ data: { id: "i" } });
  await refresh;
  expect(mocks.addIssue).not.toHaveBeenCalled();
});
