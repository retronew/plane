# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from datetime import timedelta

# Django imports
from django.db.models import Count, Q
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema

# Module imports
from plane.api.serializers import IssueActivitySerializer, IssueSerializer
from plane.api.views.base import BaseAPIView
from plane.api.views.search import visible_projects, visible_work_items
from plane.app.permissions import WorkspaceUserPermission
from plane.db.models import IssueActivity, IssueAssignee, IssueSubscriber
from plane.utils.filters import ComplexFilterBackend, IssueFilterSet
from plane.utils.openapi import WORKSPACE_SLUG_PARAMETER, create_paginated_response


MY_WORK_TYPES = ("assigned", "created", "subscribed")
OPEN_STATE_Q = ~Q(state__group__in=["completed", "cancelled"])


def my_work_docs(**kwargs):
    parameters = [WORKSPACE_SLUG_PARAMETER, *kwargs.pop("parameters", [])]
    return extend_schema(tags=["My Work"], parameters=parameters, **kwargs)


class MyWorkMixin:
    permission_classes = [WorkspaceUserPermission]
    filterset_class = IssueFilterSet

    def my_work_items(self, slug, work_type):
        user = self.request.user
        queryset = visible_work_items(slug, user)
        if work_type == "assigned":
            return queryset.filter(
                id__in=IssueAssignee.objects.filter(workspace__slug=slug, assignee=user).values("issue_id")
            )
        if work_type == "created":
            return queryset.filter(created_by=user)
        return queryset.filter(
            id__in=IssueSubscriber.objects.filter(workspace__slug=slug, subscriber=user).values("issue_id")
        )


class MyWorkItemsAPIEndpoint(MyWorkMixin, BaseAPIView):
    use_read_replica = True

    @my_work_docs(
        operation_id="list_my_work_items",
        summary="List my work items",
        description=(
            "Work items across all my projects that are assigned to me (default), created by me, or that I "
            "subscribe to, most recently updated first. Accepts the same `filters` JSON as the work item list."
        ),
        parameters=[
            OpenApiParameter(
                name="type", type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, enum=list(MY_WORK_TYPES)
            ),
            OpenApiParameter(name="filters", type=OpenApiTypes.STR, location=OpenApiParameter.QUERY),
        ],
        responses={200: create_paginated_response(IssueSerializer, "PaginatedMyWorkItemResponse")},
    )
    def get(self, request, slug):
        work_type = request.GET.get("type", "assigned")
        if work_type not in MY_WORK_TYPES:
            return Response(
                {"error": f"`type` must be one of: {', '.join(MY_WORK_TYPES)}"}, status=status.HTTP_400_BAD_REQUEST
            )
        queryset = self.my_work_items(slug, work_type)
        filter_string = request.GET.get("filters")
        if filter_string:
            queryset = ComplexFilterBackend().filter_queryset(request, queryset, self, filter_data=filter_string)
        return self.paginate(
            request=request,
            queryset=queryset.select_related("project", "state", "parent")
            .prefetch_related("assignees", "labels")
            .order_by("-updated_at", "id")
            .distinct(),
            on_results=lambda issues: IssueSerializer(issues, many=True, fields=self.fields, expand=self.expand).data,
        )


class MyWorkSummaryAPIEndpoint(MyWorkMixin, BaseAPIView):
    use_read_replica = True

    @my_work_docs(
        operation_id="get_my_work_summary",
        summary="Summarise my work",
        description=(
            "Counts of my assigned work items by state group, plus open items that are overdue or due within "
            "the next 7 days, and how many work items I created or subscribe to."
        ),
        responses={200: OpenApiResponse(description="Work summary")},
    )
    def get(self, request, slug):
        today = timezone.localdate()
        assigned = self.my_work_items(slug, "assigned")
        by_state_group = {
            row["state__group"] or "none": row["count"]
            for row in assigned.order_by().values("state__group").annotate(count=Count("id", distinct=True))
        }
        open_assigned = assigned.filter(OPEN_STATE_Q)
        return Response(
            {
                "assigned": {
                    "total": sum(by_state_group.values()),
                    "by_state_group": by_state_group,
                    "overdue": open_assigned.filter(target_date__lt=today).distinct().count(),
                    "due_next_7_days": open_assigned.filter(
                        target_date__gte=today, target_date__lte=today + timedelta(days=7)
                    )
                    .distinct()
                    .count(),
                },
                "created": self.my_work_items(slug, "created").distinct().count(),
                "subscribed": self.my_work_items(slug, "subscribed").distinct().count(),
            }
        )


class MyActivityAPIEndpoint(MyWorkMixin, BaseAPIView):
    use_read_replica = True

    @my_work_docs(
        operation_id="list_my_activity",
        summary="List my recent activity",
        description="Changes I made to work items in projects I can see, newest first.",
        responses={200: create_paginated_response(IssueActivitySerializer, "PaginatedMyActivityResponse")},
    )
    def get(self, request, slug):
        full, restricted = visible_projects(slug, request.user)
        activities = IssueActivity.objects.filter(
            workspace__slug=slug,
            actor=request.user,
        ).filter(Q(project_id__in=full) | Q(project_id__in=restricted))
        return self.paginate(
            request=request,
            queryset=activities.order_by("-created_at", "id"),
            on_results=lambda items: IssueActivitySerializer(items, many=True).data,
        )
