# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json

# Django imports
from django.utils import timezone
from django.db.models import Q, OuterRef, UUIDField, Value, Subquery
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models.functions import Coalesce
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField

# Third Party imports
from rest_framework.response import Response
from rest_framework import status

# Module imports
from .. import BaseViewSet
from plane.app.serializers import IssueRelationSerializer, RelatedIssueSerializer
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import (
    Project,
    IssueRelation,
    Issue,
    IssueLabel,
    IssueAssignee,
)
from plane.bgtasks.issue_activities_task import issue_activity
from plane.utils.issue_relation_mapper import get_actual_relation
from plane.utils.host import base_host


class IssueRelationViewSet(BaseViewSet):
    serializer_class = IssueRelationSerializer
    model = IssueRelation
    permission_classes = [ProjectEntityPermission]

    def list(self, request, slug, project_id, issue_id):
        issue_id_str = str(issue_id)
        relation_rows = list(
            IssueRelation.objects.filter(
                Q(issue_id=issue_id) | Q(related_issue_id=issue_id),
                workspace__slug=slug,
            )
            .order_by("-created_at")
            .values("issue_id", "related_issue_id", "relation_type")
        )

        buckets = {
            "blocking": [],
            "blocked_by": [],
            "duplicate": [],
            "relates_to": [],
            "start_after": [],
            "start_before": [],
            "finish_after": [],
            "finish_before": [],
        }

        if not relation_rows:
            return Response(buckets, status=status.HTTP_200_OK)

        seen_per_bucket = {key: set() for key in buckets}
        all_related_ids = set()

        def add_to_bucket(bucket_key, target_id):
            if target_id not in seen_per_bucket[bucket_key]:
                seen_per_bucket[bucket_key].add(target_id)
                buckets[bucket_key].append(target_id)
                all_related_ids.add(target_id)

        for row in relation_rows:
            rel_type = row["relation_type"]
            src_id = row["issue_id"]
            dst_id = row["related_issue_id"]
            is_src = str(src_id) == issue_id_str
            is_dst = str(dst_id) == issue_id_str

            if rel_type == "blocked_by":
                if is_dst:
                    add_to_bucket("blocking", src_id)
                if is_src:
                    add_to_bucket("blocked_by", dst_id)
            elif rel_type == "duplicate":
                if is_src:
                    add_to_bucket("duplicate", dst_id)
                if is_dst:
                    add_to_bucket("duplicate", src_id)
            elif rel_type == "relates_to":
                if is_src:
                    add_to_bucket("relates_to", dst_id)
                if is_dst:
                    add_to_bucket("relates_to", src_id)
            elif rel_type == "start_before":
                if is_dst:
                    add_to_bucket("start_after", src_id)
                if is_src:
                    add_to_bucket("start_before", dst_id)
            elif rel_type == "finish_before":
                if is_dst:
                    add_to_bucket("finish_after", src_id)
                if is_src:
                    add_to_bucket("finish_before", dst_id)

        if not all_related_ids:
            return Response(buckets, status=status.HTTP_200_OK)

        fields = [
            "id",
            "name",
            "state_id",
            "type_id",
            "sort_order",
            "priority",
            "sequence_id",
            "project_id",
            "label_ids",
            "assignee_ids",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

        related_issues = (
            Issue.issue_objects.filter(workspace__slug=slug, pk__in=all_related_ids)
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
            )
            .values(*fields)
        )
        issues_by_id = {item["id"]: item for item in related_issues}

        response_data = {
            relation_key: [
                {**issues_by_id[target_id], "relation_type": relation_key}
                for target_id in target_ids
                if target_id in issues_by_id
            ]
            for relation_key, target_ids in buckets.items()
        }

        return Response(response_data, status=status.HTTP_200_OK)

    def create(self, request, slug, project_id, issue_id):
        relation_type = request.data.get("relation_type", None)
        if relation_type is None:
            return Response(
                {"message": "Issue relation type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issues = request.data.get("issues", [])
        project = Project.objects.get(pk=project_id)

        # Scope to workspace to prevent cross-tenant IDOR
        # Relations can cross projects so only workspace scope is enforced
        issues = list(
            Issue.issue_objects.filter(
                workspace__slug=slug,
                pk__in=issues,
            ).values_list("id", flat=True)
        )

        issue_relation = IssueRelation.objects.bulk_create(
            [
                IssueRelation(
                    issue_id=(issue if relation_type in ["blocking", "start_after", "finish_after"] else issue_id),
                    related_issue_id=(
                        issue_id if relation_type in ["blocking", "start_after", "finish_after"] else issue
                    ),
                    relation_type=(get_actual_relation(relation_type)),
                    project_id=project_id,
                    workspace_id=project.workspace_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
                for issue in issues
            ],
            batch_size=10,
            ignore_conflicts=True,
        )

        issue_activity.delay(
            type="issue_relation.activity.created",
            requested_data=json.dumps(request.data, cls=DjangoJSONEncoder),
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=None,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=request, is_app=True),
        )

        if relation_type in ["blocking", "start_after", "finish_after"]:
            return Response(
                RelatedIssueSerializer(issue_relation, many=True).data,
                status=status.HTTP_201_CREATED,
            )
        else:
            return Response(
                IssueRelationSerializer(issue_relation, many=True).data,
                status=status.HTTP_201_CREATED,
            )

    def remove_relation(self, request, slug, project_id, issue_id):
        related_issue = request.data.get("related_issue", None)

        issue_relations = IssueRelation.objects.filter(
            workspace__slug=slug,
        ).filter(
            Q(issue_id=related_issue, related_issue_id=issue_id) | Q(issue_id=issue_id, related_issue_id=related_issue)
        )
        issue_relations = issue_relations.first()
        current_instance = json.dumps(IssueRelationSerializer(issue_relations).data, cls=DjangoJSONEncoder)
        issue_relations.delete()
        issue_activity.delay(
            type="issue_relation.activity.deleted",
            requested_data=json.dumps(request.data, cls=DjangoJSONEncoder),
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=current_instance,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=request, is_app=True),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
