# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import date

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueAssignee, Project, ProjectMember, State


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Filters", identifier="FLT", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def items(project, workspace, create_user):
    started = State.objects.create(name="Doing", group="started", project=project, workspace=workspace)
    backlog = State.objects.create(name="Later", group="backlog", project=project, workspace=workspace)
    parent = Issue.objects.create(name="Parent", project=project, workspace=workspace, state=backlog)
    urgent = Issue.objects.create(
        name="Urgent",
        project=project,
        workspace=workspace,
        state=started,
        priority="urgent",
        target_date=date(2026, 10, 20),
        parent=parent,
    )
    low = Issue.objects.create(name="Low", project=project, workspace=workspace, state=started, priority="low")
    IssueAssignee.objects.create(issue=urgent, assignee=create_user, project=project, workspace=workspace)
    return {"parent": parent, "urgent": urgent, "low": low}


def _list(client, workspace, project, filters):
    url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/"
    return client.get(url, {"filters": json.dumps(filters)})


def _ids(response):
    return {str(i["id"]) for i in response.data["results"]}


@pytest.mark.contract
class TestWorkItemListFilters:
    @pytest.mark.django_db
    def test_state_group_and_priority(self, api_key_client, workspace, project, items):
        response = _list(
            api_key_client,
            workspace,
            project,
            {"and": [{"state_group__in": "started"}, {"priority__in": "urgent,high"}]},
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        assert _ids(response) == {str(items["urgent"].id)}
        assert response.data["total_count"] == 1

    @pytest.mark.django_db
    def test_assignee(self, api_key_client, workspace, project, items, create_user):
        response = _list(api_key_client, workspace, project, {"assignee_id": str(create_user.id)})
        assert _ids(response) == {str(items["urgent"].id)}

    @pytest.mark.django_db
    def test_target_date_range(self, api_key_client, workspace, project, items):
        response = _list(api_key_client, workspace, project, {"target_date__range": "2026-10-01,2026-10-31"})
        assert _ids(response) == {str(items["urgent"].id)}

    @pytest.mark.django_db
    def test_parent(self, api_key_client, workspace, project, items):
        response = _list(api_key_client, workspace, project, {"parent_id": str(items["parent"].id)})
        assert _ids(response) == {str(items["urgent"].id)}

    @pytest.mark.django_db
    def test_or_and_not(self, api_key_client, workspace, project, items):
        response = _list(
            api_key_client, workspace, project, {"or": [{"priority": "low"}, {"not": {"state_group": "started"}}]}
        )
        assert _ids(response) == {str(items["low"].id), str(items["parent"].id)}

    @pytest.mark.django_db
    def test_unknown_field_rejected(self, api_key_client, workspace, project, items):
        response = _list(api_key_client, workspace, project, {"created_by__password": "x"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_invalid_json_rejected(self, api_key_client, workspace, project, items):
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/"
        response = api_key_client.get(url, {"filters": "{not json"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_pql_still_unsupported(self, api_key_client, workspace, project):
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/"
        response = api_key_client.get(url, {"pql": "priority = urgent"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["unsupported_parameters"] == ["pql"]
