# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiRequest, OpenApiResponse, OpenApiTypes

# Module imports
from plane.api.serializers import PageAPISerializer
from plane.api.views.base import BaseAPIView
from plane.app.permissions import ProjectPagePermission, ROLE
from plane.app.views.page.base import unarchive_archive_page_and_descendants
from plane.bgtasks.page_transaction_task import page_transaction
from plane.bgtasks.page_version_task import track_page_version
from plane.db.models import Page, Project, ProjectMember, ProjectPage, UserFavorite, UserRecentVisit
from plane.utils.openapi import DELETED_RESPONSE, create_paginated_response
from plane.utils.openapi.decorators import page_docs


PAGE_ID_PARAMETER = OpenApiParameter(
    name="page_id",
    description="Page ID",
    required=True,
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.PATH,
)


def _project_role(slug, project_id, user):
    return (
        ProjectMember.objects.filter(workspace__slug=slug, project_id=project_id, member=user, is_active=True)
        .values_list("role", flat=True)
        .first()
    )


def _can_manage(page, role, user):
    """Archive, unarchive and lock follow the web app: the owner or a project admin."""
    return page.owned_by_id == user.id or role == ROLE.ADMIN.value


class PageAPIMixin:
    def get_page_queryset(self, slug, project_id):
        queryset = (
            Page.objects.filter(
                workspace__slug=slug,
                project_pages__project_id=project_id,
                project_pages__deleted_at__isnull=True,
                projects__archived_at__isnull=True,
            )
            .filter(Q(owned_by=self.request.user) | Q(access=Page.PUBLIC_ACCESS))
            .select_related("workspace")
            .distinct()
        )
        # Guests only see their own pages unless the project opens all features to them
        role = _project_role(slug, project_id, self.request.user)
        if role == ROLE.GUEST.value:
            project = Project.objects.get(pk=project_id)
            if not project.guest_view_all_features:
                queryset = queryset.filter(owned_by=self.request.user)
        return queryset

    def get_page(self, slug, project_id, page_id):
        return self.get_page_queryset(slug, project_id).filter(pk=page_id).first()


class PageListCreateAPIEndpoint(PageAPIMixin, BaseAPIView):
    permission_classes = [ProjectPagePermission]
    use_read_replica = True

    @page_docs(
        operation_id="list_pages",
        summary="List pages",
        description="List pages in a project. Archived pages are excluded unless `archived=true`.",
        parameters=[
            OpenApiParameter(name="archived", type=OpenApiTypes.BOOL, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="search", type=OpenApiTypes.STR, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="parent", type=OpenApiTypes.UUID, location=OpenApiParameter.QUERY),
        ],
        responses={200: create_paginated_response(PageAPISerializer, "Page", "List of pages")},
    )
    def get(self, request, slug, project_id):
        queryset = self.get_page_queryset(slug, project_id)

        archived = request.query_params.get("archived", "false").lower() == "true"
        queryset = queryset.filter(archived_at__isnull=not archived)

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)

        parent = request.query_params.get("parent")
        if parent:
            queryset = queryset.filter(parent_id=parent)

        return self.paginate(
            request=request,
            queryset=queryset.order_by("-created_at", "id"),
            on_results=lambda pages: PageAPISerializer(pages, many=True, fields=self.fields).data,
        )

    @page_docs(
        operation_id="create_page",
        summary="Create a page",
        description="Create a page in a project. The body is sent as `description_html`.",
        request=OpenApiRequest(request=PageAPISerializer),
        responses={201: OpenApiResponse(description="Page created", response=PageAPISerializer)},
    )
    def post(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = PageAPISerializer(data=request.data, context={"project_id": project_id})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            page = serializer.save(
                workspace_id=project.workspace_id,
                owned_by=request.user,
                description_html=serializer.validated_data.get("description_html", "<p></p>"),
            )
            ProjectPage.objects.create(workspace_id=project.workspace_id, project_id=project_id, page_id=page.id)

        page_transaction.delay(
            new_description_html=page.description_html,
            old_description_html=None,
            page_id=page.id,
        )
        return Response(PageAPISerializer(page).data, status=status.HTTP_201_CREATED)


class PageDetailAPIEndpoint(PageAPIMixin, BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @page_docs(
        operation_id="retrieve_page",
        summary="Retrieve a page",
        description="Retrieve a page including its `description_html` body.",
        parameters=[PAGE_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Page", response=PageAPISerializer)},
    )
    def get(self, request, slug, project_id, page_id):
        page = self.get_page(slug, project_id, page_id)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(PageAPISerializer(page, fields=self.fields).data)

    @page_docs(
        operation_id="update_page",
        summary="Update a page",
        description=(
            "Update a page's name, access, parent or `description_html` body. Locked pages cannot be "
            "changed, archived pages cannot have their body changed, and only the owner can change access."
        ),
        parameters=[PAGE_ID_PARAMETER],
        request=OpenApiRequest(request=PageAPISerializer),
        responses={200: OpenApiResponse(description="Page updated", response=PageAPISerializer)},
    )
    def patch(self, request, slug, project_id, page_id):
        page = self.get_page(slug, project_id, page_id)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        if page.is_locked:
            return Response({"error": "Page is locked"}, status=status.HTTP_400_BAD_REQUEST)
        if "description_html" in request.data and page.archived_at:
            return Response({"error": "Archived pages cannot be edited"}, status=status.HTTP_400_BAD_REQUEST)
        if "access" in request.data and request.data["access"] != page.access and page.owned_by_id != request.user.id:
            return Response(
                {"error": "Access cannot be updated since this page is owned by someone else"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PageAPISerializer(page, data=request.data, partial=True, context={"project_id": project_id})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        old_description_html = page.description_html
        body_changed = (
            "description_html" in serializer.validated_data
            and serializer.validated_data["description_html"] != old_description_html
        )
        if body_changed:
            # Drop the stale collaborative state; the live server rebuilds it from the new HTML
            page = serializer.save(description_binary=None, description_json={})
            page_transaction.delay(
                new_description_html=page.description_html,
                old_description_html=old_description_html,
                page_id=page.id,
            )
            track_page_version.delay(
                page_id=page.id,
                existing_instance=json.dumps({"description_html": old_description_html}, cls=DjangoJSONEncoder),
                user_id=request.user.id,
            )
        else:
            page = serializer.save()
        return Response(PageAPISerializer(page).data)

    @page_docs(
        operation_id="delete_page",
        summary="Delete a page",
        description="Permanently delete an archived page. Only the owner or a project admin can delete.",
        parameters=[PAGE_ID_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, page_id):
        page = self.get_page(slug, project_id, page_id)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        if page.archived_at is None:
            return Response(
                {"error": "The page should be archived before deleting"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _can_manage(page, _project_role(slug, project_id, request.user), request.user):
            return Response({"error": "Only admin or owner can delete the page"}, status=status.HTTP_403_FORBIDDEN)

        Page.objects.filter(parent_id=page_id).update(parent=None)
        page.delete()
        UserFavorite.objects.filter(
            project=project_id, workspace__slug=slug, entity_identifier=page_id, entity_type="page"
        ).delete()
        UserRecentVisit.objects.filter(
            project_id=project_id, workspace__slug=slug, entity_identifier=page_id, entity_name="page"
        ).delete(soft=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageArchiveAPIEndpoint(PageAPIMixin, BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @page_docs(
        operation_id="archive_page",
        summary="Archive a page",
        description="Archive a page and all of its sub-pages. Only the owner or a project admin can archive.",
        parameters=[PAGE_ID_PARAMETER],
        request=None,
        responses={200: OpenApiResponse(description="Page archived")},
    )
    def post(self, request, slug, project_id, page_id):
        page = self.get_page(slug, project_id, page_id)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage(page, _project_role(slug, project_id, request.user), request.user):
            return Response({"error": "Only the owner or admin can archive the page"}, status=status.HTTP_403_FORBIDDEN)

        archived_at = timezone.now().date()
        UserFavorite.objects.filter(
            entity_type="page", entity_identifier=page_id, project_id=project_id, workspace__slug=slug
        ).delete()
        unarchive_archive_page_and_descendants(page_id, archived_at)
        return Response({"archived_at": archived_at.isoformat()}, status=status.HTTP_200_OK)

    @page_docs(
        operation_id="unarchive_page",
        summary="Unarchive a page",
        description="Restore an archived page and its sub-pages.",
        parameters=[PAGE_ID_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, page_id):
        page = self.get_page(slug, project_id, page_id)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage(page, _project_role(slug, project_id, request.user), request.user):
            return Response(
                {"error": "Only the owner or admin can unarchive the page"}, status=status.HTTP_403_FORBIDDEN
            )

        # Restoring under an archived parent would break the hierarchy, so detach it
        if page.parent_id and page.parent.archived_at:
            page.parent = None
            page.save(update_fields=["parent"])
        unarchive_archive_page_and_descendants(page_id, None)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageLockAPIEndpoint(PageAPIMixin, BaseAPIView):
    permission_classes = [ProjectPagePermission]

    def _set_lock(self, request, slug, project_id, page_id, is_locked):
        page = self.get_page(slug, project_id, page_id)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        page.is_locked = is_locked
        page.save(update_fields=["is_locked", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @page_docs(
        operation_id="lock_page",
        summary="Lock a page",
        description="Lock a page so nobody can edit it.",
        parameters=[PAGE_ID_PARAMETER],
        request=None,
        responses={204: OpenApiResponse(description="Page locked")},
    )
    def post(self, request, slug, project_id, page_id):
        return self._set_lock(request, slug, project_id, page_id, True)

    @page_docs(
        operation_id="unlock_page",
        summary="Unlock a page",
        description="Unlock a locked page.",
        parameters=[PAGE_ID_PARAMETER],
        responses={204: OpenApiResponse(description="Page unlocked")},
    )
    def delete(self, request, slug, project_id, page_id):
        return self._set_lock(request, slug, project_id, page_id, False)
