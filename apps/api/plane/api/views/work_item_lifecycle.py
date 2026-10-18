# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json
from functools import partial
from uuid import UUID

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiRequest, OpenApiResponse, OpenApiTypes

# Module imports
from plane.api.serializers import IssueSerializer
from plane.app.serializers import IssueSerializer as IssueActivitySerializer
from plane.api.views.base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission, ROLE
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import CycleIssue, Issue, ModuleIssue, Project, ProjectMember
from plane.services.hierarchy import hierarchy_error, validate_hierarchy_write
from plane.utils.host import base_host
from plane.utils.openapi import DELETED_RESPONSE, create_paginated_response
from plane.utils.openapi.decorators import work_item_docs


# Upper bound on ids accepted by a single bulk request
MAX_BULK_ITEMS = 100
ARCHIVABLE_STATE_GROUPS = ("completed", "cancelled")

WORK_ITEM_ID_PARAMETER = OpenApiParameter(
    name="work_item_id",
    description="Work item ID",
    required=True,
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.PATH,
)
SUB_ITEM_ID_PARAMETER = OpenApiParameter(
    name="sub_item_id",
    description="Sub work item ID",
    required=True,
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.PATH,
)


def _id_list(request, key):
    """Return the request's id list, or an error Response when it is missing or too long."""
    ids = request.data.get(key)
    if not isinstance(ids, list) or not ids:
        return None, Response({"error": f"`{key}` must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)
    if len(ids) > MAX_BULK_ITEMS:
        return None, Response(
            {"error": f"At most {MAX_BULK_ITEMS} ids can be sent at once"}, status=status.HTTP_400_BAD_REQUEST
        )
    return ids, None


class WorkItemLifecycleMixin:
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

    def restrict_for_guest(self, queryset):
        """Guests see only what they created unless the project opens all features to them."""
        if self.project_role() == ROLE.GUEST.value:
            project = Project.objects.get(pk=self.kwargs["project_id"])
            if not project.guest_view_all_features:
                return queryset.filter(created_by=self.request.user)
        return queryset

    def record_update(self, issue, requested_data, current_instance):
        issue_activity.delay(
            type="issue.activity.updated",
            requested_data=json.dumps(requested_data, cls=DjangoJSONEncoder),
            actor_id=str(self.request.user.id),
            issue_id=str(issue.id),
            project_id=str(issue.project_id),
            current_instance=json.dumps(current_instance, cls=DjangoJSONEncoder),
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=self.request, is_app=True),
        )

    def serialize(self, issues, many=True):
        return IssueSerializer(issues, many=many, fields=self.fields, expand=self.expand).data


class WorkItemSubItemsAPIEndpoint(WorkItemLifecycleMixin, BaseAPIView):
    use_read_replica = True

    def get_parent(self, slug, project_id, work_item_id):
        return Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id, pk=work_item_id).first()

    @work_item_docs(
        operation_id="list_sub_work_items",
        summary="List sub work items",
        description="List the direct sub work items of a work item.",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={200: create_paginated_response(IssueSerializer, "PaginatedSubWorkItemResponse", "Sub work items")},
    )
    def get(self, request, slug, project_id, work_item_id):
        if self.get_parent(slug, project_id, work_item_id) is None:
            return Response({"error": "Work item not found"}, status=status.HTTP_404_NOT_FOUND)
        queryset = self.restrict_for_guest(
            Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id, parent_id=work_item_id)
        )
        return self.paginate(
            request=request,
            queryset=queryset.select_related("state").prefetch_related("assignees", "labels").order_by("sequence_id"),
            on_results=self.serialize,
        )

    @work_item_docs(
        operation_id="add_sub_work_items",
        summary="Add sub work items",
        description=(
            "Make the given work items (same project) children of this work item. "
            "A work item cannot become a child of itself or of one of its own descendants."
        ),
        parameters=[WORK_ITEM_ID_PARAMETER],
        request=OpenApiRequest(
            request={
                "type": "object",
                "properties": {"sub_work_item_ids": {"type": "array", "items": {"type": "string"}}},
            }
        ),
        responses={200: OpenApiResponse(description="Updated sub work items", response=IssueSerializer(many=True))},
    )
    def post(self, request, slug, project_id, work_item_id):
        ids, error = _id_list(request, "sub_work_item_ids")
        if error:
            return error
        try:
            ids = {UUID(str(value)) for value in ids}
        except (ValueError, TypeError, AttributeError):
            hierarchy_error("HIERARCHY_INVALID_ISSUE")

        with transaction.atomic():
            project = Project.objects.select_for_update().filter(pk=project_id, workspace__slug=slug).first()
            if project is None:
                return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
            locked_items = list(
                Issue.issue_objects.select_for_update(of=("self",))
                .filter(workspace__slug=slug, project_id=project_id, pk__in=ids | {UUID(str(work_item_id))})
                .order_by("id")
            )
            items_by_id = {item.id: item for item in locked_items}
            parent = items_by_id.get(UUID(str(work_item_id)))
            if parent is None:
                return Response({"error": "Work item not found"}, status=status.HTTP_404_NOT_FOUND)
            if not ids.issubset(items_by_id):
                hierarchy_error("HIERARCHY_INVALID_ISSUE")
            sub_items = [items_by_id[item_id] for item_id in sorted(ids)]
            previous_parents = {item.id: item.parent_id for item in sub_items}
            for item in sub_items:
                validate_hierarchy_write(project_id, {"type": item.type, "parent": parent}, instance=item)
            for item in sub_items:
                item.parent = parent
            Issue.objects.bulk_update(sub_items, ["parent"], batch_size=50)
            for item in sub_items:
                if previous_parents[item.id] != parent.id:
                    transaction.on_commit(
                        partial(
                            self.record_update,
                            item,
                            {"parent": str(parent.id)},
                            {"parent": str(previous_parents[item.id]) if previous_parents[item.id] else None},
                        )
                    )
        return Response(self.serialize(sub_items), status=status.HTTP_200_OK)


class WorkItemSubItemDetailAPIEndpoint(WorkItemLifecycleMixin, BaseAPIView):
    @work_item_docs(
        operation_id="remove_sub_work_item",
        summary="Remove a sub work item",
        description="Detach a sub work item from its parent. The sub work item itself is kept.",
        parameters=[WORK_ITEM_ID_PARAMETER, SUB_ITEM_ID_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, work_item_id, sub_item_id):
        with transaction.atomic():
            project = Project.objects.select_for_update().filter(pk=project_id, workspace__slug=slug).first()
            if project is None:
                return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
            sub_item = (
                Issue.issue_objects.select_for_update(of=("self",))
                .filter(workspace__slug=slug, project_id=project_id, pk=sub_item_id, parent_id=work_item_id)
                .first()
            )
            if sub_item is None:
                return Response({"error": "Sub work item not found"}, status=status.HTTP_404_NOT_FOUND)
            sub_item.parent = None
            sub_item.save(update_fields=["parent", "updated_at"])
            transaction.on_commit(
                partial(self.record_update, sub_item, {"parent": None}, {"parent": str(work_item_id)})
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkItemArchiveAPIEndpoint(WorkItemLifecycleMixin, BaseAPIView):
    @work_item_docs(
        operation_id="archive_work_item",
        summary="Archive a work item",
        description="Archive a work item. Only work items in a completed or cancelled state can be archived.",
        parameters=[WORK_ITEM_ID_PARAMETER],
        request=None,
        responses={200: OpenApiResponse(description="Work item archived")},
    )
    def post(self, request, slug, project_id, work_item_id):
        issue = (
            Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id, pk=work_item_id)
            .select_related("state")
            .first()
        )
        if issue is None:
            return Response({"error": "Work item not found"}, status=status.HTTP_404_NOT_FOUND)
        if issue.state is None or issue.state.group not in ARCHIVABLE_STATE_GROUPS:
            return Response(
                {"error": "Only work items in a completed or cancelled state can be archived"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        archived_at = timezone.now().date()
        self.record_update(
            issue, {"archived_at": str(archived_at), "automation": False}, IssueActivitySerializer(issue).data
        )
        issue.archived_at = archived_at
        issue.save(update_fields=["archived_at", "updated_at"])
        return Response({"archived_at": str(archived_at)}, status=status.HTTP_200_OK)

    @work_item_docs(
        operation_id="unarchive_work_item",
        summary="Unarchive a work item",
        description="Restore an archived work item.",
        parameters=[WORK_ITEM_ID_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, work_item_id):
        issue = Issue.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=work_item_id, archived_at__isnull=False
        ).first()
        if issue is None:
            return Response({"error": "Archived work item not found"}, status=status.HTTP_404_NOT_FOUND)
        self.record_update(issue, {"archived_at": None}, IssueActivitySerializer(issue).data)
        issue.archived_at = None
        issue.save(update_fields=["archived_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ArchivedWorkItemListAPIEndpoint(WorkItemLifecycleMixin, BaseAPIView):
    use_read_replica = True

    @work_item_docs(
        operation_id="list_archived_work_items",
        summary="List archived work items",
        description="List the archived work items in a project, most recently archived first.",
        responses={
            200: create_paginated_response(IssueSerializer, "PaginatedArchivedWorkItemResponse", "Archived work items")
        },
    )
    def get(self, request, slug, project_id):
        queryset = self.restrict_for_guest(
            Issue.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                archived_at__isnull=False,
                is_draft=False,
            )
        )
        return self.paginate(
            request=request,
            queryset=queryset.select_related("state")
            .prefetch_related("assignees", "labels")
            .order_by("-archived_at", "-sequence_id"),
            on_results=self.serialize,
        )


class WorkItemBulkArchiveAPIEndpoint(WorkItemLifecycleMixin, BaseAPIView):
    @work_item_docs(
        operation_id="bulk_archive_work_items",
        summary="Archive work items in bulk",
        description=(
            f"Archive up to {MAX_BULK_ITEMS} work items. All of them must be in a completed or cancelled state; "
            "if any is not, nothing is archived."
        ),
        request=OpenApiRequest(
            request={"type": "object", "properties": {"work_item_ids": {"type": "array", "items": {"type": "string"}}}}
        ),
        responses={200: OpenApiResponse(description="Work items archived")},
    )
    def post(self, request, slug, project_id):
        ids, error = _id_list(request, "work_item_ids")
        if error:
            return error
        issues = list(
            Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id, pk__in=ids).select_related("state")
        )
        if len(issues) != len(set(map(str, ids))):
            return Response(
                {"error": "Some work items were not found in this project"}, status=status.HTTP_400_BAD_REQUEST
            )
        not_archivable = [str(i.id) for i in issues if i.state is None or i.state.group not in ARCHIVABLE_STATE_GROUPS]
        if not_archivable:
            return Response(
                {
                    "error": "Only work items in a completed or cancelled state can be archived",
                    "work_item_ids": not_archivable,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        archived_at = timezone.now().date()
        for issue in issues:
            self.record_update(
                issue, {"archived_at": str(archived_at), "automation": False}, IssueActivitySerializer(issue).data
            )
            issue.archived_at = archived_at
        Issue.objects.bulk_update(issues, ["archived_at"], batch_size=50)
        return Response({"archived_at": str(archived_at), "count": len(issues)}, status=status.HTTP_200_OK)


class WorkItemBulkDeleteAPIEndpoint(WorkItemLifecycleMixin, BaseAPIView):
    @work_item_docs(
        operation_id="bulk_delete_work_items",
        summary="Delete work items in bulk",
        description=f"Delete up to {MAX_BULK_ITEMS} work items. Only project admins can delete in bulk.",
        request=OpenApiRequest(
            request={"type": "object", "properties": {"work_item_ids": {"type": "array", "items": {"type": "string"}}}}
        ),
        responses={200: OpenApiResponse(description="Work items deleted")},
    )
    def post(self, request, slug, project_id):
        if self.project_role() != ROLE.ADMIN.value:
            return Response(
                {"error": "Only project admins can delete work items in bulk"}, status=status.HTTP_403_FORBIDDEN
            )
        ids, error = _id_list(request, "work_item_ids")
        if error:
            return error
        issues = list(Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id, pk__in=ids))
        if len(issues) != len(set(map(str, ids))):
            return Response(
                {"error": "Some work items were not found in this project"}, status=status.HTTP_400_BAD_REQUEST
            )

        snapshots = {
            issue.id: json.dumps(IssueActivitySerializer(issue).data, cls=DjangoJSONEncoder) for issue in issues
        }
        with transaction.atomic():
            CycleIssue.objects.filter(issue__in=issues).delete()
            ModuleIssue.objects.filter(issue__in=issues).delete()
            Issue.objects.filter(pk__in=[issue.id for issue in issues]).delete()
        for issue in issues:
            issue_activity.delay(
                type="issue.activity.deleted",
                requested_data=json.dumps({"issue_id": str(issue.id)}),
                actor_id=str(request.user.id),
                issue_id=str(issue.id),
                project_id=str(project_id),
                current_instance=snapshots[issue.id],
                epoch=int(timezone.now().timestamp()),
            )
        return Response({"count": len(issues)}, status=status.HTTP_200_OK)
