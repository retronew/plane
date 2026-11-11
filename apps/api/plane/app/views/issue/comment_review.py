from collections import defaultdict

from django.db import transaction
from django.db.models import F, TextField, Value
from django.db.models.functions import Cast, Concat, MD5
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import Issue, IssueComment, IssueCommentReview, ProjectMember, WorkspaceMember


REVIEW_STATUSES = {"justified", "unjustified", "unreviewed"}


def comment_fingerprint(prefix=""):
    # PostgreSQL jsonb text has stable key ordering, shared by reads and writes.
    return MD5(
        Concat(
            F(f"{prefix}comment_html"),
            Value("|"),
            Cast(F(f"{prefix}comment_json"), TextField()),
            Value("|"),
            Cast(F(f"{prefix}edited_at"), TextField()),
            output_field=TextField(),
        )
    )


def can_review(user, slug, project_id):
    memberships = ProjectMember.objects.filter(workspace__slug=slug, project_id=project_id, member=user, is_active=True)
    return memberships.filter(role=ROLE.ADMIN.value).exists() or (
        memberships.exists()
        and WorkspaceMember.objects.filter(
            workspace__slug=slug, member=user, is_active=True, role=ROLE.ADMIN.value
        ).exists()
    )


def review_data(comment, events):
    latest = events[0] if events else None
    stale = bool(latest and latest.content_fingerprint != comment.fingerprint)
    return {
        "comment_id": str(comment.id),
        "status": latest.status if latest and not stale else "unreviewed",
        "reviewer_id": str(latest.reviewer_id) if latest and latest.reviewer_id else None,
        "reviewed_at": latest.reviewed_at if latest else None,
        "is_stale": stale,
        "history": [
            {
                "id": str(e.id),
                "status": e.status,
                "reviewer_id": str(e.reviewer_id) if e.reviewer_id else None,
                "reviewed_at": e.reviewed_at,
            }
            for e in events
        ],
    }


class IssueCommentReviewEndpoint(BaseAPIView):
    def visible_issue(self, request, slug, project_id, issue_id):
        if not WorkspaceMember.objects.filter(workspace__slug=slug, member=request.user, is_active=True).exists():
            raise PermissionDenied()
        membership = get_object_or_404(
            ProjectMember.objects.select_related("project"),
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            is_active=True,
            project__deleted_at__isnull=True,
            project__archived_at__isnull=True,
        )
        issues = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)
        if membership.role == ROLE.GUEST.value and not membership.project.guest_view_all_features:
            issues = issues.filter(created_by=request.user)
        return get_object_or_404(issues, pk=issue_id)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, issue_id, comment_id=None):
        if comment_id is not None:
            raise MethodNotAllowed("GET")
        issue = self.visible_issue(request, slug, project_id, issue_id)
        comments = IssueComment.objects.filter(issue=issue, project_id=project_id, workspace__slug=slug).annotate(
            fingerprint=comment_fingerprint()
        )
        events = defaultdict(list)
        for event in IssueCommentReview.objects.filter(issue=issue, comment_id__in=comments.values("id")):
            events[event.comment_id].append(event)
        return Response(
            {
                "can_review": can_review(request.user, slug, project_id),
                "reviews": [review_data(c, events[c.id]) for c in comments],
            }
        )

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id, issue_id, comment_id=None):
        if comment_id is None:
            raise MethodNotAllowed("POST")
        issue = self.visible_issue(request, slug, project_id, issue_id)
        review_status = request.data.get("status") if isinstance(request.data, dict) else None
        if not isinstance(review_status, str) or review_status not in REVIEW_STATUSES:
            raise ValidationError({"status": "Invalid review status"})
        with transaction.atomic():
            # Serialize decisions for this issue, including decisions on different comments.
            Issue.objects.select_for_update().get(pk=issue.pk)
            comment = get_object_or_404(
                IssueComment.objects.select_for_update().annotate(fingerprint=comment_fingerprint()),
                pk=comment_id,
                issue=issue,
                project_id=project_id,
                workspace__slug=slug,
            )
            if request.user.id in {comment.actor_id, comment.created_by_id}:
                raise PermissionDenied("You cannot review your own comment.")
            IssueCommentReview.objects.create(
                issue=issue,
                comment=comment,
                reviewer=request.user,
                status=request.data["status"],
                content_fingerprint=comment.fingerprint,
            )
            return Response(review_data(comment, list(IssueCommentReview.objects.filter(issue=issue, comment=comment))))
