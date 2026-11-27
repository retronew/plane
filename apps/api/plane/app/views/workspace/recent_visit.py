# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from collections import defaultdict

# Third party imports
from rest_framework import status
from rest_framework.response import Response

from plane.db.models import Issue, IssueAssignee, Page, Project, ProjectMember, UserRecentVisit
from plane.app.serializers import WorkspaceRecentVisitSerializer

# Modules imports
from ..base import BaseViewSet
from plane.app.permissions import allow_permission, ROLE


class UserRecentVisitViewSet(BaseViewSet):
    model = UserRecentVisit
    use_read_replica = True

    def get_serializer_class(self):
        return WorkspaceRecentVisitSerializer

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        user_recent_visits = UserRecentVisit.objects.filter(workspace__slug=slug, user=request.user)

        entity_name = request.query_params.get("entity_name")

        if entity_name:
            user_recent_visits = user_recent_visits.filter(entity_name=entity_name)

        user_recent_visits = user_recent_visits.filter(entity_name__in=["issue", "page", "project"])
        visits = list(user_recent_visits[:20])

        # Batch-preload referenced entities to avoid ~60 N+1 queries on Home loads.
        issue_ids = [v.entity_identifier for v in visits if v.entity_name == "issue"]
        project_ids = [v.entity_identifier for v in visits if v.entity_name == "project"]
        page_ids = [v.entity_identifier for v in visits if v.entity_name == "page"]

        preloaded_entities = {"issue": {}, "project": {}, "page": {}}
        issue_assignees_map = defaultdict(list)
        project_members_map = defaultdict(list)

        if issue_ids:
            for issue in Issue.objects.filter(pk__in=issue_ids).select_related("project"):
                preloaded_entities["issue"][str(issue.id)] = issue
            for issue_id, assignee_id in IssueAssignee.objects.filter(
                issue_id__in=issue_ids, deleted_at__isnull=True
            ).values_list("issue_id", "assignee_id"):
                issue_assignees_map[str(issue_id)].append(assignee_id)

        if project_ids:
            for project in Project.objects.filter(pk__in=project_ids):
                preloaded_entities["project"][str(project.id)] = project
            for project_id, member_id in ProjectMember.objects.filter(
                project_id__in=project_ids, member__is_bot=False, is_active=True
            ).values_list("project_id", "member_id"):
                project_members_map[str(project_id)].append(member_id)

        if page_ids:
            for page in Page.objects.filter(pk__in=page_ids).prefetch_related("projects"):
                preloaded_entities["page"][str(page.id)] = page

        serializer = WorkspaceRecentVisitSerializer(
            visits,
            many=True,
            context={
                "preloaded_entities": preloaded_entities,
                "issue_assignees_map": issue_assignees_map,
                "project_members_map": project_members_map,
            },
        )
        return Response(serializer.data, status=status.HTTP_200_OK)
