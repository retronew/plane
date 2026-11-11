import { describe, expect, it, vi } from "vitest";
import { CommentReviewService, commentReviewsKey } from "./comment-review.service";

describe("CommentReviewService", () => {
  it("fetches the issue review collection and permissions", async () => {
    const service = new CommentReviewService();
    const data = { can_review: false, reviews: [] };
    const get = vi.spyOn(service, "get").mockResolvedValueOnce({ data } as never);
    await expect(service.getReviews("team", "project", "issue")).resolves.toBe(data);
    expect(get).toHaveBeenCalledWith("/api/workspaces/team/projects/project/issues/issue/comment-reviews/");
  });

  it.each(["justified", "unjustified", "unreviewed"] as const)("posts %s, including clear", async (status) => {
    const service = new CommentReviewService();
    const data = { comment_id: "comment", status };
    const post = vi.spyOn(service, "post").mockResolvedValueOnce({ data } as never);
    await expect(service.reviewComment("team", "project", "issue", "comment", status)).resolves.toBe(data);
    expect(post).toHaveBeenCalledWith("/api/workspaces/team/projects/project/issues/issue/comment-reviews/comment/", {
      status,
    });
  });

  it("preserves permission and network errors for accurate UI feedback", async () => {
    const service = new CommentReviewService();
    const forbidden = { response: { status: 403, data: { error: "self review" } } };
    vi.spyOn(service, "post").mockRejectedValueOnce(forbidden);
    await expect(service.reviewComment("w", "p", "i", "c", "justified")).rejects.toBe(forbidden);
    const networkError = new Error("offline");
    vi.spyOn(service, "get").mockRejectedValueOnce(networkError);
    await expect(service.getReviews("w", "p", "i")).rejects.toBe(networkError);
  });

  it("shares an issue key across comments while isolating workspace, project and viewer", () => {
    expect(commentReviewsKey("w", "p", "i", "u")).toEqual(["comment-reviews", "w", "p", "i", "u"]);
    expect(commentReviewsKey("w", "p", "i", "u")).not.toEqual(commentReviewsKey("w", "p", "i", "other"));
  });
});
