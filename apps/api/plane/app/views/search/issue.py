# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from uuid import UUID

# Django imports
from django.db.models import IntegerField, OuterRef, Q, QuerySet, Subquery, Value
from django.db.models.functions import Coalesce

# Third party imports
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.db.models import Issue, Project, ProjectIssueType, ProjectMember, IssueRelation
from plane.services.hierarchy import hierarchy_error, hierarchy_level
from plane.utils.issue_search import search_issues
from plane.utils.workflow import normalize_issue_type


class IssueSearchEndpoint(BaseAPIView):
    def filter_issues_by_project(self, project_id: int, issues: QuerySet) -> QuerySet:
        """
        Filter issues by project
        """

        issues = issues.filter(project_id=project_id)

        return issues

    def search_issues_by_query(self, query: str, issues: QuerySet) -> QuerySet:
        """
        Search issues by query
        """

        issues = search_issues(query, issues)

        return issues

    def filter_hierarchy_candidates(self, request, slug, project_id, issues, *, children):
        project = Project.objects.filter(
            pk=project_id,
            workspace__slug=slug,
            project_projectmember__member=request.user,
            project_projectmember__is_active=True,
        ).first()
        if project is None:
            hierarchy_error("HIERARCHY_INVALID_PROJECT")
        issue_id = request.query_params.get("issue_id")
        instance = None
        if issue_id:
            try:
                issue_id = UUID(issue_id)
            except (ValueError, TypeError, AttributeError):
                hierarchy_error("HIERARCHY_INVALID_ISSUE")
            instance = Issue.issue_objects.filter(pk=issue_id, project_id=project_id, workspace__slug=slug).first()
            if instance is None:
                hierarchy_error("HIERARCHY_INVALID_ISSUE")

        attrs = {}
        if "type_id" in request.query_params:
            type_id = request.query_params["type_id"]
            if type_id == "null":
                attrs["type"] = None
            else:
                try:
                    attrs["type"] = UUID(type_id)
                except (ValueError, TypeError, AttributeError):
                    hierarchy_error("HIERARCHY_INVALID_TYPE")
        try:
            normalize_issue_type(project_id, attrs, instance=instance)
        except ValidationError:
            hierarchy_error("HIERARCHY_INVALID_TYPE")
        final_type = attrs.get("type", instance.type if instance is not None else None)
        current_level = hierarchy_level(project_id, getattr(final_type, "pk", final_type))
        issues = issues.filter(project_id=project_id)

        if instance is not None:
            # Include archived/draft ancestors and descendants: visibility must not
            # hide a path that would make the resulting relation cyclic.
            parent_by_id = dict(Issue.all_objects.filter(project_id=project_id).values_list("id", "parent_id"))
            excluded = {instance.id}
            if children:
                ancestor = instance.parent_id
                while ancestor is not None and ancestor not in excluded:
                    excluded.add(ancestor)
                    ancestor = parent_by_id.get(ancestor)
                issues = issues.filter(parent__isnull=True)
            else:
                children_by_parent = {}
                for item_id, parent_id in parent_by_id.items():
                    children_by_parent.setdefault(parent_id, []).append(item_id)
                pending = [instance.id]
                while pending:
                    for child_id in children_by_parent.get(pending.pop(), []):
                        if child_id not in excluded:
                            excluded.add(child_id)
                            pending.append(child_id)
                if instance.parent_id:
                    excluded.add(instance.parent_id)
            issues = issues.exclude(pk__in=excluded)
        elif children:
            issues = issues.filter(parent__isnull=True)

        if project.hierarchy_enabled:
            target_level = current_level - 1 if children else current_level + 1
            if target_level < 0:
                return issues.none()
            type_ids = ProjectIssueType.objects.filter(
                project_id=project_id,
                level=target_level,
                issue_type__is_active=True,
                issue_type__deleted_at__isnull=True,
            ).values("issue_type_id")
            compatible = Q(type_id__in=type_ids)
            if target_level == 0:
                compatible |= Q(type_id__isnull=True)
            issues = issues.filter(compatible)
        return issues

    def filter_issues_excluding_related_issues(self, issue_id: str, issues: QuerySet) -> QuerySet:
        """
        Filter issues excluding related issues
        """

        issue = Issue.issue_objects.filter(pk=issue_id).first()
        related_issue_ids = (
            IssueRelation.objects.filter(Q(related_issue=issue) | Q(issue=issue))
            .values_list("issue_id", "related_issue_id")
            .distinct()
        )

        related_issue_ids = [item for sublist in related_issue_ids for item in sublist]
        related_issue_ids.append(issue_id)

        if issue:
            issues = issues.exclude(pk__in=related_issue_ids)

        return issues

    def exclude_issues_in_cycles(self, issues: QuerySet) -> QuerySet:
        """
        Exclude issues in cycles
        """
        issues = issues.exclude(Q(issue_cycle__isnull=False) & Q(issue_cycle__deleted_at__isnull=True))
        return issues

    def exclude_issues_in_module(self, issues: QuerySet, module: str) -> QuerySet:
        """
        Exclude issues in a module
        """
        issues = issues.exclude(Q(issue_module__module=module) & Q(issue_module__deleted_at__isnull=True))
        return issues

    def filter_issues_without_target_date(self, issues: QuerySet) -> QuerySet:
        """
        Filter issues without a target date
        """
        issues = issues.filter(target_date__isnull=True)
        return issues

    def get(self, request, slug, project_id):
        query = request.query_params.get("search", False)
        workspace_search = request.query_params.get("workspace_search", "false")
        parent = request.query_params.get("parent", "false")
        issue_relation = request.query_params.get("issue_relation", "false")
        cycle = request.query_params.get("cycle", "false")
        module = request.query_params.get("module", False)
        sub_issue = request.query_params.get("sub_issue", "false")
        target_date = request.query_params.get("target_date", True)
        issue_id = request.query_params.get("issue_id", False)

        issues = Issue.issue_objects.filter(
            workspace__slug=slug,
            project__project_projectmember__member=self.request.user,
            project__project_projectmember__is_active=True,
            project__archived_at__isnull=True,
        )

        if workspace_search == "false":
            issues = self.filter_issues_by_project(project_id, issues)

        if query:
            issues = self.search_issues_by_query(query, issues)

        if parent == "true":
            issues = self.filter_hierarchy_candidates(request, slug, project_id, issues, children=False)

        if issue_relation == "true" and issue_id:
            issues = self.filter_issues_excluding_related_issues(issue_id, issues)

        if sub_issue == "true":
            issues = self.filter_hierarchy_candidates(request, slug, project_id, issues, children=True)

        if cycle == "true":
            issues = self.exclude_issues_in_cycles(issues)

        if module:
            issues = self.exclude_issues_in_module(issues, module)

        if target_date == "none":
            issues = self.filter_issues_without_target_date(issues)

        if ProjectMember.objects.filter(
            project_id=project_id, member=self.request.user, is_active=True, role=5
        ).exists():
            issues = issues.filter(created_by=self.request.user)

        issues = issues.annotate(
            level=Coalesce(
                Subquery(
                    ProjectIssueType.objects.filter(
                        project_id=OuterRef("project_id"), issue_type_id=OuterRef("type_id")
                    ).values("level")[:1],
                    output_field=IntegerField(),
                ),
                Value(0),
            )
        )
        return Response(
            issues.values(
                "type_id",
                "level",
                "name",
                "id",
                "start_date",
                "sequence_id",
                "project__name",
                "project__identifier",
                "project_id",
                "workspace__slug",
                "state__name",
                "state__group",
                "state__color",
            )[:100],
            status=status.HTTP_200_OK,
        )
