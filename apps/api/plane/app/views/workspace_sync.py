from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.db.models import ProjectMember, WorkspaceMember


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
