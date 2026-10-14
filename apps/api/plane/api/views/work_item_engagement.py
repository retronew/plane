# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Subscribers, reactions and description history of a work item."""

# Python imports
import json

# Django imports
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiRequest, OpenApiResponse, OpenApiTypes

# Module imports
from plane.api.views.base import BaseAPIView
from plane.api.views.search import visible_work_items
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import CommentReaction, IssueComment, IssueDescriptionVersion, IssueReaction, IssueSubscriber
from plane.mcp.formatting import html_to_markdown
from plane.utils.host import base_host
from plane.utils.openapi.decorators import work_item_docs

WORK_ITEM_ID_PARAMETER = OpenApiParameter(
    name="work_item_id", required=True, type=OpenApiTypes.UUID, location=OpenApiParameter.PATH
)
REACTION_REQUEST = OpenApiRequest(
    request={"type": "object", "properties": {"reaction": {"type": "string", "description": "Emoji, e.g. 👍"}}}
)


def _user(user):
    return {"id": str(user.id), "display_name": user.display_name} if user else None


class WorkItemEngagementMixin:
    """Any member who can see the work item may follow and react to it, guests included."""

    def get_work_item(self, slug, project_id, work_item_id):
        return visible_work_items(slug, self.request.user).filter(project_id=project_id, pk=work_item_id).first()

    def record(self, issue, activity_type, requested_data, current_instance=None):
        issue_activity.delay(
            type=activity_type,
            requested_data=json.dumps(requested_data) if requested_data is not None else None,
            actor_id=str(self.request.user.id),
            issue_id=str(issue.id),
            project_id=str(issue.project_id),
            current_instance=json.dumps(current_instance) if current_instance is not None else None,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=self.request, is_app=True),
        )

    def not_found(self):
        return Response({"error": "Work item not found"}, status=status.HTTP_404_NOT_FOUND)


# -- subscribers -------------------------------------------------------------------


class WorkItemSubscriberListAPIEndpoint(WorkItemEngagementMixin, BaseAPIView):
    @work_item_docs(
        operation_id="list_work_item_subscribers",
        summary="List work item subscribers",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Subscribers")},
    )
    def get(self, request, slug, project_id, work_item_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        subscribers = IssueSubscriber.objects.filter(issue=issue).select_related("subscriber")
        return Response([_user(s.subscriber) for s in subscribers])


class WorkItemSubscribeAPIEndpoint(WorkItemEngagementMixin, BaseAPIView):
    @work_item_docs(
        operation_id="get_work_item_subscription",
        summary="Am I subscribed",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={200: OpenApiResponse(description="{subscribed: bool}")},
    )
    def get(self, request, slug, project_id, work_item_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        return Response({"subscribed": IssueSubscriber.objects.filter(issue=issue, subscriber=request.user).exists()})

    @work_item_docs(
        operation_id="subscribe_work_item",
        summary="Subscribe to a work item",
        description="Get notified about changes to this work item.",
        parameters=[WORK_ITEM_ID_PARAMETER],
        request=None,
        responses={200: OpenApiResponse(description="{subscribed: true}")},
    )
    def post(self, request, slug, project_id, work_item_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        IssueSubscriber.objects.get_or_create(
            issue=issue, subscriber=request.user, project_id=issue.project_id, workspace_id=issue.workspace_id
        )
        return Response({"subscribed": True})

    @work_item_docs(
        operation_id="unsubscribe_work_item",
        summary="Unsubscribe from a work item",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={200: OpenApiResponse(description="{subscribed: false}")},
    )
    def delete(self, request, slug, project_id, work_item_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        IssueSubscriber.objects.filter(issue=issue, subscriber=request.user).delete()
        return Response({"subscribed": False})


# -- reactions ---------------------------------------------------------------------


def _reaction_summary(reactions, user):
    """Group reactions by emoji: who reacted and whether the requesting user did."""
    summary = {}
    for reaction in reactions:
        entry = summary.setdefault(
            reaction.reaction, {"reaction": reaction.reaction, "count": 0, "users": [], "mine": False}
        )
        entry["count"] += 1
        entry["users"].append(_user(reaction.actor))
        entry["mine"] = entry["mine"] or reaction.actor_id == user.id
    return list(summary.values())


def _reaction_from(request):
    reaction = request.data.get("reaction")
    if not isinstance(reaction, str) or not reaction.strip() or len(reaction) > 32:
        return None
    return reaction.strip()


class WorkItemReactionAPIEndpoint(WorkItemEngagementMixin, BaseAPIView):
    @work_item_docs(
        operation_id="list_work_item_reactions",
        summary="List work item reactions",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Reactions grouped by emoji")},
    )
    def get(self, request, slug, project_id, work_item_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        reactions = IssueReaction.objects.filter(issue=issue).select_related("actor").order_by("created_at")
        return Response(_reaction_summary(reactions, request.user))

    @work_item_docs(
        operation_id="add_work_item_reaction",
        summary="React to a work item",
        parameters=[WORK_ITEM_ID_PARAMETER],
        request=REACTION_REQUEST,
        responses={201: OpenApiResponse(description="Reaction added")},
    )
    def post(self, request, slug, project_id, work_item_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        reaction = _reaction_from(request)
        if reaction is None:
            return Response({"error": "`reaction` must be a short emoji string"}, status=status.HTTP_400_BAD_REQUEST)
        _, created = IssueReaction.objects.get_or_create(
            issue=issue,
            actor=request.user,
            reaction=reaction,
            project_id=issue.project_id,
            workspace_id=issue.workspace_id,
        )
        if created:
            self.record(issue, "issue_reaction.activity.created", {"reaction": reaction})
        return Response({"reaction": reaction}, status=status.HTTP_201_CREATED)


class WorkItemReactionDetailAPIEndpoint(WorkItemEngagementMixin, BaseAPIView):
    @work_item_docs(
        operation_id="remove_work_item_reaction",
        summary="Remove my reaction from a work item",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={204: OpenApiResponse(description="Reaction removed")},
    )
    def delete(self, request, slug, project_id, work_item_id, reaction):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        mine = IssueReaction.objects.filter(issue=issue, actor=request.user, reaction=reaction).first()
        if mine is None:
            return Response({"error": "Reaction not found"}, status=status.HTTP_404_NOT_FOUND)
        self.record(issue, "issue_reaction.activity.deleted", None, {"reaction": reaction, "identifier": str(mine.id)})
        mine.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkItemCommentReactionMixin(WorkItemEngagementMixin):
    def get_comment(self, slug, project_id, work_item_id, comment_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return None, None
        return issue, IssueComment.objects.filter(issue=issue, pk=comment_id).first()


class WorkItemCommentReactionAPIEndpoint(WorkItemCommentReactionMixin, BaseAPIView):
    @work_item_docs(
        operation_id="list_comment_reactions",
        summary="List comment reactions",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Reactions grouped by emoji")},
    )
    def get(self, request, slug, project_id, work_item_id, comment_id):
        _, comment = self.get_comment(slug, project_id, work_item_id, comment_id)
        if comment is None:
            return Response({"error": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        reactions = CommentReaction.objects.filter(comment=comment).select_related("actor").order_by("created_at")
        return Response(_reaction_summary(reactions, request.user))

    @work_item_docs(
        operation_id="add_comment_reaction",
        summary="React to a comment",
        parameters=[WORK_ITEM_ID_PARAMETER],
        request=REACTION_REQUEST,
        responses={201: OpenApiResponse(description="Reaction added")},
    )
    def post(self, request, slug, project_id, work_item_id, comment_id):
        issue, comment = self.get_comment(slug, project_id, work_item_id, comment_id)
        if comment is None:
            return Response({"error": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        reaction = _reaction_from(request)
        if reaction is None:
            return Response({"error": "`reaction` must be a short emoji string"}, status=status.HTTP_400_BAD_REQUEST)
        _, created = CommentReaction.objects.get_or_create(
            comment=comment,
            actor=request.user,
            reaction=reaction,
            project_id=issue.project_id,
            workspace_id=issue.workspace_id,
        )
        if created:
            self.record(
                issue, "comment_reaction.activity.created", {"reaction": reaction, "comment_id": str(comment.id)}
            )
        return Response({"reaction": reaction}, status=status.HTTP_201_CREATED)


class WorkItemCommentReactionDetailAPIEndpoint(WorkItemCommentReactionMixin, BaseAPIView):
    @work_item_docs(
        operation_id="remove_comment_reaction",
        summary="Remove my reaction from a comment",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={204: OpenApiResponse(description="Reaction removed")},
    )
    def delete(self, request, slug, project_id, work_item_id, comment_id, reaction):
        issue, comment = self.get_comment(slug, project_id, work_item_id, comment_id)
        if comment is None:
            return Response({"error": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        mine = CommentReaction.objects.filter(comment=comment, actor=request.user, reaction=reaction).first()
        if mine is None:
            return Response({"error": "Reaction not found"}, status=status.HTTP_404_NOT_FOUND)
        self.record(
            issue,
            "comment_reaction.activity.deleted",
            None,
            {"reaction": reaction, "identifier": str(mine.id), "comment_id": str(comment.id)},
        )
        mine.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# -- description history -------------------------------------------------------------


def _version(version, with_body=False):
    data = {
        "id": str(version.id),
        "last_saved_at": version.last_saved_at,
        "owned_by": _user(version.owned_by),
    }
    if with_body:
        data["description_html"] = version.description_html
        data["description"] = html_to_markdown(version.description_html)
    return data


class WorkItemDescriptionVersionListAPIEndpoint(WorkItemEngagementMixin, BaseAPIView):
    use_read_replica = True

    @work_item_docs(
        operation_id="list_work_item_description_versions",
        summary="List description versions",
        description="Saved versions of the work item's description, newest first (bodies are fetched one by one).",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Paginated versions")},
    )
    def get(self, request, slug, project_id, work_item_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        versions = IssueDescriptionVersion.objects.filter(issue=issue).select_related("owned_by")
        return self.paginate(
            request=request,
            queryset=versions.order_by("-last_saved_at", "id"),
            on_results=lambda items: [_version(v) for v in items],
        )


class WorkItemDescriptionVersionDetailAPIEndpoint(WorkItemEngagementMixin, BaseAPIView):
    @work_item_docs(
        operation_id="retrieve_work_item_description_version",
        summary="Retrieve a description version",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Version with its description body")},
    )
    def get(self, request, slug, project_id, work_item_id, version_id):
        issue = self.get_work_item(slug, project_id, work_item_id)
        if issue is None:
            return self.not_found()
        version = IssueDescriptionVersion.objects.filter(issue=issue, pk=version_id).select_related("owned_by").first()
        if version is None:
            return Response({"error": "Version not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_version(version, with_body=True))
