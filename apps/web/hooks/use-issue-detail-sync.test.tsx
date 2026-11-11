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
const detail = {
  addAttachments: vi.fn(),
  addLinks: vi.fn(),
  addReactions: vi.fn(),
  addSubscription: vi.fn(),
  setPeekIssue: vi.fn(),
  peekIssue: { issueId: "i" },
  comment: { comments: {} as Record<string, string[]>, commentMap: {} as Record<string, unknown> },
  commentReaction: { applyCommentReactions: vi.fn() },
  activity: { activities: {} as Record<string, string[]>, activityMap: {} as Record<string, unknown> },
  relation: { relationMap: {} as Record<string, unknown> },
  subIssues: { subIssues: {} as Record<string, string[]>, subIssuesStateDistribution: {} as Record<string, unknown> },
};
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
  issueDetail: detail,
  rootStore: {
    state: { getStateById: vi.fn(() => undefined), stateMap: {} },
    label: { getLabelById: vi.fn(() => undefined), labelMap: {} },
    memberRoot: { getUserDetails: vi.fn(() => undefined), memberMap: {} },
  },
};
vi.mock("./store/use-issue-detail", () => ({ useIssueDetail: () => ({ rootIssueStore: store }) }));
function respond(url: string, config: { params?: { activity_type?: string } }) {
  if (url.endsWith("history/"))
    return {
      data: config.params?.activity_type === "issue-comment" ? [{ id: "c", comment_reactions: [] }] : [{ id: "a" }],
    };
  if (url.endsWith("issue-relation/")) return { data: { blocking: [] } };
  if (url.endsWith("sub-issues/")) return { data: { sub_issues: [{ id: "child" }], state_distribution: {} } };
  if (url.endsWith("states/")) return { data: [{ id: "new-state" }] };
  if (url.endsWith("issue-labels/")) return { data: [] };
  return { data: { id: "i", name: "remote", description_html: "remote description" } };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.sync.revision = 0;
  mocks.sync.paused = false;
  mocks.sync.subscribe.mockReturnValue(() => {});
  mocks.get.mockImplementation(async (url, config) => respond(url, config));
  detail.comment.comments = { i: ["deleted"] };
  detail.comment.commentMap = { deleted: { id: "deleted" } };
  detail.relation.relationMap = { i: { blocking: ["stale"] } };
});
it("refreshes the entity and all detail collections, removing deleted comments and empty relations", async () => {
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  await mocks.sync.subscribe.mock.calls[0][0].refresh();
  expect(mocks.addIssue).toHaveBeenCalledWith([
    expect.objectContaining({ id: "i", name: "remote", description_html: "remote description", sub_issues_count: 1 }),
  ]);
  expect(detail.comment.comments.i).toEqual(["c"]);
  expect(detail.comment.commentMap.deleted).toBeUndefined();
  expect(detail.commentReaction.applyCommentReactions).toHaveBeenCalledWith("deleted", []);
  expect(detail.activity.activities.i).toEqual(["a"]);
  expect(detail.relation.relationMap.i).toEqual({ blocking: [] });
  expect(detail.subIssues.subIssues.i).toEqual(["child"]);
  expect(detail.addAttachments).toHaveBeenCalledWith("i", []);
  expect(detail.addLinks).toHaveBeenCalledWith("i", []);
  expect(detail.addReactions).toHaveBeenCalledWith("i", []);
  expect(mocks.get).toHaveBeenCalledTimes(7);
  hook.unmount();
});
it("discards a snapshot crossing a mutation and schedules another refresh", async () => {
  mocks.get.mockImplementation(async (url, config) => {
    mocks.sync.revision++;
    return respond(url, config);
  });
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  await expect(mocks.sync.subscribe.mock.calls[0][0].refresh()).rejects.toHaveProperty("name", "AbortError");
  expect(mocks.addIssue).not.toHaveBeenCalled();
  hook.unmount();
});
it.each([403, 404])("clears inaccessible entities and closes their surface on %s", async (status) => {
  mocks.get.mockRejectedValue({ response: { status } });
  const close = vi.fn();
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i", close));
  await mocks.sync.subscribe.mock.calls[0][0].refresh();
  expect(list.removeIssueFromList).toHaveBeenCalledWith("i");
  expect(mocks.removeIssue).toHaveBeenCalledWith("i");
  expect(detail.setPeekIssue).toHaveBeenCalledWith(undefined);
  expect(close).toHaveBeenCalledOnce();
  hook.unmount();
});
it.each(["hidden", "closed", "superseded"])("rejects all late collection responses after %s", async (mode) => {
  const pending: (() => void)[] = [];
  const signals: AbortSignal[] = [];
  mocks.get.mockImplementation(async (url, config) => {
    signals.push(config.signal);
    return new Promise((resolve) => pending.push(() => resolve(respond(url, config))));
  });
  const hook = renderHook(({ id }) => useIssueDetailSync("w", "p", id), { initialProps: { id: "i" } });
  const subscription = mocks.sync.subscribe.mock.calls[0][0];
  const refresh = subscription.refresh();
  if (mode === "hidden") {
    mocks.sync.paused = true;
    subscription.abort();
  } else if (mode === "closed") hook.unmount();
  else hook.rerender({ id: "next" });
  expect(signals).toHaveLength(5);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  pending.forEach((resolve) => resolve());
  await expect(refresh).rejects.toHaveProperty("name", "AbortError");
  expect(mocks.addIssue).not.toHaveBeenCalled();
  expect(detail.comment.comments.i).toEqual(["deleted"]);
  hook.unmount();
});
it("clears all collections when remote items are removed", async () => {
  mocks.get.mockImplementation(async (url, config) => {
    if (url.endsWith("history/")) return { data: [] };
    if (url.endsWith("sub-issues/")) return { data: { sub_issues: [], state_distribution: {} } };
    if (url.endsWith("issue-relation/")) return { data: {} };
    return respond(url, config);
  });
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  await mocks.sync.subscribe.mock.calls[0][0].refresh();
  expect(detail.comment.comments.i).toEqual([]);
  expect(detail.activity.activities.i).toEqual([]);
  expect(detail.relation.relationMap.i).toEqual({});
  expect(detail.subIssues.subIssues.i).toEqual([]);
  expect(mocks.addIssue).toHaveBeenCalledWith([expect.objectContaining({ sub_issues_count: 0 })]);
  hook.unmount();
});
it("keeps remotely archived entities so the route can redirect instead of reporting deletion", async () => {
  mocks.get.mockImplementation(async (url, config) =>
    url.endsWith("/i/") ? { data: { id: "i", archived_at: "today" } } : respond(url, config)
  );
  const close = vi.fn();
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i", close));
  await mocks.sync.subscribe.mock.calls[0][0].refresh();
  expect(mocks.addIssue).toHaveBeenCalledWith([expect.objectContaining({ archived_at: "today" })]);
  expect(mocks.removeIssue).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  hook.unmount();
});
it("loads dictionaries only when the snapshot references unknown identifiers", async () => {
  mocks.get.mockImplementation(async (url, config) => {
    if (url.endsWith("issue-labels/")) return { data: [{ id: "label" }] };
    if (url.endsWith("members/"))
      return { data: [{ member: { id: "user", display_name: "Remote" }, created_at: "today" }] };
    const response = respond(url, config);
    return url.endsWith("/i/")
      ? { data: { id: "i", state_id: "new-state", label_ids: ["label"], assignee_ids: ["user"] } }
      : response;
  });
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  await mocks.sync.subscribe.mock.calls[0][0].refresh();
  expect(store.rootStore.state.stateMap).toEqual({ "new-state": { id: "new-state" } });
  expect(store.rootStore.label.labelMap).toEqual({ label: { id: "label" } });
  expect(store.rootStore.memberRoot.memberMap).toEqual({
    user: { id: "user", display_name: "Remote", joining_date: "today" },
  });
  hook.unmount();
});

it("refreshes and removes cached state and label entries on reset", async () => {
  store.rootStore.state.stateMap = {
    known: { id: "known", project_id: "p", name: "before", color: "red" },
    removed: { id: "removed", project_id: "p" },
    other: { id: "other", project_id: "another" },
  };
  store.rootStore.label.labelMap = {
    known: { id: "known", project_id: "p", name: "before", color: "red" },
    removed: { id: "removed", project_id: "p" },
  };
  mocks.get.mockImplementation(async (url, config) => {
    if (url.endsWith("states/") || url.endsWith("issue-labels/"))
      return { data: [{ id: "known", project_id: "p", name: "renamed", color: "blue" }] };
    return respond(url, config);
  });
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  await mocks.sync.subscribe.mock.calls[0][0].refresh({ reset: true });
  expect(store.rootStore.state.stateMap).toEqual({
    known: expect.objectContaining({ name: "renamed", color: "blue" }),
    other: expect.anything(),
  });
  expect(store.rootStore.label.labelMap).toEqual({
    known: expect.objectContaining({ name: "renamed", color: "blue" }),
  });
  hook.unmount();
});

it("does not fetch known dictionaries for a precise ordinary issue event", async () => {
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  await mocks.sync.subscribe.mock.calls[0][0].refresh({ issueIds: ["i"], changedFields: ["name"] });
  expect(mocks.get).toHaveBeenCalledTimes(5);
  hook.unmount();
});

it("skips unrelated IDs but never skips a reset", async () => {
  const hook = renderHook(() => useIssueDetailSync("w", "p", "i"));
  const subscription = mocks.sync.subscribe.mock.calls[0][0];
  await subscription.refresh({ issueIds: ["other"], changedFields: ["name"] });
  expect(mocks.get).not.toHaveBeenCalled();
  await subscription.refresh({ issueIds: ["other"], reset: true });
  expect(mocks.get).toHaveBeenCalledTimes(7);
  hook.unmount();
});
