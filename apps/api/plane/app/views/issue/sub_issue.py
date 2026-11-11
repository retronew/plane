# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json
from functools import partial
from uuid import UUID

# Django imports
from django.utils import timezone
from django.db import transaction
from django.db.models import OuterRef, F, Value, UUIDField, Subquery, Count, IntegerField
from django.utils.decorators import method_decorator
from django.views.decorators.gzip import gzip_page
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models.functions import Coalesce
from django.db.models.expressions import RawSQL

# Third Party imports
from rest_framework.response import Response
from rest_framework import status

# Module imports
from .. import BaseAPIView
from plane.app.serializers import IssueSerializer
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Issue, IssueLink, FileAsset, CycleIssue, IssueLabel, IssueAssignee, ModuleIssue, Project
from plane.db.models.state import StateGroup
from plane.services.hierarchy import hierarchy_error, validate_hierarchy_write
from plane.bgtasks.issue_activities_task import issue_activity
from plane.utils.timezone_converter import user_timezone_converter
from collections import defaultdict
from plane.utils.host import base_host
from plane.utils.order_queryset import order_issue_queryset


def _descendant_ids(issues, issue_id):
    """Traverse only visible, scoped edges in one query, terminating on cycles.

    Compile the manager queryset rather than duplicating issue_objects visibility
    rules in SQL. UNION deduplicates IDs across iterations; excluding the root
    prevents corrupt cycles from returning the requested issue as its own child.
    """
    eligible_sql, params = issues.exclude(pk=issue_id).order_by().values("id", "parent_id").query.sql_with_params()
    return RawSQL(
        f"""
        WITH RECURSIVE eligible AS ({eligible_sql}), descendants(id) AS (
            SELECT id FROM eligible WHERE parent_id = %s
            UNION
            SELECT child.id FROM eligible child
            INNER JOIN descendants parent ON child.parent_id = parent.id
        )
        SELECT id FROM descendants
        """,
        (*params, issue_id),
        output_field=UUIDField(),
    )


class SubIssuesEndpoint(BaseAPIView):
    permission_classes = [ProjectEntityPermission]

    @method_decorator(gzip_page)
    def get(self, request, slug, project_id, issue_id):
        include_descendants = request.GET.get("include_descendants", "").lower() == "true"
        issues = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)
        # Permission checks cover the URL project, so validate the root itself as
        # well: corrupt cross-project parent edges must not expose local children.
        # Preserve legacy reads under archived/draft roots in direct-only mode.
        parents = Issue.objects.filter(workspace__slug=slug, project_id=project_id)
        if include_descendants:
            # Archived detail pages use this endpoint too. Only the root may be
            # archived; descendant traversal still uses issue_objects throughout.
            parents = parents.exclude(is_draft=True).exclude(state__group=StateGroup.TRIAGE.value).exclude(
                project__archived_at__isnull=False
            )
            sub_issues = issues.filter(pk__in=_descendant_ids(issues, issue_id))
        else:
            sub_issues = issues.filter(parent_id=issue_id)
        if not parents.filter(pk=issue_id).exists():
            sub_issues = sub_issues.none()
        sub_issues = (
            sub_issues.annotate(
                cycle_id=Subquery(
                    CycleIssue.objects.filter(issue=OuterRef("id"), deleted_at__isnull=True).values("cycle_id")[:1]
                )
            )
            .annotate(
                link_count=Coalesce(
                    Subquery(
                        IssueLink.objects.filter(issue=OuterRef("id"))
                        .order_by()
                        .values("issue")
                        .annotate(count=Count("id"))
                        .values("count"),
                        output_field=IntegerField(),
                    ),
                    0,
                )
            )
            .annotate(
                attachment_count=Coalesce(
                    Subquery(
                        FileAsset.objects.filter(
                            issue_id=OuterRef("id"),
                            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                        )
                        .order_by()
                        .values("issue_id")
                        .annotate(count=Count("id"))
                        .values("count"),
                        output_field=IntegerField(),
                    ),
                    0,
                )
            )
            .annotate(
                sub_issues_count=Coalesce(
                    Subquery(
                        Issue.issue_objects.filter(parent=OuterRef("id"))
                        .order_by()
                        .values("parent")
                        .annotate(count=Count("id"))
                        .values("count"),
                        output_field=IntegerField(),
                    ),
                    0,
                )
            )
            .annotate(
                label_ids=Coalesce(
                    Subquery(
                        IssueLabel.objects.filter(issue_id=OuterRef("id"), deleted_at__isnull=True)
                        .order_by()
                        .values("issue_id")
                        .annotate(arr=ArrayAgg("label_id", distinct=True))
                        .values("arr"),
                        output_field=ArrayField(UUIDField()),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                assignee_ids=Coalesce(
                    Subquery(
                        IssueAssignee.objects.filter(
                            issue_id=OuterRef("id"),
                            assignee__member_project__is_active=True,
                            deleted_at__isnull=True,
                        )
                        .order_by()
                        .values("issue_id")
                        .annotate(arr=ArrayAgg("assignee_id", distinct=True))
                        .values("arr"),
                        output_field=ArrayField(UUIDField()),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                module_ids=Coalesce(
                    Subquery(
                        ModuleIssue.objects.filter(
                            issue_id=OuterRef("id"),
                            module__archived_at__isnull=True,
                            deleted_at__isnull=True,
                        )
                        .order_by()
                        .values("issue_id")
                        .annotate(arr=ArrayAgg("module_id", distinct=True))
                        .values("arr"),
                        output_field=ArrayField(UUIDField()),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
            )
            .annotate(state_group=F("state__group"))
        )

        # Ordering
        order_by_param = request.GET.get("order_by", "-created_at")
        group_by = request.GET.get("group_by", False)

        if order_by_param:
            sub_issues, order_by_param = order_issue_queryset(sub_issues, order_by_param)

        sub_issues = list(
            sub_issues.values(
                "id",
                "name",
                "state_id",
                "type_id",
                "sort_order",
                "completed_at",
                "started_at",
                "state_changed_at",
                "estimate_point",
                "priority",
                "start_date",
                "target_date",
                "sequence_id",
                "project_id",
                "parent_id",
                "cycle_id",
                "module_ids",
                "label_ids",
                "assignee_ids",
                "sub_issues_count",
                "created_at",
                "updated_at",
                "created_by",
                "updated_by",
                "attachment_count",
                "link_count",
                "is_draft",
                "archived_at",
                "state_group",
            )
        )

        # Progress always reflects direct children, even when displaying all descendants.
        result = defaultdict(list)
        for sub_issue in sub_issues:
            if str(sub_issue["parent_id"]) == str(issue_id):
                result[sub_issue["state_group"]].append(str(sub_issue["id"]))

        datetime_fields = ["created_at", "updated_at"]
        sub_issues = user_timezone_converter(sub_issues, datetime_fields, request.user.user_timezone)
        # Grouping
        if group_by:
            result_dict = defaultdict(list)

            for issue in sub_issues:
                if group_by == "assignees__ids":
                    if issue["assignee_ids"]:
                        assignee_ids = issue["assignee_ids"]
                        for assignee_id in assignee_ids:
                            result_dict[str(assignee_id)].append(issue)
                    elif issue["assignee_ids"] == []:
                        result_dict["None"].append(issue)

                elif group_by:
                    result_dict[str(issue[group_by])].append(issue)

            return Response(
                {"sub_issues": result_dict, "state_distribution": result},
                status=status.HTTP_200_OK,
            )
        return Response(
            {"sub_issues": sub_issues, "state_distribution": result},
            status=status.HTTP_200_OK,
        )

    # Assign multiple sub issues
    def post(self, request, slug, project_id, issue_id):
        sub_issue_ids = request.data.get("sub_issue_ids", [])
        if not isinstance(sub_issue_ids, list) or not sub_issue_ids:
            return Response(
                {"error": "Sub Issue IDs are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            sub_issue_ids = {UUID(str(value)) for value in sub_issue_ids}
        except (ValueError, TypeError, AttributeError):
            hierarchy_error("HIERARCHY_INVALID_ISSUE")

        with transaction.atomic():
            # Serialize relation writes and policy changes in the same lock order.
            project = Project.objects.select_for_update().filter(pk=project_id, workspace__slug=slug).first()
            if project is None:
                return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
            locked_issues = list(
                Issue.issue_objects.select_for_update(of=("self",))
                .filter(pk__in=sub_issue_ids | {UUID(str(issue_id))}, workspace__slug=slug, project_id=project_id)
                .order_by("id")
            )
            issues_by_id = {item.id: item for item in locked_issues}
            parent_issue = issues_by_id.get(UUID(str(issue_id)))
            if parent_issue is None:
                return Response({"error": "Parent issue not found"}, status=status.HTTP_404_NOT_FOUND)
            if not sub_issue_ids.issubset(issues_by_id):
                hierarchy_error("HIERARCHY_INVALID_ISSUE")
            sub_issues = [issues_by_id[item_id] for item_id in sorted(sub_issue_ids)]
            previous_parents = {item.id: item.parent_id for item in sub_issues}
            # Validate every edge before changing any instance or writing any rows.
            for item in sub_issues:
                validate_hierarchy_write(project_id, {"type": item.type, "parent": parent_issue}, instance=item)
            for item in sub_issues:
                item.parent = parent_issue
            Issue.objects.bulk_update(sub_issues, ["parent"], batch_size=10)
            for item in sub_issues:
                if previous_parents[item.id] != parent_issue.id:
                    transaction.on_commit(
                        partial(
                            issue_activity.delay,
                            type="issue.activity.updated",
                            requested_data=json.dumps({"parent": str(parent_issue.id)}),
                            actor_id=str(request.user.id),
                            issue_id=str(item.id),
                            project_id=str(project_id),
                            current_instance=json.dumps(
                                {"parent": str(previous_parents[item.id]) if previous_parents[item.id] else None}
                            ),
                            epoch=int(timezone.now().timestamp()),
                            notification=True,
                            origin=base_host(request=request, is_app=True),
                        )
                    )

        scoped_sub_issue_ids = [str(sub_issue.id) for sub_issue in sub_issues]

        updated_sub_issues = Issue.issue_objects.filter(
            id__in=scoped_sub_issue_ids, workspace__slug=slug, project_id=project_id
        ).annotate(state_group=F("state__group"))

        # create's a dict with state group name with their respective issue id's
        result = defaultdict(list)
        for sub_issue in updated_sub_issues:
            result[sub_issue.state_group].append(str(sub_issue.id))

        serializer = IssueSerializer(updated_sub_issues, many=True)
        return Response(
            {"sub_issues": serializer.data, "state_distribution": result},
            status=status.HTTP_200_OK,
        )
