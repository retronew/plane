# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Public work item relations with visibility checks on both endpoints."""

import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.api.serializers.issue import IssueRelationCreateSerializer, IssueRelationSerializer, RelatedIssueSerializer
from plane.api.views.base import BaseAPIView
from plane.api.views.search import visible_work_items
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, IssueRelation, ProjectMember, WorkspaceMember
from plane.utils.host import base_host


RELATION_PAIRS = (
    ("blocked_by", "blocking"),
    ("duplicate", "duplicate"),
    ("relates_to", "relates_to"),
    ("start_before", "start_after"),
    ("finish_before", "finish_after"),
)


class WorkItemRelationAPIEndpoint(BaseAPIView):
    # Keep reads on the primary, including the read after an idempotent mutation.
    serializer_class = IssueRelationCreateSerializer

    def visible_items(self, slug):
        if not WorkspaceMember.objects.filter(workspace__slug=slug, member=self.request.user, is_active=True).exists():
            return Issue.issue_objects.none()
        return visible_work_items(slug, self.request.user)

    def source(self, slug, project_id, issue_id, write=False):
        issue = get_object_or_404(self.visible_items(slug), pk=issue_id, project_id=project_id)
        if (
            write
            and not ProjectMember.objects.filter(
                project_id=project_id, member=self.request.user, is_active=True, role__in=[15, 20]
            ).exists()
        ):
            raise PermissionDenied()
        return issue

    def relations(self, slug, issue_id):
        visible = self.visible_items(slug).values("pk")
        return IssueRelation.objects.filter(
            Q(issue_id=issue_id) | Q(related_issue_id=issue_id),
            workspace__slug=slug,
            issue_id__in=visible,
            related_issue_id__in=visible,
        )

    def grouped(self, slug, issue_id):
        data = {key: [] for pair in RELATION_PAIRS for key in pair}
        seen = set()
        mapping = dict(RELATION_PAIRS)
        for relation in self.relations(slug, issue_id).select_related("issue", "related_issue"):
            if relation.relation_type not in mapping:
                continue
            forward = relation.issue_id == issue_id
            target = relation.related_issue if forward else relation.issue
            key = relation.relation_type if forward else mapping[relation.relation_type]
            if (key, target.id) not in seen:
                seen.add((key, target.id))
                data[key].append({"project_id": str(target.project_id), "issue_id": str(target.id)})
        return data

    def get(self, request, slug, project_id, issue_id):
        self.source(slug, project_id, issue_id)
        return Response(self.grouped(slug, issue_id))

    @transaction.atomic
    def mutate(self, request, slug, project_id, issue_id, remove=False):
        source = self.source(slug, project_id, issue_id, write=True)
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = set(serializer.validated_data["issues"])
        if source.id in ids:
            raise ValidationError({"issues": "A work item cannot relate to itself."})
        targets = list(self.visible_items(slug).filter(pk__in=ids))
        if {item.id for item in targets} != ids:
            # Deliberately indistinguishable for missing, foreign-workspace and inaccessible IDs.
            raise NotFound("Work item not found.")

        # Lock both endpoints in stable order; opposite-direction requests must serialize too.
        list(Issue.issue_objects.select_for_update(of=("self",)).filter(pk__in=ids | {source.id}).order_by("pk"))
        public_type = serializer.validated_data["relation_type"]
        mapping = {reverse: forward for forward, reverse in RELATION_PAIRS}
        actual_type = mapping.get(public_type, public_type)
        reverse = public_type in {"blocking", "start_after", "finish_after"}
        pairs = [(target.id, source.id) if reverse else (source.id, target.id) for target in targets]
        selected = Q(pk__in=[])
        for left, right in pairs:
            selected |= Q(issue_id=left, related_issue_id=right)
            if public_type in {"duplicate", "relates_to"}:
                selected |= Q(issue_id=right, related_issue_id=left)
        existing = IssueRelation.objects.filter(selected, workspace_id=source.workspace_id)
        changed_ids = set()
        if remove:
            for relation in existing.filter(relation_type=actual_type):
                changed_ids.add(relation.related_issue_id if relation.issue_id == source.id else relation.issue_id)
            existing.filter(relation_type=actual_type).delete()
        else:
            if existing.exclude(relation_type=actual_type).exists():
                raise ValidationError({"issues": "A different relation already exists for this pair."})
            for left, right in pairs:
                match = Q(issue_id=left, related_issue_id=right)
                if public_type in {"duplicate", "relates_to"}:
                    match |= Q(issue_id=right, related_issue_id=left)
                if existing.filter(match, relation_type=actual_type).exists():
                    continue
                IssueRelation.objects.create(
                    issue_id=left,
                    related_issue_id=right,
                    relation_type=actual_type,
                    project_id=project_id,
                    workspace_id=source.workspace_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
                changed_ids.add(left if reverse else right)
        if changed_ids:
            activity = {
                "type": "issue_relation.activity.deleted" if remove else "issue_relation.activity.created",
                "requested_data": json.dumps(serializer.validated_data, cls=DjangoJSONEncoder),
                "actor_id": str(request.user.id),
                "issue_id": str(issue_id),
                "project_id": str(project_id),
                "current_instance": None,
                "epoch": int(timezone.now().timestamp()),
                "notification": True,
                "origin": base_host(request=request, is_app=True),
            }
            payloads = (
                [{"relation_type": public_type, "related_issue": str(pk)} for pk in changed_ids]
                if remove
                else [{"relation_type": public_type, "issues": [str(pk) for pk in changed_ids]}]
            )
            for payload in payloads:
                event = {**activity, "requested_data": json.dumps(payload)}
                transaction.on_commit(lambda event=event: issue_activity.delay(**event))
        if remove:
            return Response(self.grouped(slug, issue_id))
        result = existing.filter(relation_type=actual_type).select_related("issue__state", "related_issue__state")
        response_serializer = RelatedIssueSerializer if reverse else IssueRelationSerializer
        return Response(response_serializer(result, many=True).data, status=201)

    def post(self, request, slug, project_id, issue_id):
        return self.mutate(request, slug, project_id, issue_id)

    def delete(self, request, slug, project_id, issue_id):
        return self.mutate(request, slug, project_id, issue_id, remove=True)
