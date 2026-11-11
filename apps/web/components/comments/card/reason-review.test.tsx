import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useSWR, { SWRConfig } from "swr";
import type { TIssueComment } from "@plane/types";
import type { TCommentReview, TCommentReviewsResponse } from "@/services/comment-review.service";
import { CommentReasonReview } from "./reason-review";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  toast: vi.fn(),
  currentUser: { id: "admin" },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: mocks.currentUser }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) =>
      id === "admin" ? { display_name: "Reviewer", email: "secret@example.com" } : undefined,
  }),
}));
vi.mock("@/services/comment-review.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/comment-review.service")>();
  return {
    ...original,
    CommentReviewService: class {
      getReviews = mocks.get;
      reviewComment = mocks.post;
    },
  };
});
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({
    label,
    variant: _variant,
    size: _size,
    stretch: _stretch,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: string;
    size?: string;
    stretch?: "auto" | "full";
  }) => <button {...props}>{label}</button>,
}));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ children, label }: { children: ReactNode; label: string }) => <div title={label}>{children}</div>,
}));
vi.mock("@plane/blocks/common", () => ({
  ActionMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuTrigger: ({ render: element }: { render: ReactNode }) => element,
  MenuItem: ({ label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
    <button {...props}>{label}</button>
  ),
}));

const comment = {
  id: "comment",
  actor: "author",
  created_by: "author",
  comment_html: "<p>Reason</p>",
} as TIssueComment;
const review: TCommentReview = {
  comment_id: "comment",
  status: "justified",
  reviewer_id: "admin",
  reviewed_at: "2026-11-11T12:00:00Z",
  is_stale: false,
  history: [{ id: "h1", status: "justified", reviewer_id: "admin", reviewed_at: "2026-11-11T12:00:00Z" }],
};
const response = (overrides: Partial<TCommentReviewsResponse> = {}): TCommentReviewsResponse => ({
  can_review: true,
  reviews: [review],
  ...overrides,
});
const card = (value = comment) => (
  <CommentReasonReview workspaceSlug="team" projectId="project" issueId="issue" comment={value} />
);
function setup(children: ReactNode = card()) {
  const cache = new Map();
  const wrapper = ({ children: nested }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => cache, dedupingInterval: 2000, shouldRetryOnError: false }}>{nested}</SWRConfig>
  );
  return { ...render(children, { wrapper }), cache };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser = { id: "admin" };
  mocks.get.mockResolvedValue(response());
  mocks.post.mockResolvedValue({ ...review, status: "unjustified" });
});

describe("comment reason review", () => {
  it("shows members a read-only review and cached display names without email", async () => {
    mocks.get.mockResolvedValue(response({ can_review: false }));
    setup();
    expect(await screen.findByText("web.reason_review_justified")).toBeTruthy();
    expect(screen.queryByLabelText("web.reason_review_action")).toBeNull();
    expect(screen.getByText("Reviewer")).toBeTruthy();
    expect(screen.queryByText(/secret@example/)).toBeNull();
  });

  it("shares one GET across cards belonging to the same issue", async () => {
    setup(
      <>
        {card()}
        {card({ ...comment, id: "second" })}
      </>
    );
    await screen.findByText("web.reason_review_justified");
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(screen.getByText("web.reason_review_unreviewed")).toBeTruthy();
  });

  it.each(["actor", "created_by"] as const)("disables self-review using %s", async (field) => {
    setup(card({ ...comment, [field]: "admin" }));
    const trigger = await screen.findByLabelText("web.reason_review_action");
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTitle("web.reason_review_self_disabled")).toBeTruthy();
    fireEvent.click(screen.getByText("web.reason_review_mark_unjustified"));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("saves only once while busy, updates the shared issue and refreshes member-work", async () => {
    let finish!: (value: TCommentReview) => void;
    mocks.post.mockImplementation(
      () =>
        new Promise<TCommentReview>((resolve) => {
          finish = resolve;
        })
    );
    const boardRefresh = vi.fn().mockResolvedValue({});
    function Board() {
      useSWR(["member-work", "team", "project"], boardRefresh);
      return null;
    }
    setup(
      <>
        {card()}
        <Board />
      </>
    );
    await screen.findByLabelText("web.reason_review_action");
    const action = screen.getByText("web.reason_review_mark_unjustified");
    fireEvent.click(action);
    fireEvent.click(action);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect((action as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ ...review, status: "unjustified" }));
    await waitFor(() =>
      expect(screen.getByLabelText("web.reason_review_action").textContent).toBe("web.reason_review_unjustified")
    );
    expect(mocks.toast).not.toHaveBeenCalled();
    await waitFor(() => expect(boardRefresh).toHaveBeenCalledTimes(2));
  });

  it.each([403, 500])("preserves the original decision after HTTP %s and shows the correct error", async (status) => {
    mocks.post.mockRejectedValue({ response: { status } });
    setup();
    await screen.findByLabelText("web.reason_review_action");
    fireEvent.click(screen.getByText("web.reason_review_mark_unjustified"));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        type: "error",
        title: "web.reason_review_save_failed",
        message: status === 403 ? "web.reason_review_forbidden" : "web.reason_review_retry_message",
      })
    );
    expect(screen.getByLabelText("web.reason_review_action").textContent).toBe("web.reason_review_justified");
  });

  it("clears a review with unreviewed and retains its audit history", async () => {
    mocks.post.mockResolvedValue({ ...review, status: "unreviewed" });
    setup();
    await screen.findByLabelText("web.reason_review_action");
    fireEvent.click(screen.getByText("web.reason_review_clear"));
    await waitFor(() =>
      expect(screen.getByLabelText("web.reason_review_action").textContent).toBe("web.reason_review_unreviewed")
    );
    expect(mocks.post).toHaveBeenCalledWith("team", "project", "issue", "comment", "unreviewed");
    fireEvent.click(screen.getByText("web.reason_review_history"));
    expect(screen.getByRole("list", { name: "web.reason_review_history" }).textContent).toContain("Reviewer");
    expect(screen.getByText("web.reason_review_justified")).toBeTruthy();
  });

  it("shows stale decisions as requiring review, keeping old decisions in history", async () => {
    mocks.get.mockResolvedValue(response({ reviews: [{ ...review, status: "unreviewed", is_stale: true }] }));
    setup();
    expect(await screen.findByText("web.reason_review_stale")).toBeTruthy();
    expect(screen.queryByText("web.reason_review_justified")).toBeNull();
    fireEvent.click(screen.getByText("web.reason_review_history"));
    expect(screen.getByText("web.reason_review_justified")).toBeTruthy();
    expect(screen.getByText("web.reason_review_stale_hint")).toBeTruthy();
  });

  it("refetches after editing, hides the old decision and refreshes the member overview", async () => {
    const boardRefresh = vi.fn().mockResolvedValue({});
    function Board() {
      useSWR(["member-work", "overview", "team"], boardRefresh);
      return null;
    }
    const content = (value = comment) => (
      <>
        {card(value)}
        <Board />
      </>
    );
    const view = setup(content());
    await screen.findByText("web.reason_review_justified");
    let finish!: (value: TCommentReviewsResponse) => void;
    mocks.get.mockImplementationOnce(
      () =>
        new Promise<TCommentReviewsResponse>((resolve) => {
          finish = resolve;
        })
    );
    const edited = { ...comment, edited_at: "2026-11-11T13:00:00Z", comment_html: "<p>Updated reason</p>" };
    view.rerender(content(edited));
    expect(screen.queryByText("web.reason_review_justified")).toBeNull();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    await act(async () => finish(response({ reviews: [{ ...review, status: "unreviewed", is_stale: true }] })));
    expect(await screen.findByText("web.reason_review_stale")).toBeTruthy();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(boardRefresh).toHaveBeenCalledTimes(2));
  });

  it("does not reuse an old review after editing and remounting a card", async () => {
    const view = setup();
    await screen.findByText("web.reason_review_justified");
    view.rerender(<div />);
    mocks.get.mockResolvedValue(response({ reviews: [{ ...review, status: "unreviewed", is_stale: true }] }));
    view.rerender(card({ ...comment, comment_html: "changed" }));
    expect(screen.queryByText("web.reason_review_justified")).toBeNull();
    expect(await screen.findByText("web.reason_review_stale")).toBeTruthy();
  });

  it("keeps edited review results hidden after a failed refresh and supports retry", async () => {
    const view = setup();
    await screen.findByText("web.reason_review_justified");
    mocks.get.mockRejectedValueOnce(new Error("offline"));
    view.rerender(card({ ...comment, comment_html: "changed" }));
    await screen.findByText("web.reason_review_load_failed");
    expect(screen.queryByText("web.reason_review_justified")).toBeNull();
    mocks.get.mockResolvedValue(response({ reviews: [{ ...review, status: "unreviewed", is_stale: true }] }));
    fireEvent.click(screen.getByText("web.reason_review_retry"));
    expect(await screen.findByText("web.reason_review_stale")).toBeTruthy();
  });
});
