# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.response import Response
from rest_framework import status
from typing import Dict, List, Any
from django.db.models import QuerySet, Q, Count
from django.http import HttpRequest
from django.utils import timezone
from plane.app.views.base import BaseAPIView
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import (
    WorkspaceMember,
    Project,
    Issue,
    Cycle,
    Module,
    IssueView,
    ProjectPage,
    Workspace,
    ProjectMember,
)
from plane.utils.build_chart import build_analytics_chart
from plane.utils.analytics_trends import filter_trend_scope, work_item_trend
from plane.utils.date_utils import (
    get_analytics_filters,
)


class AdvanceAnalyticsBaseView(BaseAPIView):
    def initialize_workspace(self, slug: str, type: str) -> None:
        self._workspace_slug = slug
        self.filters = get_analytics_filters(
            slug=slug,
            type=type,
            user=self.request.user,
            date_filter=self.request.GET.get("date_filter", None),
            project_ids=self.request.GET.get("project_ids", None),
        )


class AdvanceAnalyticsEndpoint(AdvanceAnalyticsBaseView):
    def get_filtered_counts(self, queryset: QuerySet) -> Dict[str, int]:
        def get_filtered_count() -> int:
            if self.filters["analytics_date_range"]:
                return queryset.filter(
                    created_at__date__gte=self.filters["analytics_date_range"]["current"]["gte"].date(),
                    created_at__date__lte=self.filters["analytics_date_range"]["current"]["lte"].date(),
                ).count()
            return queryset.count()

        def get_previous_count() -> int:
            if self.filters["analytics_date_range"] and self.filters["analytics_date_range"].get("previous"):
                return queryset.filter(
                    created_at__date__gte=self.filters["analytics_date_range"]["previous"]["gte"].date(),
                    created_at__date__lte=self.filters["analytics_date_range"]["previous"]["lte"].date(),
                ).count()
            return 0

        return {
            "count": get_filtered_count(),
            # "filter_count": get_previous_count(),
        }

    def get_overview_data(self) -> Dict[str, Dict[str, int]]:
        members_query = WorkspaceMember.objects.filter(
            workspace__slug=self._workspace_slug, is_active=True, member__is_bot=False
        )

        if self.request.GET.get("project_ids", None):
            members_query = members_query.filter(
                member_id__in=ProjectMember.objects.filter(
                    project__in=Project.objects.filter(**self.filters["project_filters"]),
                    is_active=True,
                    member__is_bot=False,
                ).values("member_id")
            )

        return {
            "total_users": {"count": members_query.count()},
            "total_admins": {"count": members_query.filter(role=ROLE.ADMIN.value).count()},
            "total_members": {"count": members_query.filter(role=ROLE.MEMBER.value).count()},
            "total_guests": {"count": members_query.filter(role=ROLE.GUEST.value).count()},
            "total_projects": {"count": Project.objects.filter(**self.filters["project_filters"]).count()},
            "total_work_items": self.get_filtered_counts(Issue.issue_objects.filter(**self.filters["base_filters"])),
            "total_cycles": {"count": Cycle.objects.filter(**self.filters["base_filters"]).count()},
            "total_intake": self.get_filtered_counts(
                Issue.objects.filter(**self.filters["base_filters"]).filter(
                    issue_intake__status__in=["-2", "-1", "0", "1", "2"]  # TODO: Add description for reference.
                )
            ),
        }

    def get_work_items_stats(self) -> Dict[str, Dict[str, int]]:
        base_queryset = Issue.issue_objects.filter(**self.filters["base_filters"])

        return {
            "total_work_items": self.get_filtered_counts(base_queryset),
            "started_work_items": self.get_filtered_counts(base_queryset.filter(state__group="started")),
            "backlog_work_items": self.get_filtered_counts(base_queryset.filter(state__group="backlog")),
            "un_started_work_items": self.get_filtered_counts(base_queryset.filter(state__group="unstarted")),
            "completed_work_items": self.get_filtered_counts(base_queryset.filter(state__group="completed")),
        }

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request: HttpRequest, slug: str) -> Response:
        self.initialize_workspace(slug, type="analytics")
        tab = request.GET.get("tab", "overview")

        if tab == "overview":
            return Response(
                self.get_overview_data(),
                status=status.HTTP_200_OK,
            )
        elif tab == "work-items":
            return Response(
                self.get_work_items_stats(),
                status=status.HTTP_200_OK,
            )
        return Response({"message": "Invalid tab"}, status=status.HTTP_400_BAD_REQUEST)


class AdvanceAnalyticsStatsEndpoint(AdvanceAnalyticsBaseView):
    def get_project_issues_stats(self) -> QuerySet:
        # Get the base queryset with workspace and project filters
        base_queryset = Issue.issue_objects.filter(**self.filters["base_filters"])

        # Apply date range filter if available
        if self.filters["chart_period_range"]:
            start_date, end_date = self.filters["chart_period_range"]
            base_queryset = base_queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

        return (
            base_queryset.values("project_id", "project__name")
            .annotate(
                cancelled_work_items=Count("id", filter=Q(state__group="cancelled")),
                completed_work_items=Count("id", filter=Q(state__group="completed")),
                backlog_work_items=Count("id", filter=Q(state__group="backlog")),
                un_started_work_items=Count("id", filter=Q(state__group="unstarted")),
                started_work_items=Count("id", filter=Q(state__group="started")),
            )
            .order_by("project_id")
        )

    def get_work_items_stats(self) -> Dict[str, Dict[str, int]]:
        base_queryset = Issue.issue_objects.filter(**self.filters["base_filters"])
        if self.filters["chart_period_range"]:
            start_date, end_date = self.filters["chart_period_range"]
            base_queryset = base_queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
        return (
            base_queryset.values("project_id", "project__name")
            .annotate(
                cancelled_work_items=Count("id", filter=Q(state__group="cancelled")),
                completed_work_items=Count("id", filter=Q(state__group="completed")),
                backlog_work_items=Count("id", filter=Q(state__group="backlog")),
                un_started_work_items=Count("id", filter=Q(state__group="unstarted")),
                started_work_items=Count("id", filter=Q(state__group="started")),
            )
            .order_by("project_id")
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request: HttpRequest, slug: str) -> Response:
        self.initialize_workspace(slug, type="chart")
        type = request.GET.get("type", "work-items")

        if type == "work-items":
            return Response(
                self.get_work_items_stats(),
                status=status.HTTP_200_OK,
            )

        return Response({"message": "Invalid type"}, status=status.HTTP_400_BAD_REQUEST)


class AdvanceAnalyticsChartEndpoint(AdvanceAnalyticsBaseView):
    def project_chart(self) -> List[Dict[str, Any]]:
        # Get the base queryset with workspace and project filters
        base_queryset = Issue.issue_objects.filter(**self.filters["base_filters"])
        date_filter = {}

        # Apply date range filter if available
        if self.filters["chart_period_range"]:
            start_date, end_date = self.filters["chart_period_range"]
            date_filter = {
                "created_at__date__gte": start_date,
                "created_at__date__lte": end_date,
            }

        total_work_items = base_queryset.filter(**date_filter).count()
        total_cycles = Cycle.objects.filter(**self.filters["base_filters"], **date_filter).count()
        total_modules = Module.objects.filter(**self.filters["base_filters"], **date_filter).count()
        total_intake = Issue.objects.filter(
            issue_intake__isnull=False, **self.filters["base_filters"], **date_filter
        ).count()
        total_members = WorkspaceMember.objects.filter(
            workspace__slug=self._workspace_slug, is_active=True, member__is_bot=False, **date_filter
        ).count()
        if self.request.GET.get("project_ids"):
            total_members = WorkspaceMember.objects.filter(
                workspace__slug=self._workspace_slug,
                is_active=True,
                member__is_bot=False,
                member_id__in=ProjectMember.objects.filter(
                    project__in=Project.objects.filter(**self.filters["project_filters"]), is_active=True
                ).values("member_id"),
                **date_filter,
            ).count()
        total_pages = ProjectPage.objects.filter(**self.filters["base_filters"], **date_filter).count()
        total_views = IssueView.objects.filter(**self.filters["base_filters"], **date_filter).count()

        data = {
            "work_items": total_work_items,
            "cycles": total_cycles,
            "modules": total_modules,
            "intake": total_intake,
            "members": total_members,
            "pages": total_pages,
            "views": total_views,
        }

        return [
            {
                "key": key,
                "name": key.replace("_", " ").title(),
                "count": value or 0,
            }
            for key, value in data.items()
        ]

    def work_item_completion_chart(self) -> Dict[str, Any]:
        queryset = filter_trend_scope(Issue.issue_objects.filter(**self.filters["base_filters"]), self.request.GET)
        workspace = Workspace.objects.get(slug=self._workspace_slug)
        start, end = self.filters["chart_period_range"] or (
            timezone.localtime(workspace.created_at).date(),
            timezone.localdate(),
        )
        return work_item_trend(queryset, start, end)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request: HttpRequest, slug: str) -> Response:
        self.initialize_workspace(slug, type="chart")
        type = request.GET.get("type", "projects")
        group_by = request.GET.get("group_by", None)
        x_axis = request.GET.get("x_axis", "PRIORITY")

        if type == "projects":
            return Response(self.project_chart(), status=status.HTTP_200_OK)

        elif type == "custom-work-items":
            queryset = (
                Issue.issue_objects.filter(**self.filters["base_filters"])
                .select_related("workspace", "state", "parent")
                .prefetch_related("assignees", "labels", "issue_module__module", "issue_cycle__cycle")
            )

            # Apply date range filter if available
            if self.filters["chart_period_range"]:
                start_date, end_date = self.filters["chart_period_range"]
                queryset = queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

            return Response(
                build_analytics_chart(queryset, x_axis, group_by, y_axis=request.GET.get("y_axis", "WORK_ITEM_COUNT")),
                status=status.HTTP_200_OK,
            )

        elif type == "work-items":
            return Response(
                self.work_item_completion_chart(),
                status=status.HTTP_200_OK,
            )

        return Response({"message": "Invalid type"}, status=status.HTTP_400_BAD_REQUEST)
