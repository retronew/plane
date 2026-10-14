# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Public API access to internal endpoints whose logic is too involved to copy.

Each class subclasses the web app's view unchanged — same queries, same role
checks — and only swaps session auth for API keys and the API rate limit, so
the two stay in sync.
"""

# Django imports
from django.db import transaction

# Third party imports
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.api.middleware.api_authentication import APIKeyAuthentication
from plane.api.rate_limit import ApiKeyRateThrottle
from plane.api.serializers import LabelSerializer
from plane.api.views.base import BaseAPIView
from plane.app.permissions import ProjectMemberPermission
from plane.app.views.cycle.base import CycleAnalyticsEndpoint, CycleDateCheckEndpoint, CycleProgressEndpoint
from plane.app.views.module.base import ModuleLinkViewSet
from plane.app.views.project.base import ProjectIdentifierEndpoint
from plane.app.views.project.member import ProjectMemberViewSet
from plane.app.views.state.base import StateViewSet
from plane.db.models import Label, Project


class APIKeyAccessMixin:
    authentication_classes = [APIKeyAuthentication]

    def get_throttles(self):
        return [ApiKeyRateThrottle()]


@extend_schema(tags=["Cycles"], summary="Cycle progress", description="Work item and estimate counts by state group.")
class CycleProgressAPIEndpoint(APIKeyAccessMixin, CycleProgressEndpoint):
    pass


@extend_schema(
    tags=["Cycles"],
    summary="Cycle analytics",
    description="Burndown (`completion_chart`) and distribution by assignee and label. `type=points` uses estimates.",
)
class CycleAnalyticsAPIEndpoint(APIKeyAccessMixin, CycleAnalyticsEndpoint):
    pass


@extend_schema(
    tags=["Cycles"],
    summary="Check cycle dates",
    description="`status: false` when another cycle in the project overlaps `start_date`–`end_date`.",
)
class CycleDateCheckAPIEndpoint(APIKeyAccessMixin, CycleDateCheckEndpoint):
    pass


@extend_schema(
    tags=["Modules"],
    summary="Module links",
    description="External links on a module. Updates must include `url` even when only the title changes.",
)
class ModuleLinkAPIViewSet(APIKeyAccessMixin, ModuleLinkViewSet):
    pass


@extend_schema(tags=["States"], summary="Mark a state as the project default")
class StateDefaultAPIViewSet(APIKeyAccessMixin, StateViewSet):
    pass


@extend_schema(tags=["Projects"], summary="Leave a project")
class ProjectLeaveAPIViewSet(APIKeyAccessMixin, ProjectMemberViewSet):
    pass


@extend_schema(
    tags=["Projects"],
    summary="Check a project identifier",
    description="`exists` > 0 when the identifier (`?name=WEB`) is already taken in the workspace.",
)
class ProjectIdentifierAPIEndpoint(APIKeyAccessMixin, ProjectIdentifierEndpoint):
    # Releasing identifiers stays in the web app
    http_method_names = ["get"]


class LabelBulkCreateAPIEndpoint(BaseAPIView):
    """Create several labels at once; names that already exist in the project are skipped."""

    permission_classes = [ProjectMemberPermission]
    MAX_LABELS = 100

    @extend_schema(
        tags=["Labels"],
        summary="Create labels in bulk",
        description=(
            "Body: `labels`, a list of `{name, color?, description?}` (at most 100). "
            "Names already used in the project (case-insensitive) are returned in `skipped`."
        ),
        responses={201: LabelSerializer(many=True)},
    )
    def post(self, request, slug, project_id):
        items = request.data.get("labels")
        if not isinstance(items, list) or not items:
            return Response({"error": "`labels` must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)
        if len(items) > self.MAX_LABELS:
            return Response(
                {"error": f"At most {self.MAX_LABELS} labels per request"}, status=status.HTTP_400_BAD_REQUEST
            )

        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        taken = {name.lower() for name in Label.objects.filter(project=project).values_list("name", flat=True)}
        created, skipped = [], []
        with transaction.atomic():
            for item in items:
                serializer = LabelSerializer(data=item if isinstance(item, dict) else {"name": item})
                if not serializer.is_valid():
                    return Response({"labels": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
                name = serializer.validated_data["name"]
                if name.lower() in taken:
                    skipped.append(name)
                    continue
                taken.add(name.lower())
                created.append(serializer.save(project_id=project.id, workspace_id=project.workspace_id))
        return Response(
            {"created": LabelSerializer(created, many=True).data, "skipped": skipped}, status=status.HTTP_201_CREATED
        )
