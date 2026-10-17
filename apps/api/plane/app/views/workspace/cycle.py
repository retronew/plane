# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Q, Count, Exists, OuterRef
from django.utils import timezone

# Third party modules
from rest_framework import status
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

# Module imports
from plane.app.views.base import BaseAPIView
from plane.db.models import Cycle, ProjectMember
from plane.app.permissions import WorkspaceViewerPermission, WorkSpaceAdminPermission
from plane.app.serializers.cycle import CycleSerializer
from plane.utils.workspace_cycles import active_cycle_statistics
from plane.utils.cycle_snapshots import snapshot_cycles, observe_cycle_progress, cycle_progress_history


def accessible_snapshot_cycles(request, slug):
    memberships = ProjectMember.objects.filter(
        project_id=OuterRef("project_id"),
        workspace__slug=slug,
        member=request.user,
        is_active=True,
        role__in=[15, 20],
    )
    return snapshot_cycles().filter(workspace__slug=slug).filter(Exists(memberships))


class WorkspaceActiveCyclesEndpoint(BaseAPIView):
    permission_classes = [WorkSpaceAdminPermission]

    def get(self, request, slug):
        # Both workspace and project membership are required, even for workspace
        # admins. Public projects do not implicitly grant access to their cycles.
        now = timezone.now()
        cycles = (
            accessible_snapshot_cycles(request, slug)
            .filter(completed_at__isnull=True, start_date__lte=now, end_date__gte=now)
            .select_related("project", "owned_by", "owned_by__avatar_asset")
            .order_by("project__name", "project_id", "start_date", "id")
        )
        # BasePaginator handles malformed cursors and upper limits; reject zero
        # and negative limits before its division/slicing operations.
        if self.get_per_page(request, 10, 25) < 1:
            raise ParseError("per_page must be positive.")

        def serialize(page):
            page = list(page)
            observed_at, current = observe_cycle_progress([cycle.id for cycle in page])
            history = cycle_progress_history(current)
            result = []
            for cycle in page:
                if cycle.id not in current:
                    continue
                data = CycleSerializer(cycle).data
                data.update(active_cycle_statistics(cycle, current[cycle.id], observed_at, history[cycle.id]))
                data["status"] = "current"
                data["project_detail"] = {
                    "id": str(cycle.project_id),
                    "name": cycle.project.name,
                    "identifier": cycle.project.identifier,
                    "logo_props": cycle.project.logo_props,
                }
                data["owned_by_detail"] = {
                    "display_name": cycle.owned_by.display_name,
                    "avatar_url": cycle.owned_by.avatar_url,
                }
                result.append(data)
            return result

        return self.paginate(
            request=request,
            queryset=cycles,
            on_results=serialize,
            default_per_page=10,
            max_per_page=25,
        )


class CycleProgressHistoryEndpoint(BaseAPIView):
    permission_classes = [WorkSpaceAdminPermission]

    def get(self, request, slug, project_id, cycle_id):
        cycle = accessible_snapshot_cycles(request, slug).filter(project_id=project_id, id=cycle_id).first()
        if cycle is None:
            return Response({"error": "Cycle not found"}, status=status.HTTP_404_NOT_FOUND)
        # Ended cycles are readable, but never fabricate a final observation.
        now, _ = observe_cycle_progress([cycle.id])
        rows = [row for row in cycle_progress_history([cycle.id])[cycle.id] if row["observed_at"] <= now]
        return Response(rows)


class WorkspaceCyclesEndpoint(BaseAPIView):
    permission_classes = [WorkspaceViewerPermission]

    def get(self, request, slug):
        cycles = (
            Cycle.objects.filter(
                workspace__slug=slug,
                project__project_projectmember__member=request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("project")
            .select_related("workspace")
            .select_related("owned_by")
            .filter(archived_at__isnull=True)
            .annotate(
                total_issues=Count(
                    "issue_cycle",
                    filter=Q(
                        issue_cycle__issue__archived_at__isnull=True,
                        issue_cycle__issue__is_draft=False,
                        issue_cycle__deleted_at__isnull=True,
                        issue_cycle__issue__deleted_at__isnull=True,
                    ),
                )
            )
            .annotate(
                completed_issues=Count(
                    "issue_cycle__issue__state__group",
                    filter=Q(
                        issue_cycle__issue__state__group="completed",
                        issue_cycle__issue__archived_at__isnull=True,
                        issue_cycle__issue__is_draft=False,
                        issue_cycle__issue__deleted_at__isnull=True,
                        issue_cycle__deleted_at__isnull=True,
                    ),
                )
            )
            .annotate(
                cancelled_issues=Count(
                    "issue_cycle__issue__state__group",
                    filter=Q(
                        issue_cycle__issue__state__group="cancelled",
                        issue_cycle__issue__archived_at__isnull=True,
                        issue_cycle__issue__is_draft=False,
                        issue_cycle__issue__deleted_at__isnull=True,
                        issue_cycle__deleted_at__isnull=True,
                    ),
                )
            )
            .annotate(
                started_issues=Count(
                    "issue_cycle__issue__state__group",
                    filter=Q(
                        issue_cycle__issue__state__group="started",
                        issue_cycle__issue__archived_at__isnull=True,
                        issue_cycle__issue__is_draft=False,
                        issue_cycle__issue__deleted_at__isnull=True,
                        issue_cycle__deleted_at__isnull=True,
                    ),
                )
            )
            .annotate(
                unstarted_issues=Count(
                    "issue_cycle__issue__state__group",
                    filter=Q(
                        issue_cycle__issue__state__group="unstarted",
                        issue_cycle__issue__archived_at__isnull=True,
                        issue_cycle__issue__is_draft=False,
                        issue_cycle__issue__deleted_at__isnull=True,
                        issue_cycle__deleted_at__isnull=True,
                    ),
                )
            )
            .annotate(
                backlog_issues=Count(
                    "issue_cycle__issue__state__group",
                    filter=Q(
                        issue_cycle__issue__state__group="backlog",
                        issue_cycle__issue__archived_at__isnull=True,
                        issue_cycle__issue__is_draft=False,
                        issue_cycle__issue__deleted_at__isnull=True,
                        issue_cycle__deleted_at__isnull=True,
                    ),
                )
            )
            .order_by(self.kwargs.get("order_by", "-created_at"))
            .distinct()
        )
        serializer = CycleSerializer(cycles, many=True).data
        return Response(serializer, status=status.HTTP_200_OK)
