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


@pytest.mark.parametrize(
    "role,owns_view,allowed", [(15, True, True), (20, False, True), (15, False, False), (5, True, False)]
)
def test_lock_permissions_and_unlock(workspace, project, role, owns_view, allowed):
    client, user = member_client(workspace, project, role)
    owner = user if owns_view else User.objects.create(email="owner@example.test", username="owner")
    view = IssueView.objects.create(
        name="View", workspace=workspace, project=project, owned_by=owner, created_by=owner, access=1
    )
    url = f"{project_url(workspace, project)}{view.pk}/lock/"
    response = client.post(url)
    assert response.status_code == (204 if allowed else 403), response.data
    view.refresh_from_db()
    assert view.is_locked is allowed
    if allowed:
        response = client.delete(url)
        assert response.status_code == 204
        view.refresh_from_db()
        assert not view.is_locked


@pytest.mark.parametrize("method", ["patch", "put"])
def test_locked_view_rejects_edit_and_can_be_unlocked(workspace, project, method):
    client, owner = member_client(workspace, project, 15)
    view = IssueView.objects.create(
        name="Original", workspace=workspace, project=project, owned_by=owner, created_by=owner
    )
    url = f"{project_url(workspace, project)}{view.pk}/"
    assert client.patch(url, {"is_locked": True}, format="json").status_code == 200
    view.refresh_from_db()
    assert not view.is_locked
    assert client.post(f"{url}lock/").status_code == 204
    response = getattr(client, method)(url, {"name": "Changed", "is_locked": False}, format="json")
    assert response.status_code == 400
    view.refresh_from_db()
    assert view.name == "Original"
    assert view.is_locked
    assert client.delete(f"{url}lock/").status_code == 204
    assert client.patch(url, {"name": "Changed"}, format="json").status_code == 200


def test_lock_requires_active_project_membership(workspace, project):
    client, owner = member_client(workspace, project, 15)
    view = IssueView.objects.create(name="View", workspace=workspace, project=project, owned_by=owner, created_by=owner)
    ProjectMember.objects.filter(project=project, member=owner).update(is_active=False)
    assert client.post(f"{project_url(workspace, project)}{view.pk}/lock/").status_code == 403
    view.refresh_from_db()
    assert not view.is_locked


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
