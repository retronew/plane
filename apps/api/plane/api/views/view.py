# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiRequest, OpenApiResponse, OpenApiTypes

# Module imports
from plane.api.serializers import IssueSerializer, IssueViewAPISerializer
from plane.api.views.base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission, ROLE, WorkspaceEntityPermission
from plane.db.models import (
    Issue,
    IssueView,
    Project,
    ProjectMember,
    UserFavorite,
    UserRecentVisit,
    Workspace,
    WorkspaceMember,
)
from plane.utils.filters import ComplexFilterBackend, IssueFilterSet
from plane.utils.openapi import DELETED_RESPONSE, create_paginated_response
from plane.utils.openapi.decorators import view_docs, workspace_view_docs


VIEW_ID_PARAMETER = OpenApiParameter(
    name="view_id",
    description="View ID",
    required=True,
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.PATH,
)


class ViewAPIMixin:
    """Shared behaviour for project and workspace views; subclasses define ``get_view_queryset``."""

    filterset_class = IssueFilterSet

    def get_view(self, view_id):
        return self.get_view_queryset().filter(pk=view_id).first()

    def validate_rich_filters(self, rich_filters):
        """Reject filter trees the work item filter backend would not accept."""
        if rich_filters:
            ComplexFilterBackend().filter_queryset(self.request, Issue.objects.none(), self, filter_data=rich_filters)

    def is_admin(self):
        raise NotImplementedError

    def save_view(self, serializer, **kwargs):
        try:
            self.validate_rich_filters(serializer.validated_data.get("rich_filters"))
        except ValidationError as e:
            return Response({"rich_filters": e.detail}, status=status.HTTP_400_BAD_REQUEST)
        return serializer.save(**kwargs)

    def update_view(self, request, view_id):
        with transaction.atomic():
            issue_view = self.get_view_queryset().select_for_update().filter(pk=view_id).first()
            if issue_view is None:
                return Response({"error": "View not found"}, status=status.HTTP_404_NOT_FOUND)
            if issue_view.is_locked:
                return Response({"error": "View is locked"}, status=status.HTTP_400_BAD_REQUEST)
            if issue_view.owned_by_id != request.user.id:
                return Response(
                    {"error": "Only the owner of the view can update the view"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            serializer = IssueViewAPISerializer(issue_view, data=request.data, partial=True)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            result = self.save_view(serializer)
            if isinstance(result, Response):
                return result
            return Response(IssueViewAPISerializer(result).data)

    def delete_view(self, request, view_id):
        issue_view = self.get_view(view_id)
        if issue_view is None:
            return Response({"error": "View not found"}, status=status.HTTP_404_NOT_FOUND)
        if issue_view.owned_by_id != request.user.id and not self.is_admin():
            return Response({"error": "Only admin or owner can delete the view"}, status=status.HTTP_403_FORBIDDEN)

        issue_view.delete()
        UserFavorite.objects.filter(
            workspace__slug=self.kwargs["slug"], entity_identifier=view_id, entity_type="view"
        ).delete()
        UserRecentVisit.objects.filter(
            workspace__slug=self.kwargs["slug"], entity_identifier=view_id, entity_name="view"
        ).delete(soft=False)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def list_view_work_items(self, request, view_id, issue_queryset):
        issue_view = self.get_view(view_id)
        if issue_view is None:
            return Response({"error": "View not found"}, status=status.HTTP_404_NOT_FOUND)
        issue_queryset = ComplexFilterBackend().filter_queryset(
            request, issue_queryset, self, filter_data=issue_view.rich_filters or {}
        )
        return self.paginate(
            request=request,
            queryset=issue_queryset.select_related("project", "state", "parent")
            .prefetch_related("assignees", "labels")
            .order_by("-created_at", "id")
            .distinct(),
            on_results=lambda issues: IssueSerializer(issues, many=True, fields=self.fields, expand=self.expand).data,
        )


# ---------------------------------------------------------------------------
# Project views
# ---------------------------------------------------------------------------


class ProjectViewAPIMixin(ViewAPIMixin):
    permission_classes = [ProjectEntityPermission]

    def project_role(self):
        return (
            ProjectMember.objects.filter(
                workspace__slug=self.kwargs["slug"],
                project_id=self.kwargs["project_id"],
                member=self.request.user,
                is_active=True,
            )
            .values_list("role", flat=True)
            .first()
        )

    def is_admin(self):
        return self.project_role() == ROLE.ADMIN.value

    def get_view_queryset(self):
        queryset = IssueView.objects.filter(
            workspace__slug=self.kwargs["slug"],
            project_id=self.kwargs["project_id"],
            project__archived_at__isnull=True,
        ).filter(Q(owned_by=self.request.user) | Q(access=1))
        # Guests only see their own views unless the project opens all features to them
        if self.project_role() == ROLE.GUEST.value:
            project = Project.objects.get(pk=self.kwargs["project_id"])
            if not project.guest_view_all_features:
                queryset = queryset.filter(owned_by=self.request.user)
        return queryset


class ProjectViewListCreateAPIEndpoint(ProjectViewAPIMixin, BaseAPIView):
    use_read_replica = True

    @view_docs(
        operation_id="list_project_views",
        summary="List project views",
        description="List the saved work item views in a project that the user can see.",
        responses={200: create_paginated_response(IssueViewAPISerializer, "PaginatedProjectViewResponse", "List of views")},
    )
    def get(self, request, slug, project_id):
        return self.paginate(
            request=request,
            queryset=self.get_view_queryset().order_by("sort_order", "id"),
            on_results=lambda views: IssueViewAPISerializer(views, many=True, fields=self.fields).data,
        )

    @view_docs(
        operation_id="create_project_view",
        summary="Create a project view",
        description="Save a work item view with `rich_filters` and display settings.",
        request=OpenApiRequest(request=IssueViewAPISerializer),
        responses={201: OpenApiResponse(description="View created", response=IssueViewAPISerializer)},
    )
    def post(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = IssueViewAPISerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        result = self.save_view(
            serializer, project_id=project.id, workspace_id=project.workspace_id, owned_by=request.user
        )
        if isinstance(result, Response):
            return result
        return Response(IssueViewAPISerializer(result).data, status=status.HTTP_201_CREATED)


class ProjectViewDetailAPIEndpoint(ProjectViewAPIMixin, BaseAPIView):
    @view_docs(
        operation_id="retrieve_project_view",
        summary="Retrieve a project view",
        parameters=[VIEW_ID_PARAMETER],
        responses={200: OpenApiResponse(description="View", response=IssueViewAPISerializer)},
    )
    def get(self, request, slug, project_id, view_id):
        issue_view = self.get_view(view_id)
        if issue_view is None:
            return Response({"error": "View not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(IssueViewAPISerializer(issue_view, fields=self.fields).data)

    @view_docs(
        operation_id="update_project_view",
        summary="Update a project view",
        description="Only the owner can update a view; locked views cannot be changed.",
        parameters=[VIEW_ID_PARAMETER],
        request=OpenApiRequest(request=IssueViewAPISerializer),
        responses={200: OpenApiResponse(description="View updated", response=IssueViewAPISerializer)},
    )
    def patch(self, request, slug, project_id, view_id):
        return self.update_view(request, view_id)

    @view_docs(
        operation_id="delete_project_view",
        summary="Delete a project view",
        description="Only the owner or a project admin can delete a view.",
        parameters=[VIEW_ID_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, view_id):
        return self.delete_view(request, view_id)


class ProjectViewWorkItemsAPIEndpoint(ProjectViewAPIMixin, BaseAPIView):
    use_read_replica = True

    @view_docs(
        operation_id="list_project_view_work_items",
        summary="List work items in a project view",
        description="List the work items that match the view's filters.",
        parameters=[VIEW_ID_PARAMETER],
        responses={200: create_paginated_response(IssueSerializer, "PaginatedProjectViewWorkItemResponse", "Work items in the view")},
    )
    def get(self, request, slug, project_id, view_id):
        queryset = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)
        project = Project.objects.get(pk=project_id)
        if self.project_role() == ROLE.GUEST.value and not project.guest_view_all_features:
            queryset = queryset.filter(created_by=request.user)
        return self.list_view_work_items(request, view_id, queryset)


# ---------------------------------------------------------------------------
# Workspace views
# ---------------------------------------------------------------------------


class WorkspaceViewAPIMixin(ViewAPIMixin):
    permission_classes = [WorkspaceEntityPermission]

    def workspace_role(self):
        return (
            WorkspaceMember.objects.filter(
                workspace__slug=self.kwargs["slug"], member=self.request.user, is_active=True
            )
            .values_list("role", flat=True)
            .first()
        )

    def is_admin(self):
        return self.workspace_role() == ROLE.ADMIN.value

    def get_view_queryset(self):
        queryset = IssueView.objects.filter(workspace__slug=self.kwargs["slug"], project__isnull=True).filter(
            Q(owned_by=self.request.user) | Q(access=1)
        )
        if self.workspace_role() == ROLE.GUEST.value:
            queryset = queryset.filter(owned_by=self.request.user)
        return queryset


class WorkspaceViewListCreateAPIEndpoint(WorkspaceViewAPIMixin, BaseAPIView):
    use_read_replica = True

    @workspace_view_docs(
        operation_id="list_workspace_views",
        summary="List workspace views",
        description="List the saved workspace-level work item views that the user can see.",
        responses={200: create_paginated_response(IssueViewAPISerializer, "PaginatedWorkspaceViewResponse", "List of views")},
    )
    def get(self, request, slug):
        return self.paginate(
            request=request,
            queryset=self.get_view_queryset().order_by("sort_order", "id"),
            on_results=lambda views: IssueViewAPISerializer(views, many=True, fields=self.fields).data,
        )

    @workspace_view_docs(
        operation_id="create_workspace_view",
        summary="Create a workspace view",
        description="Save a workspace-level work item view across all projects the user belongs to.",
        request=OpenApiRequest(request=IssueViewAPISerializer),
        responses={201: OpenApiResponse(description="View created", response=IssueViewAPISerializer)},
    )
    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = IssueViewAPISerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        result = self.save_view(serializer, workspace_id=workspace.id, owned_by=request.user)
        if isinstance(result, Response):
            return result
        return Response(IssueViewAPISerializer(result).data, status=status.HTTP_201_CREATED)


class WorkspaceViewDetailAPIEndpoint(WorkspaceViewAPIMixin, BaseAPIView):
    @workspace_view_docs(
        operation_id="retrieve_workspace_view",
        summary="Retrieve a workspace view",
        parameters=[VIEW_ID_PARAMETER],
        responses={200: OpenApiResponse(description="View", response=IssueViewAPISerializer)},
    )
    def get(self, request, slug, view_id):
        issue_view = self.get_view(view_id)
        if issue_view is None:
            return Response({"error": "View not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(IssueViewAPISerializer(issue_view, fields=self.fields).data)

    @workspace_view_docs(
        operation_id="update_workspace_view",
        summary="Update a workspace view",
        description="Only the owner can update a view; locked views cannot be changed.",
        parameters=[VIEW_ID_PARAMETER],
        request=OpenApiRequest(request=IssueViewAPISerializer),
        responses={200: OpenApiResponse(description="View updated", response=IssueViewAPISerializer)},
    )
    def patch(self, request, slug, view_id):
        return self.update_view(request, view_id)

    @workspace_view_docs(
        operation_id="delete_workspace_view",
        summary="Delete a workspace view",
        description="Only the owner or a workspace admin can delete a view.",
        parameters=[VIEW_ID_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, view_id):
        return self.delete_view(request, view_id)


class WorkspaceViewWorkItemsAPIEndpoint(WorkspaceViewAPIMixin, BaseAPIView):
    use_read_replica = True

    @workspace_view_docs(
        operation_id="list_workspace_view_work_items",
        summary="List work items in a workspace view",
        description="List work items matching the view's filters across the projects the user is a member of.",
        parameters=[VIEW_ID_PARAMETER],
        responses={200: create_paginated_response(IssueSerializer, "PaginatedWorkspaceViewWorkItemResponse", "Work items in the view")},
    )
    def get(self, request, slug, view_id):
        memberships = ProjectMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            is_active=True,
            project__archived_at__isnull=True,
        )
        full_access_projects = memberships.filter(
            Q(role__gt=ROLE.GUEST.value) | Q(project__guest_view_all_features=True)
        ).values("project_id")
        guest_projects = memberships.filter(role=ROLE.GUEST.value, project__guest_view_all_features=False).values(
            "project_id"
        )
        queryset = Issue.issue_objects.filter(workspace__slug=slug).filter(
            Q(project_id__in=full_access_projects) | Q(project_id__in=guest_projects, created_by=request.user)
        )
        return self.list_view_work_items(request, view_id, queryset)
