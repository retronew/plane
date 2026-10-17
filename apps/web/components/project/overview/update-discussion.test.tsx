import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import type { TProjectOverviewReaction, TProjectOverviewUpdate, TProjectOverviewUpdateComment } from "@plane/types";
import { ProjectUpdateDiscussion } from "./update-discussion";

const mocks = vi.hoisted(() => ({
  getUpdateComments: vi.fn(),
  createUpdateComment: vi.fn(),
  updateUpdateComment: vi.fn(),
  deleteUpdateComment: vi.fn(),
  addUpdateReaction: vi.fn(),
  deleteUpdateReaction: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  getCurrentLanguage: () => "en",
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/services/project/project-overview.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/project/project-overview.service")>();
  return { ...actual, projectOverviewService: mocks };
});
// Keep the real group: its click callback emits Unicode, while the picker emits decimal code points.
vi.mock("@plane/blocks/emoji-reaction", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@plane/blocks/emoji-reaction")>();
  return {
    ...actual,
    EmojiReactionPicker: ({ onChange, disabled }: { onChange: (emoji: string) => void; disabled: boolean }) => (
      <button disabled={disabled} onClick={() => onChange("128105-8205-128187")}>
        pick reaction
      </button>
    ),
  };
});

const actor = {
  id: "me",
  display_name: "Ada",
  first_name: "Ada",
  last_name: "Lovelace",
  avatar_url: "",
  is_bot: false,
};
const comment: TProjectOverviewUpdateComment = {
  id: "comment-1",
  body: "A plain comment\nwith another line",
  created_by: "me",
  created_by_detail: actor,
  created_at: "2026-10-17T00:00:00Z",
  updated_at: "2026-10-17T00:00:00Z",
};
const update: TProjectOverviewUpdate = {
  id: "update-1",
  body: "An update",
  health: "on_track",
  progress: null,
  progress_source: "snapshot",
  comment_count: 0,
  reactions: [],
  created_by: "me",
  created_by_detail: actor,
  created_at: comment.created_at,
  updated_at: comment.updated_at,
};
const reaction = (owner: string): TProjectOverviewReaction => ({
  id: `reaction-${owner}`,
  actor: owner,
  actor_detail: { ...actor, id: owner, display_name: "", first_name: "Grace", last_name: "Hopper" },
  reaction: "128105-8205-128187",
});
const defaults = {
  update,
  workspaceSlug: "acme",
  projectId: "project-1",
  canInteract: true,
  canAdmin: false,
  userId: "me",
  onRefresh: mocks.refresh,
};
function setup(overrides: Partial<React.ComponentProps<typeof ProjectUpdateDiscussion>> = {}) {
  const cache = new Map();
  const config = {
    provider: () => cache,
    dedupingInterval: 0,
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  };
  const view = render(
    <SWRConfig value={config}>
      <ProjectUpdateDiscussion {...defaults} {...overrides} />
    </SWRConfig>
  );
  return {
    ...view,
    change: (next: Partial<React.ComponentProps<typeof ProjectUpdateDiscussion>>) =>
      view.rerender(
        <SWRConfig value={config}>
          <ProjectUpdateDiscussion {...defaults} {...overrides} {...next} />
        </SWRConfig>
      ),
  };
}
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const input = () => screen.getByRole("textbox", { name: /^(?:\d+ )?web\.project_overview\.comment$/ });
const submit = () => fireEvent.submit(input().closest("form")!);
async function openComments() {
  fireEvent.click(button(/^(?:\d+ )?web\.project_overview\.comment$/));
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
}
async function openCommentAction(name: string) {
  fireEvent.click(button("aria_labels.common.more_actions"));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.resetAllMocks();
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  mocks.getUpdateComments.mockResolvedValue([]);
  mocks.createUpdateComment.mockResolvedValue(comment);
  mocks.deleteUpdateComment.mockResolvedValue(undefined);
  mocks.addUpdateReaction.mockResolvedValue(undefined);
  mocks.deleteUpdateReaction.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllGlobals());

describe("project update discussion", () => {
  it("loads comments only when expanded, scopes the request by update, and keeps the count after collapsing", async () => {
    mocks.getUpdateComments.mockResolvedValue([comment]);
    setup({ update: { ...update, comment_count: 4 } });
    const toggle = button(/^(?:\d+ )?web\.project_overview\.comment$/);
    expect(mocks.getUpdateComments).not.toHaveBeenCalled();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toHaveProperty("hidden", true);
    expect(toggle.textContent).toContain("4 web.project_overview.comment");
    fireEvent.click(toggle);
    expect(await screen.findByText(/A plain comment\s+with another line/)).toBeTruthy();
    expect(mocks.getUpdateComments).toHaveBeenCalledWith("acme", "project-1", "update-1");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(button(/^(?:\d+ )?web\.project_overview\.comment$/).textContent).toContain("1 web.project_overview.comment");
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(
      screen
        .getByText(/A plain comment\s+with another line/)
        .closest("li")!
        .querySelector("time")
    ).toHaveProperty("dateTime", comment.created_at);
    fireEvent.click(toggle);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(button(/^(?:\d+ )?web\.project_overview\.comment$/).textContent).toContain("1 web.project_overview.comment");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toHaveProperty("hidden", true);
  });

  it("adds a comment immediately to the local list and refreshes the update list without waiting on it", async () => {
    const refresh = deferred<unknown>();
    mocks.refresh.mockReturnValue(refresh.promise);
    setup();
    await openComments();
    fireEvent.change(input(), { target: { value: "  A plain comment\nwith another line  " } });
    submit();
    expect(await screen.findByText(/A plain comment\s+with another line/)).toBeTruthy();
    expect(mocks.createUpdateComment).toHaveBeenCalledWith(
      "acme",
      "project-1",
      "update-1",
      "  A plain comment\nwith another line  "
    );
    expect(input()).toHaveProperty("value", "");
    expect(input()).toHaveProperty("disabled", false);
    expect(button(/^(?:\d+ )?web\.project_overview\.comment$/).textContent).toContain("1 web.project_overview.comment");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await act(async () => refresh.reject(new Error("list refresh failed")));
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByText(/A plain comment\s+with another line/)).toBeTruthy();
  });

  it("retains a failed draft, prevents duplicate submissions and allows retry", async () => {
    const request = deferred<TProjectOverviewUpdateComment>();
    mocks.createUpdateComment.mockReturnValueOnce(request.promise);
    setup();
    await openComments();
    fireEvent.change(input(), { target: { value: "Draft comment" } });
    submit();
    submit();
    expect(mocks.createUpdateComment).toHaveBeenCalledTimes(1);
    expect(input()).toHaveProperty("disabled", true);
    fireEvent.click(button(/^(?:\d+ )?web\.project_overview\.comment$/));
    expect(button(/^(?:\d+ )?web\.project_overview\.comment$/).getAttribute("aria-expanded")).toBe("true");
    await act(async () => request.reject(new Error("comment failed")));
    expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "something_went_wrong_please_try_again" });
    expect(input()).toHaveProperty("value", "Draft comment");
    expect(input()).toHaveProperty("disabled", false);
    expect(mocks.refresh).not.toHaveBeenCalled();
    submit();
    expect(await screen.findByText(/A plain comment\s+with another line/)).toBeTruthy();
    expect(mocks.createUpdateComment).toHaveBeenCalledTimes(2);
  });

  it.each(["   ", "x".repeat(100_001)])("blocks an empty or oversized draft without calling the API", async (body) => {
    setup();
    await openComments();
    expect(input().getAttribute("maxlength")).toBe("100000");
    fireEvent.change(input(), { target: { value: body } });
    submit();
    expect(mocks.createUpdateComment).not.toHaveBeenCalled();
    expect(button("submit")).toHaveProperty("disabled", true);
  });

  it("retries a failed lazy load, preserves the draft and renders comments as plain text", async () => {
    mocks.getUpdateComments.mockRejectedValueOnce(new Error("unavailable"));
    mocks.getUpdateComments.mockResolvedValueOnce([{ ...comment, body: "<b>Plain text</b>" }]);
    setup();
    fireEvent.click(button(/^(?:\d+ )?web\.project_overview\.comment$/));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("web.project_overview.comments_load_error");
    fireEvent.change(input(), { target: { value: "Keep this draft" } });
    submit();
    expect(mocks.createUpdateComment).not.toHaveBeenCalled();
    fireEvent.click(button("common.retry"));
    const body = await screen.findByText("<b>Plain text</b>");
    expect(body.querySelector("b")).toBeNull();
    expect(input()).toHaveProperty("value", "Keep this draft");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.getUpdateComments).toHaveBeenCalledTimes(2);
  });

  it.each([
    { canInteract: false, userId: "me", canAdmin: true },
    { canInteract: true, userId: undefined, canAdmin: true },
  ])("allows read-only readers to view comments and reactions while hiding write controls", async (permissions) => {
    mocks.getUpdateComments.mockResolvedValue([comment]);
    setup({ ...permissions, update: { ...update, reactions: [reaction("me")] } });
    await openComments();
    expect(await screen.findByText(/A plain comment\s+with another line/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "web.project_overview.delete_comment" })).toBeNull();
    expect(screen.queryByRole("button", { name: "pick reaction" })).toBeNull();
    fireEvent.click(button(/👩‍💻/));
    expect(mocks.deleteUpdateReaction).not.toHaveBeenCalled();
    expect(mocks.addUpdateReaction).not.toHaveBeenCalled();
  });

  it.each([
    { owner: "me", canAdmin: false, expected: true },
    { owner: "other", canAdmin: false, expected: false },
    { owner: "other", canAdmin: true, expected: true },
  ])("limits delete to the comment owner or admin ($owner/$canAdmin)", async ({ owner, canAdmin, expected }) => {
    mocks.getUpdateComments.mockResolvedValue([{ ...comment, created_by: owner }]);
    setup({ canAdmin });
    await openComments();
    await screen.findByText(/A plain comment\s+with another line/);
    expect(Boolean(screen.queryByRole("button", { name: "aria_labels.common.more_actions" }))).toBe(expected);
  });

  it("confirms deletion, preserves a failed confirmation, blocks duplicate deletes and updates the comment count", async () => {
    mocks.getUpdateComments.mockResolvedValue([comment]);
    const request = deferred<void>();
    mocks.deleteUpdateComment.mockReturnValueOnce(request.promise);
    setup();
    await openComments();
    await openCommentAction("web.project_overview.delete_comment");
    const dialog = await screen.findByRole("alertdialog");
    expect(mocks.deleteUpdateComment).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole("button", { name: "delete" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(mocks.deleteUpdateComment).toHaveBeenCalledTimes(1);
    await act(async () => request.reject(new Error("delete failed")));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.queryByText(/A plain comment\s+with another line/)).toBeNull();
    expect(button(/^(?:\d+ )?web\.project_overview\.comment$/).textContent).toBe("web.project_overview.comment");
    expect(mocks.deleteUpdateComment).toHaveBeenLastCalledWith("acme", "project-1", "update-1", "comment-1");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("hides open write controls after permission loss and cannot confirm a previously opened deletion", async () => {
    mocks.getUpdateComments.mockResolvedValue([comment]);
    const view = setup();
    await openComments();
    fireEvent.change(input(), { target: { value: "Draft" } });
    const form = input().closest("form")!;
    await openCommentAction("web.project_overview.delete_comment");
    await screen.findByRole("alertdialog");
    view.change({ canInteract: false });
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "pick reaction" })).toBeNull();
    fireEvent.submit(form);
    expect(mocks.createUpdateComment).not.toHaveBeenCalled();
    expect(mocks.deleteUpdateComment).not.toHaveBeenCalled();
    expect(screen.getByText(/A plain comment\s+with another line/)).toBeTruthy();
  });

  it("edits in place, keeps a failed edit for retry, prevents duplicate saves and preserves the new-comment draft", async () => {
    mocks.getUpdateComments.mockResolvedValue([comment]);
    const request = deferred<TProjectOverviewUpdateComment>();
    mocks.updateUpdateComment
      .mockReturnValueOnce(request.promise)
      .mockResolvedValue({ ...comment, body: "Edited comment" });
    setup();
    await openComments();
    fireEvent.change(input(), { target: { value: "New comment draft" } });
    await openCommentAction("edit");
    const editor = screen.getByRole("textbox", { name: "edit" });
    expect(editor).toHaveProperty("value", comment.body);
    expect(editor.closest("li")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(editor));
    fireEvent.change(editor, { target: { value: "Edited comment" } });
    fireEvent.submit(editor.closest("form")!);
    fireEvent.submit(editor.closest("form")!);
    expect(mocks.updateUpdateComment).toHaveBeenCalledTimes(1);
    expect(mocks.updateUpdateComment).toHaveBeenCalledWith(
      "acme",
      "project-1",
      "update-1",
      "comment-1",
      "Edited comment"
    );
    await act(async () => request.reject(new Error("offline")));
    expect(editor).toHaveProperty("value", "Edited comment");
    fireEvent.submit(editor.closest("form")!);
    expect(await screen.findByText("Edited comment")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "edit" })).toBeNull();
    expect(input()).toHaveProperty("value", "New comment draft");
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("allows cancel, validates edits, and blocks saving after losing author permissions", async () => {
    mocks.getUpdateComments.mockResolvedValue([comment]);
    const view = setup();
    await openComments();
    await openCommentAction("edit");
    fireEvent.change(screen.getByRole("textbox", { name: "edit" }), { target: { value: "   " } });
    expect(button("save")).toHaveProperty("disabled", true);
    fireEvent.submit(screen.getByRole("textbox", { name: "edit" }).closest("form")!);
    expect(mocks.updateUpdateComment).not.toHaveBeenCalled();
    fireEvent.click(button("cancel"));
    expect(screen.getByText(/A plain comment\s+with another line/)).toBeTruthy();
    await openCommentAction("edit");
    const form = screen.getByRole("textbox", { name: "edit" }).closest("form")!;
    view.change({ userId: "other", canAdmin: true });
    expect(screen.queryByRole("textbox", { name: "edit" })).toBeNull();
    fireEvent.submit(form);
    expect(mocks.updateUpdateComment).not.toHaveBeenCalled();
    fireEvent.click(button("aria_labels.common.more_actions"));
    expect(await screen.findByRole("menuitem", { name: "web.project_overview.delete_comment" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "edit" })).toBeNull();
  });

  it("toggles only the current actor's reaction and awaits a real list refresh before another mutation", async () => {
    const refresh = deferred<unknown>();
    mocks.refresh.mockReturnValueOnce(refresh.promise);
    const view = setup({ update: { ...update, reactions: [reaction("me"), reaction("other")] } });
    fireEvent.click(button(/👩‍💻/));
    fireEvent.click(button(/👩‍💻/));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.deleteUpdateReaction).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUpdateReaction).toHaveBeenCalledWith("acme", "project-1", "update-1", "128105-8205-128187");
    expect(button("pick reaction")).toHaveProperty("disabled", true);
    view.change({ update: { ...update, reactions: [reaction("other")] } });
    await act(async () => refresh.resolve(undefined));
    fireEvent.click(button("pick reaction"));
    await waitFor(() =>
      expect(mocks.addUpdateReaction).toHaveBeenCalledWith("acme", "project-1", "update-1", "128105-8205-128187")
    );
    expect(mocks.deleteUpdateReaction).toHaveBeenCalledTimes(1);
  });

  it("retains reactions on failure and permits a retry without duplicate requests", async () => {
    const request = deferred<void>();
    mocks.addUpdateReaction.mockReturnValueOnce(request.promise);
    setup({ update: { ...update, reactions: [reaction("other")] } });
    fireEvent.click(button("pick reaction"));
    fireEvent.click(button("pick reaction"));
    expect(mocks.addUpdateReaction).toHaveBeenCalledTimes(1);
    await act(async () => request.reject(new Error("reaction failed")));
    expect(button(/👩‍💻/)).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    fireEvent.click(button("pick reaction"));
    await waitFor(() => expect(mocks.addUpdateReaction).toHaveBeenCalledTimes(2));
  });

  it("keeps two cards' open state, drafts, caches and reaction requests isolated", async () => {
    mocks.getUpdateComments.mockImplementation(async (_slug: string, _projectId: string, updateId: string) =>
      updateId === "update-1" ? [comment] : [{ ...comment, id: "comment-2", body: "Second discussion" }]
    );
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <article aria-label="first update">
          <ProjectUpdateDiscussion {...defaults} update={{ ...update, reactions: [reaction("me")] }} />
        </article>
        <article aria-label="second update">
          <ProjectUpdateDiscussion
            {...defaults}
            update={{ ...update, id: "update-2", reactions: [reaction("other")] }}
          />
        </article>
      </SWRConfig>
    );
    const first = within(screen.getByRole("article", { name: "first update" }));
    const second = within(screen.getByRole("article", { name: "second update" }));
    fireEvent.click(first.getByRole("button", { name: /^(?:\d+ )?web\.project_overview\.comment$/ }));
    await first.findByText(/A plain comment\s+with another line/);
    expect(second.queryByRole("textbox")).toBeNull();
    expect(mocks.getUpdateComments).toHaveBeenCalledTimes(1);
    fireEvent.change(first.getByRole("textbox"), { target: { value: "First draft" } });
    fireEvent.click(second.getByRole("button", { name: /^(?:\d+ )?web\.project_overview\.comment$/ }));
    await second.findByText("Second discussion");
    expect(first.getByRole("textbox")).toHaveProperty("value", "First draft");
    expect(second.getByRole("textbox")).toHaveProperty("value", "");
    fireEvent.click(second.getByRole("button", { name: /👩‍💻/ }));
    await waitFor(() =>
      expect(mocks.addUpdateReaction).toHaveBeenCalledWith("acme", "project-1", "update-2", "128105-8205-128187")
    );
    expect(mocks.deleteUpdateReaction).not.toHaveBeenCalled();
    expect(first.getByText(/A plain comment\s+with another line/)).toBeTruthy();
    expect(second.queryByText(/A plain comment\s+with another line/)).toBeNull();
  });

  it("drops drafts and confirmation when a reused card navigates to another update", async () => {
    mocks.getUpdateComments.mockResolvedValue([comment]);
    const view = setup();
    await openComments();
    fireEvent.change(input(), { target: { value: "Old draft" } });
    await openCommentAction("web.project_overview.delete_comment");
    await screen.findByRole("alertdialog");
    view.change({ workspaceSlug: "other", projectId: "project-2", update: { ...update, id: "update-2" } });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(button(/^(?:\d+ )?web\.project_overview\.comment$/).getAttribute("aria-expanded")).toBe("false");
    await openComments();
    expect(input()).toHaveProperty("value", "");
    expect(mocks.getUpdateComments).toHaveBeenLastCalledWith("other", "project-2", "update-2");
  });
});
