# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.permissions import ProjectPagePermission
from plane.app.views.base import BaseAPIView
from plane.db.models import (
    FileAsset,
    Page,
    Project,
    ProjectMember,
    ProjectPage,
    UserFavorite,
    UserRecentVisit,
    WorkspaceMember,
)
from plane.settings.redis import redis_instance


class MovePageRequestSerializer(serializers.Serializer):
    new_project_id = serializers.UUIDField()


class PageMoveEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @transaction.atomic
    def post(self, request, slug, project_id, page_id):
        serializer = MovePageRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        destination_id = serializer.validated_data["new_project_id"]
        if str(destination_id) == str(project_id):
            raise ValidationError("Choose a different project.")
        source = get_object_or_404(Project, pk=project_id, workspace__slug=slug, archived_at__isnull=True)
        destination = get_object_or_404(
            Project, pk=destination_id, workspace_id=source.workspace_id, archived_at__isnull=True
        )
        if not WorkspaceMember.objects.filter(
            workspace_id=source.workspace_id, member=request.user, is_active=True, role__gte=15
        ).exists():
            raise PermissionDenied()
        source_role = (
            ProjectMember.objects.filter(
                project=source, workspace_id=source.workspace_id, member=request.user, is_active=True
            )
            .values_list("role", flat=True)
            .first()
        )
        if (
            not source_role
            or source_role < 15
            or not ProjectMember.objects.filter(
                project=destination, workspace_id=source.workspace_id, member=request.user, is_active=True, role__gte=15
            ).exists()
        ):
            raise PermissionDenied("You must be a member of both projects.")

        root = get_object_or_404(Page.objects.select_for_update(), pk=page_id, workspace_id=source.workspace_id)
        pages = [root]
        visited = {root.id}
        # Preserve the whole subtree; validate every page before modifying any relationship.
        frontier = [root.id]
        while frontier:
            children = list(Page.objects.select_for_update().filter(parent_id__in=frontier).exclude(id__in=visited))
            frontier = [page.id for page in children]
            visited.update(frontier)
            pages.extend(children)
        for page in pages:
            if page.workspace_id != source.workspace_id or (
                page.owned_by_id != request.user.id and (page.access == Page.PRIVATE_ACCESS or source_role != 20)
            ):
                raise PermissionDenied("Only the owner or a project admin can move this page.")
            if page.is_locked or page.archived_at:
                raise ValidationError("Unlock and restore the page before moving it.")
            links = list(ProjectPage.objects.select_for_update().filter(page=page))
            if len(links) != 1 or links[0].project_id != source.id:
                raise ValidationError("The page is no longer in the source project or belongs to multiple projects.")

        page_ids = [page.id for page in pages]
        ProjectPage.objects.filter(page_id__in=page_ids, project=source).update(project=destination)
        # The root becomes a top-level page; child relationships and version IDs stay intact.
        root.parent = None
        root.save(update_fields=["parent", "updated_at"])
        FileAsset.objects.filter(page_id__in=page_ids, workspace_id=source.workspace_id).update(project=destination)
        allowed_users = ProjectMember.objects.filter(project=destination, is_active=True).values_list(
            "member_id", flat=True
        )
        for page in pages:
            for model in (UserFavorite, UserRecentVisit):
                entity_filter = {"entity_type": "page"} if model is UserFavorite else {"entity_name__iexact": "page"}
                references = model.objects.filter(
                    workspace_id=source.workspace_id, entity_identifier=page.id, **entity_filter
                )
                references.exclude(user_id__in=allowed_users).delete()
                if page.access == Page.PRIVATE_ACCESS:
                    references.exclude(user_id=page.owned_by_id).delete()
                references.update(project=destination)

        # Revoke old live sessions. Failure to dispatch rolls the move back rather than leaving
        # source-project connections attached to a document with new project permissions.
        redis = redis_instance()
        for moved_id in page_ids:
            redis.publish(
                "hocuspocus:admin",
                json.dumps(
                    {
                        "command": "force_close",
                        "docId": str(moved_id),
                        "reason": "admin_request",
                        "code": 4000,
                        "originServer": "api-page-move",
                    }
                ),
            )
        return Response({"page_ids": [str(pk) for pk in page_ids], "project_id": str(destination.id)})
