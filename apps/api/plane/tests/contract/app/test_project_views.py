# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import IssueView, Project, ProjectMember, User, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def project(workspace):
    return Project.objects.create(name="Views", identifier="VWS", workspace=workspace, issue_views_view=True)


def member_client(workspace, project, role, *, workspace_role=None):
    user = User.objects.create(email="view-member@example.test", username="view-member")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=workspace_role or role)
    if project is not None:
        ProjectMember.objects.create(project=project, member=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def project_url(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/views/"


@pytest.mark.parametrize("role,workspace_role", [(20, 15), (15, 15), (5, 20)])
def test_create_respects_project_views_toggle(workspace, project, role, workspace_role):
    client, owner = member_client(workspace, project, role, workspace_role=workspace_role)
    project.issue_views_view = False
    project.save(update_fields=["issue_views_view"])

    response = client.post(project_url(workspace, project), {"name": "Blocked"}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data == {"error": "Views are not enabled for this project"}
    assert not IssueView.objects.exists()

    project.issue_views_view = True
    project.save(update_fields=["issue_views_view"])
    response = client.post(project_url(workspace, project), {"name": "Allowed"}, format="json")

    assert response.status_code == status.HTTP_201_CREATED, response.data
    view = IssueView.objects.get()
    assert str(view.pk) == str(response.data["id"])
    assert view.project == project
    assert view.workspace == workspace
    assert view.owned_by == owner


@pytest.mark.parametrize("enabled", [False, True])
@pytest.mark.parametrize("membership", ["guest", "nonmember", "inactive", "wrong_workspace"])
def test_create_keeps_project_permission_scope(workspace, project, enabled, membership):
    role = 5 if membership == "guest" else 15
    member_project = None if membership == "nonmember" else project
    client, user = member_client(workspace, member_project, role)
    project.issue_views_view = enabled
    project.save(update_fields=["issue_views_view"])
    if membership == "inactive":
        ProjectMember.objects.filter(project=project, member=user).update(is_active=False)
    url = project_url(workspace, project)
    if membership == "wrong_workspace":
        url = url.replace(workspace.slug, "another-workspace")

    response = client.post(url, {"name": "Forbidden"}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert not IssueView.objects.exists()


def test_create_workspace_view_with_project_views_disabled(session_client, workspace, project, create_user):
    project.issue_views_view = False
    project.save(update_fields=["issue_views_view"])

    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/views/", {"name": "Workspace view"}, format="json"
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    view = IssueView.objects.get()
    assert str(view.pk) == str(response.data["id"])
    assert view.project is None
    assert view.workspace == workspace
    assert view.owned_by == create_user
