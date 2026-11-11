import { API_BASE_URL } from "@plane/constants";
import { APIService } from "./api.service";

export type TCommentReviewStatus = "justified" | "unjustified" | "unreviewed";
export type TCommentReviewHistory = {
  id: string;
  status: TCommentReviewStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
};
export type TCommentReview = {
  comment_id: string;
  status: TCommentReviewStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  is_stale: boolean;
  history: TCommentReviewHistory[];
};
export type TCommentReviewsResponse = { can_review: boolean; reviews: TCommentReview[] };

export const commentReviewsKey = (workspaceSlug: string, projectId: string, issueId: string, userId: string) =>
  ["comment-reviews", workspaceSlug, projectId, issueId, userId] as const;

export class CommentReviewService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getReviews(workspaceSlug: string, projectId: string, issueId: string): Promise<TCommentReviewsResponse> {
    const response = await this.get(this.path(workspaceSlug, projectId, issueId));
    return response.data;
  }

  async reviewComment(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
    status: TCommentReviewStatus
  ): Promise<TCommentReview> {
    const response = await this.post(`${this.path(workspaceSlug, projectId, issueId)}${commentId}/`, { status });
    return response.data;
  }

  private path(workspaceSlug: string, projectId: string, issueId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/comment-reviews/`;
  }
}
