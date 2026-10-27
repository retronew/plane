# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue, IssueRelation, Project, ProjectMember, State


@pytest.mark.unit
@pytest.mark.django_db
@pytest.mark.parametrize("relation_type", ["relates_to", "duplicate", "blocked_by", "blocking"])
def test_create_and_remove_relation_with_untyped_issues(session_client, workspace, create_user, mocker, relation_type):
    mocker.patch("plane.app.views.issue.relation.issue_activity.delay")
    project = Project.objects.create(name="Relations", identifier="REL", workspace=workspace)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(name="Todo", project=project, group="backlog", default=True)
    source, target = [
        Issue.objects.create(name=name, workspace=workspace, project=project, state=state, created_by=create_user)
        for name in ["Source", "Target"]
    ]
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues"
    response = session_client.post(
        f"{base}/{source.id}/issue-relation/",
        {"relation_type": relation_type, "issues": [str(target.id)]},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data[0]["id"] == str(target.id)
    assert response.data[0]["type_id"] is None
    assert IssueRelation.objects.filter(project=project).count() == 1

    # A fresh request must see the saved relation from either endpoint.
    for issue in [source, target]:
        response = session_client.get(f"{base}/{issue.id}/issue-relation/")
        assert response.status_code == 200, response.data
        assert sum(len(relations) for relations in response.data.values()) == 1

    response = session_client.post(
        f"{base}/{source.id}/remove-relation/",
        {"relation_type": relation_type, "related_issue": str(target.id)},
        format="json",
    )
    assert response.status_code == 204, response.data
    assert not IssueRelation.objects.filter(project=project).exists()
    for issue in [source, target]:
        response = session_client.get(f"{base}/{issue.id}/issue-relation/")
        assert response.status_code == 200, response.data
        assert all(len(relations) == 0 for relations in response.data.values())
