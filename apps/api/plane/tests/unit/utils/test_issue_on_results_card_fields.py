# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.app.views.issue.base import IssueViewSet
from plane.db.models import Issue, Project, State, Workspace
from plane.utils.grouper import DESCRIPTION_EXCERPT_LENGTH, issue_on_results, issue_queryset_grouper


@pytest.fixture
def project(create_user):
    workspace = Workspace.objects.create(name="Cards", slug="cards", owner=create_user)
    return Project.objects.create(name="Cards", identifier="CRD", workspace=workspace, created_by=create_user)


@pytest.fixture
def states(project):
    return {
        group: State.objects.create(name=group.title(), project=project, group=group, default=group == "backlog")
        for group in ["backlog", "started", "completed", "cancelled"]
    }


def make_issue(project, state, user, **fields):
    return Issue.objects.create(
        workspace=project.workspace, project=project, state=state, created_by=user, **{"name": "Issue", **fields}
    )


def list_rows(project):
    """Rows exactly as the project list endpoint builds them for the board."""
    queryset = IssueViewSet().apply_annotations(Issue.issue_objects.filter(project=project))
    queryset = issue_queryset_grouper(queryset=queryset, group_by=None, sub_group_by=None)
    return {row["id"]: row for row in issue_on_results(issues=queryset, group_by=None, sub_group_by=None)}


@pytest.mark.unit
@pytest.mark.django_db
class TestIssueOnResultsCardFields:
    def test_rows_carry_a_short_plain_text_description_excerpt(self, project, states, create_user):
        long_text = "word " * 100
        described = make_issue(project, states["backlog"], create_user, description_html=f"<p>{long_text}</p>")
        empty = make_issue(project, states["backlog"], create_user)

        rows = list_rows(project)

        excerpt = rows[described.id]["description_excerpt"]
        assert "<p>" not in excerpt
        assert len(excerpt) == DESCRIPTION_EXCERPT_LENGTH
        assert long_text.startswith(excerpt)
        assert not rows[empty.id]["description_excerpt"]

    def test_rows_count_only_completed_sub_work_items(self, project, states, create_user):
        parent = make_issue(project, states["started"], create_user)
        for group in ["completed", "completed", "started", "cancelled"]:
            make_issue(project, states[group], create_user, parent=parent)
        childless = make_issue(project, states["backlog"], create_user)

        rows = list_rows(project)

        assert rows[parent.id]["sub_issues_count"] == 4
        assert rows[parent.id]["completed_sub_issues_count"] == 2
        assert rows[childless.id]["completed_sub_issues_count"] == 0
