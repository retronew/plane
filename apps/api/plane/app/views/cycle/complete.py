# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import CycleSerializer
from plane.utils.cycle_completion import complete_cycle
from plane.utils.timezone_converter import user_timezone_converter
from .base import CycleViewSet


class CycleCompletionRequestSerializer(serializers.Serializer):
    incomplete_action = serializers.ChoiceField(choices=["keep", "transfer"])
    target_cycle_id = serializers.UUIDField(required=False)

    def validate(self, data):
        if data["incomplete_action"] == "transfer" and not data.get("target_cycle_id"):
            raise serializers.ValidationError({"target_cycle_id": "A target cycle is required for transfer"})
        if data["incomplete_action"] == "keep" and "target_cycle_id" in data:
            raise serializers.ValidationError({"target_cycle_id": "Keep does not accept a target cycle"})
        return data


class CycleCompleteEndpoint(CycleViewSet):
    def cycle_detail(self, cycle_id):
        visible = Q(
            issue_cycle__deleted_at__isnull=True,
            issue_cycle__issue__deleted_at__isnull=True,
            issue_cycle__issue__archived_at__isnull=True,
            issue_cycle__issue__is_draft=False,
        )
        cycle = (
            self.get_queryset()
            .filter(pk=cycle_id)
            .annotate(
                **{
                    f"{group}_issues": Count(
                        "issue_cycle__issue__id",
                        distinct=True,
                        filter=visible & Q(issue_cycle__issue__state__group=group),
                    )
                    for group in ("backlog", "unstarted", "started")
                },
                sub_issues=Count(
                    "issue_cycle__issue__id",
                    distinct=True,
                    filter=visible & Q(issue_cycle__issue__parent__isnull=False),
                ),
            )
            .first()
        )
        data = dict(CycleSerializer(cycle).data)
        data.update(
            start_date=cycle.start_date,
            end_date=cycle.end_date,
            assignee_ids=cycle.assignee_ids,
            sub_issues=cycle.sub_issues,
            version=cycle.version,
            created_by=cycle.created_by_id,
            archived_at=cycle.archived_at,
        )
        return user_timezone_converter(data, ["start_date", "end_date"], cycle.project.timezone)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    @transaction.atomic
    def complete(self, request, slug, project_id, cycle_id):
        serializer = CycleCompletionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        source_id, target_id, transferred = complete_cycle(
            slug=slug,
            project_id=project_id,
            cycle_id=cycle_id,
            incomplete_action=serializer.validated_data["incomplete_action"],
            target_cycle_id=serializer.validated_data.get("target_cycle_id"),
            request=request,
        )
        return Response(
            {
                "cycle": self.cycle_detail(source_id),
                "target_cycle": self.cycle_detail(target_id) if target_id else None,
                "transferred_issues_count": transferred,
            }
        )
