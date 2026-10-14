# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re

# Django imports
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema

# Module imports
from plane.api.views.base import BaseAPIView
from plane.app.permissions import ROLE, WorkspaceUserPermission
from plane.db.models import Cycle, Issue, IssueView, Module, Page, Project, ProjectMember, WorkspaceMember
from plane.utils.openapi import WORKSPACE_SLUG_PARAMETER


SEARCH_ENTITIES = ("project", "work_item", "cycle", "module", "page", "view")
DEFAULT_LIMIT = 10
MAX_LIMIT = 50


def visible_projects(slug, user):
    """Active, unarchived project memberships of the user, split by whether they may see everything."""
    memberships = ProjectMember.objects.filter(
        workspace__slug=slug, member=user, is_active=True, project__archived_at__isnull=True
    )
    full = memberships.filter(Q(role__gt=ROLE.GUEST.value) | Q(project__guest_view_all_features=True)).values(
        "project_id"
    )
    restricted = memberships.filter(role=ROLE.GUEST.value, project__guest_view_all_features=False).values("project_id")
    return full, restricted


def visible_work_items(slug, user):
    """Work items the user can see: everything in full-access projects, their own in restricted ones."""
    full, restricted = visible_projects(slug, user)
    return Issue.issue_objects.filter(workspace__slug=slug).filter(
        Q(project_id__in=full) | Q(project_id__in=restricted, created_by=user)
    )


class WorkspaceSearchAPIEndpoint(BaseAPIView):
    permission_classes = [WorkspaceUserPermission]
    use_read_replica = True

    def search_projects(self, slug, query, project_id):
        full, restricted = visible_projects(slug, self.request.user)
        queryset = Project.objects.filter(Q(pk__in=full) | Q(pk__in=restricted)).filter(
            Q(name__icontains=query) | Q(identifier__icontains=query)
        )
        if project_id:
            queryset = queryset.filter(pk=project_id)
        return queryset.order_by("name"), lambda p: {"id": p.id, "name": p.name, "identifier": p.identifier}

    def search_work_items(self, slug, query, project_id):
        q = Q(name__icontains=query) | Q(project__identifier__icontains=query)
        # "PROJ-12" or "12" match by sequence number
        for sequence_id in re.findall(r"\b\d+\b", query):
            q |= Q(sequence_id=int(sequence_id))
        queryset = visible_work_items(slug, self.request.user).filter(q).select_related("project", "state")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset.order_by("-updated_at"), lambda i: {
            "id": i.id,
            "name": i.name,
            "identifier": f"{i.project.identifier}-{i.sequence_id}",
            "project_id": i.project_id,
            "state": i.state.name if i.state else None,
            "state_group": i.state.group if i.state else None,
            "priority": i.priority,
        }

    def _project_scoped(self, model, slug, query, project_id):
        full, restricted = visible_projects(slug, self.request.user)
        queryset = model.objects.filter(workspace__slug=slug, name__icontains=query).filter(
            Q(project_id__in=full) | Q(project_id__in=restricted)
        )
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset.order_by("-created_at"), lambda o: {"id": o.id, "name": o.name, "project_id": o.project_id}

    def search_cycles(self, slug, query, project_id):
        return self._project_scoped(Cycle, slug, query, project_id)

    def search_modules(self, slug, query, project_id):
        return self._project_scoped(Module, slug, query, project_id)

    def search_pages(self, slug, query, project_id):
        user = self.request.user
        full, restricted = visible_projects(slug, user)
        queryset = (
            Page.objects.filter(
                workspace__slug=slug,
                name__icontains=query,
                archived_at__isnull=True,
                project_pages__deleted_at__isnull=True,
            )
            # Private pages belong to their owner only, and restricted guests only see their own pages
            .filter(Q(owned_by=user) | Q(access=Page.PUBLIC_ACCESS))
            .filter(Q(project_pages__project_id__in=full) | Q(project_pages__project_id__in=restricted, owned_by=user))
        )
        if project_id:
            queryset = queryset.filter(project_pages__project_id=project_id)
        return queryset.distinct().order_by("-created_at"), lambda p: {"id": p.id, "name": p.name}

    def search_views(self, slug, query, project_id):
        user = self.request.user
        full, restricted = visible_projects(slug, user)
        queryset = (
            IssueView.objects.filter(workspace__slug=slug, name__icontains=query)
            # Views use access 1 for public; private views belong to their owner only
            .filter(Q(owned_by=user) | Q(access=1))
            .filter(Q(project_id__in=full) | Q(project_id__in=restricted, owned_by=user) | Q(project__isnull=True))
        )
        # Workspace guests only see their own workspace-level views
        is_workspace_guest = WorkspaceMember.objects.filter(
            workspace__slug=slug, member=user, is_active=True, role=ROLE.GUEST.value
        ).exists()
        if is_workspace_guest:
            queryset = queryset.exclude(Q(project__isnull=True) & ~Q(owned_by=user))
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset.order_by("-created_at"), lambda v: {"id": v.id, "name": v.name, "project_id": v.project_id}

    @extend_schema(
        operation_id="search_workspace",
        summary="Search the workspace",
        description=(
            "Search projects, work items, cycles, modules, pages and views by name. Work items also match "
            "by identifier (e.g. `PROJ-12`). Only what the requesting user can see is returned."
        ),
        tags=["Search"],
        parameters=[
            WORKSPACE_SLUG_PARAMETER,
            OpenApiParameter(name="search", type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=True),
            OpenApiParameter(
                name="entities",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description=f"Comma-separated subset of: {', '.join(SEARCH_ENTITIES)}",
            ),
            OpenApiParameter(name="project_id", type=OpenApiTypes.UUID, location=OpenApiParameter.QUERY),
            OpenApiParameter(
                name="limit",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description=f"Results per entity, default {DEFAULT_LIMIT}, at most {MAX_LIMIT}",
            ),
        ],
        responses={200: OpenApiResponse(description="Results grouped by entity")},
    )
    def get(self, request, slug):
        query = (request.GET.get("search") or "").strip()
        if not query:
            return Response({"error": "`search` is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            limit = min(max(int(request.GET.get("limit", DEFAULT_LIMIT)), 1), MAX_LIMIT)
        except ValueError:
            return Response({"error": "`limit` must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        requested = [e.strip() for e in request.GET.get("entities", "").split(",") if e.strip()]
        unknown = [e for e in requested if e not in SEARCH_ENTITIES]
        if unknown:
            return Response(
                {"error": f"Unknown entities: {', '.join(unknown)}", "allowed": list(SEARCH_ENTITIES)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project_id = request.GET.get("project_id")
        results = {}
        for entity in requested or SEARCH_ENTITIES:
            queryset, to_dict = getattr(self, f"search_{entity}s")(slug, query, project_id)
            results[entity] = [to_dict(obj) for obj in queryset[:limit]]
        return Response({"results": results})
