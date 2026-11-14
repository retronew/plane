"""Public authentication adapters for shared application business endpoints."""

from plane.api.views.base import BaseAPIView
from plane.app.views.analytic.member_work import MemberWorkEndpoint, MemberWorkDetailEndpoint
from plane.app.views.issue.comment_review import IssueCommentReviewEndpoint
from plane.app.views.project.overview import ProjectActivityEndpoint


class MemberWorkAPIEndpoint(BaseAPIView):
    get = MemberWorkEndpoint.get


class MemberWorkItemsAPIEndpoint(BaseAPIView):
    def get(self, request, slug, user_id):
        return MemberWorkDetailEndpoint.get(self, request, slug=slug, user_id=str(user_id))


class ProjectActivityAPIEndpoint(BaseAPIView):
    get = ProjectActivityEndpoint.get


class IssueCommentReviewAPIEndpoint(BaseAPIView):
    visible_issue = IssueCommentReviewEndpoint.visible_issue
    get = IssueCommentReviewEndpoint.get
    post = IssueCommentReviewEndpoint.post
