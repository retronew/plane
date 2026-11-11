from datetime import timedelta
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.db.models import Count, OuterRef, Subquery
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.db.models import (
    ProjectMember,
    WorkspaceMember,
    WorkspaceSyncEvent,
    Issue,
    CycleIssue,
    IssueLink,
    FileAsset,
)
from plane.app.serializers.issue import IssueListDetailSerializer
from plane.services.workspace_sync import lock_workspaces


class WorkspaceSyncAccessEndpoint(BaseAPIView):
    """Session-authenticated allowlist. Guests cannot consume project-wide events."""

    def get(self, request, slug):
        membership = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            workspace__deleted_at__isnull=True,
            member=request.user,
            is_active=True,
        ).first()
        if membership is None:
            raise PermissionDenied("Workspace access revoked")
        projects = ProjectMember.objects.filter(
            workspace_id=membership.workspace_id,
            project__workspace_id=membership.workspace_id,
            project__deleted_at__isnull=True,
            member=request.user,
            is_active=True,
            role__gte=15,
        ).values_list("project_id", flat=True)
        return Response(
            {
                "workspace_id": str(membership.workspace_id),
                "workspace_slug": slug,
                "project_ids": [str(project_id) for project_id in projects],
            }
        )


def sync_access(user, slug):
    # Authorization locks serialize concurrent revocations with response construction.
    member = (
        WorkspaceMember.objects.select_for_update(no_key=True)
        .filter(
            workspace__slug=slug,
            workspace__deleted_at__isnull=True,
            member=user,
            is_active=True,
        )
        .first()
    )
    if member is None:
        raise PermissionDenied("Workspace access revoked")
    projects = list(
        ProjectMember.objects.select_for_update(no_key=True)
        .filter(
            workspace_id=member.workspace_id,
            project__workspace_id=member.workspace_id,
            project__deleted_at__isnull=True,
            member=user,
            is_active=True,
            role__gte=15,
        )
        .values_list("project_id", flat=True)
    )
    return member.workspace_id, projects


class WorkspaceSyncChangesEndpoint(BaseAPIView):
    @transaction.atomic
    def get(self, request, slug):
        workspace_id, projects = sync_access(request.user, slug)
        # Serialize retention pruning with this replay page so no deleted rows
        # can turn a stale cursor into a false empty successful replay.
        head = lock_workspaces([workspace_id])[0]
        high = head.cursor
        floor = head.retained_from
        expired = (
            WorkspaceSyncEvent.objects.filter(
                workspace_id=workspace_id,
                created_at__lt=timezone.now() - timedelta(days=getattr(settings, "WORKSPACE_SYNC_RETENTION_DAYS", 30)),
            )
            .order_by("-cursor")
            .values_list("cursor", flat=True)
            .first()
        )
        floor = max(floor, expired or 0)
        raw = request.query_params.get("cursor", str(high))
        try:
            if not raw.isascii() or not raw.isdecimal() or len(raw) > 20:
                raise ValueError
            cursor = int(raw)
            reset = cursor < floor or cursor > high
        except (ValueError, TypeError):
            cursor, reset = high, True
        try:
            limit = int(request.query_params.get("limit", 100))
            if not 1 <= limit <= 200:
                raise ValueError
        except (ValueError, TypeError):
            raise ValidationError({"limit": "Expected an integer between 1 and 200"})
        if reset:
            return Response(
                {
                    "cursor": str(high),
                    "events": [],
                    "has_more": False,
                    "reset_required": True,
                    "project_ids": [str(p) for p in projects],
                }
            )
        rows = list(
            WorkspaceSyncEvent.objects.filter(
                workspace_id=workspace_id,
                cursor__gt=cursor,
                cursor__lte=high,
            ).order_by("cursor")[: limit + 1]
        )
        more = len(rows) > limit
        rows = rows[:limit]
        allowed = set(projects)
        events = [row.payload for row in rows if row.project_id in allowed]
        next_cursor = rows[-1].cursor if more and rows else high
        return Response(
            {
                "cursor": str(next_cursor),
                "events": events,
                "has_more": more,
                "reset_required": False,
                "project_ids": [str(p) for p in projects],
            }
        )


def _count(query):
    return Subquery(query.order_by().values("issue_id").annotate(n=Count("pk")).values("n")[:1])


class WorkspaceSyncEntitiesEndpoint(BaseAPIView):
    @transaction.atomic
    def get(self, request, slug):
        raw = request.query_params.get("ids", "").split(",")
        if not 1 <= len(raw) <= 200 or any(not value for value in raw):
            raise ValidationError({"ids": "Expected 1 to 200 comma-separated UUIDs"})
        try:
            ids = list(dict.fromkeys(UUID(value) for value in raw))
        except (ValueError, TypeError, AttributeError):
            raise ValidationError({"ids": "Invalid UUID"})
        workspace_id, projects = sync_access(request.user, slug)
        project_filter = request.query_params.get("project_ids")
        if project_filter:
            try:
                requested = {UUID(value) for value in project_filter.split(",")}
            except (ValueError, TypeError, AttributeError):
                raise ValidationError({"project_ids": "Invalid UUID"})
            projects = [project for project in projects if project in requested]
        head = lock_workspaces([workspace_id])[0]
        # Unlike the active-list manager, entities must include archived issues
        # so archive windows can reconcile their requested IDs too.
        issues = (
            Issue.objects.filter(
                workspace_id=workspace_id,
                project_id__in=projects,
                pk__in=ids,
                state__deleted_at__isnull=True,
                is_draft=False,
            )
            .annotate(
                cycle_id=Subquery(CycleIssue.objects.filter(issue=OuterRef("pk")).values("cycle_id")[:1]),
                link_count=_count(IssueLink.objects.filter(issue=OuterRef("pk"))),
                attachment_count=_count(
                    FileAsset.objects.filter(
                        issue_id=OuterRef("pk"),
                        entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                    )
                ),
                sub_issues_count=Subquery(
                    Issue.issue_objects.filter(parent=OuterRef("pk"))
                    .order_by()
                    .values("parent_id")
                    .annotate(n=Count("pk"))
                    .values("n")[:1]
                ),
            )
            .prefetch_related("issue_module", "label_issue", "issue_assignee")
        )
        data = IssueListDetailSerializer(issues, many=True).data
        found = {str(issue["id"]) for issue in data}
        return Response(
            {"issues": data, "removed_ids": [str(pk) for pk in ids if str(pk) not in found], "cursor": str(head.cursor)}
        )
