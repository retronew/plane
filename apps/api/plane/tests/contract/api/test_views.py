# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    APIToken,
    Issue,
    IssueView,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Core", identifier="CORE", workspace=workspace, created_by=create_user, issue_views_view=True
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


def _client_for(workspace, project, role, email):
    user = User.objects.create(email=email, username=email.split("@")[0])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    if project is not None:
        ProjectMember.objects.create(project=project, member=user, role=role, is_active=True)
    token = APIToken.objects.create(user=user, label="t", token=f"token-{user.username}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client, user


def _view(owner, workspace, project=None, **kwargs):
    return IssueView.objects.create(
        workspace=workspace, project=project, owned_by=owner, name=kwargs.pop("name", "Mine"), **kwargs
    )


def _project_url(workspace, project, view=None, suffix=""):
    base = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/views/"
    return f"{base}{view.id}/{suffix}" if view else base


def _workspace_url(workspace, view=None, suffix=""):
    base = f"/api/v1/workspaces/{workspace.slug}/views/"
    return f"{base}{view.id}/{suffix}" if view else base


@pytest.mark.contract
class TestProjectViews:
    @pytest.mark.django_db
    def test_create_and_retrieve(self, api_key_client, workspace, project, create_user):
        payload = {"name": "In progress", "rich_filters": {"state_group__in": "started"}}
        response = api_key_client.post(_project_url(workspace, project), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        view = IssueView.objects.get(pk=response.data["id"])
        assert view.project == project
        assert view.owned_by == create_user
        assert view.rich_filters == {"state_group__in": "started"}

        response = api_key_client.get(_project_url(workspace, project, view))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "In progress"

    @pytest.mark.django_db
    @pytest.mark.parametrize("role", [20, 15])
    def test_create_respects_project_views_toggle(self, workspace, project, role):
        client, owner = _client_for(workspace, project, role, f"toggle-{role}@plane.so")
        project.issue_views_view = False
        project.save(update_fields=["issue_views_view"])

        response = client.post(_project_url(workspace, project), {"name": "Blocked"}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data == {"error": "Views are not enabled for this project"}
        assert not IssueView.objects.exists()

        project.issue_views_view = True
        project.save(update_fields=["issue_views_view"])
        response = client.post(_project_url(workspace, project), {"name": "Allowed"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED, response.data
        view = IssueView.objects.get()
        assert str(view.pk) == str(response.data["id"])
        assert view.project == project
        assert view.workspace == workspace
        assert view.owned_by == owner

    @pytest.mark.django_db
    @pytest.mark.parametrize("enabled", [False, True])
    @pytest.mark.parametrize("membership", ["guest", "nonmember", "inactive", "wrong_workspace"])
    def test_create_keeps_project_permission_scope(self, workspace, project, enabled, membership):
        role = 5 if membership == "guest" else 15
        member_project = None if membership == "nonmember" else project
        client, user = _client_for(workspace, member_project, role, f"scope-{membership}@plane.so")
        project.issue_views_view = enabled
        project.save(update_fields=["issue_views_view"])
        if membership == "inactive":
            ProjectMember.objects.filter(project=project, member=user).update(is_active=False)
        url = _project_url(workspace, project)
        if membership == "wrong_workspace":
            url = url.replace(workspace.slug, "another-workspace")

        response = client.post(url, {"name": "Forbidden"}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not IssueView.objects.exists()

    @pytest.mark.django_db
    def test_invalid_filter_field_rejected(self, api_key_client, workspace, project):
        payload = {"name": "Bad", "rich_filters": {"password__in": "x"}}
        response = api_key_client.post(_project_url(workspace, project), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not IssueView.objects.exists()

    @pytest.mark.django_db
    def test_list_hides_others_private(self, api_key_client, workspace, project, create_user):
        other = User.objects.create(email="o@plane.so", username="o")
        mine = _view(create_user, workspace, project)
        public = _view(other, workspace, project, name="Public")
        _view(other, workspace, project, name="Private", access=0)

        response = api_key_client.get(_project_url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert {str(v["id"]) for v in response.data["results"]} == {str(mine.id), str(public.id)}

    @pytest.mark.django_db
    def test_only_owner_updates(self, workspace, project, create_user):
        view = _view(create_user, workspace, project)
        client, _ = _client_for(workspace, project, 15, "member@plane.so")
        response = client.patch(_project_url(workspace, project, view), {"name": "x"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_locked_view_rejects_update(self, api_key_client, workspace, project, create_user):
        view = _view(create_user, workspace, project, is_locked=True)
        response = api_key_client.patch(_project_url(workspace, project, view), {"name": "x"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_admin_deletes_member_view(self, api_key_client, workspace, project):
        _, member = _client_for(workspace, project, 15, "m2@plane.so")
        view = _view(member, workspace, project)
        response = api_key_client.delete(_project_url(workspace, project, view))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not IssueView.objects.filter(pk=view.pk).exists()

    @pytest.mark.django_db
    def test_member_cannot_delete_others_view(self, workspace, project, create_user):
        view = _view(create_user, workspace, project)
        client, _ = _client_for(workspace, project, 15, "m3@plane.so")
        response = client.delete(_project_url(workspace, project, view))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_guest_cannot_create(self, workspace, project):
        client, _ = _client_for(workspace, project, 5, "guest@plane.so")
        response = client.post(_project_url(workspace, project), {"name": "x"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_work_items_follow_filters(self, api_key_client, workspace, project, create_user):
        started = State.objects.create(name="Doing", group="started", project=project, workspace=workspace)
        backlog = State.objects.create(name="Later", group="backlog", project=project, workspace=workspace)
        doing = Issue.objects.create(name="Doing it", project=project, workspace=workspace, state=started)
        Issue.objects.create(name="Someday", project=project, workspace=workspace, state=backlog)
        view = _view(create_user, workspace, project, rich_filters={"state_group__in": "started"})

        response = api_key_client.get(_project_url(workspace, project, view, "work-items/"))

        assert response.status_code == status.HTTP_200_OK
        assert [str(i["id"]) for i in response.data["results"]] == [str(doing.id)]


@pytest.mark.contract
class TestWorkspaceViews:
    @pytest.mark.django_db
    def test_create_with_project_views_disabled(self, api_key_client, workspace, project, create_user):
        project.issue_views_view = False
        project.save(update_fields=["issue_views_view"])

        response = api_key_client.post(_workspace_url(workspace), {"name": "Workspace view"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED, response.data
        view = IssueView.objects.get()
        assert str(view.pk) == str(response.data["id"])
        assert view.project is None
        assert view.workspace == workspace
        assert view.owned_by == create_user

    @pytest.mark.django_db
    def test_create_list_delete(self, api_key_client, workspace, project, create_user):
        response = api_key_client.post(_workspace_url(workspace), {"name": "All open"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        view = IssueView.objects.get(pk=response.data["id"])
        assert view.project is None

        # Project views do not leak into the workspace list
        _view(create_user, workspace, project, name="Project only")
        response = api_key_client.get(_workspace_url(workspace))
        assert [str(v["id"]) for v in response.data["results"]] == [str(view.id)]

        assert api_key_client.delete(_workspace_url(workspace, view)).status_code == status.HTTP_204_NO_CONTENT

    @pytest.mark.django_db
    def test_work_items_only_from_member_projects(self, api_key_client, workspace, project, create_user):
        hidden = Project.objects.create(name="Secret", identifier="SEC", workspace=workspace)
        mine = Issue.objects.create(name="Visible", project=project, workspace=workspace)
        Issue.objects.create(name="Hidden", project=hidden, workspace=workspace)
        view = _view(create_user, workspace)

        response = api_key_client.get(_workspace_url(workspace, view, "work-items/"))

        assert response.status_code == status.HTTP_200_OK
        assert [str(i["id"]) for i in response.data["results"]] == [str(mine.id)]

    @pytest.mark.django_db
    def test_workspace_guest_sees_only_own_views(self, workspace, create_user):
        _view(create_user, workspace, name="Admin view")
        client, guest = _client_for(workspace, None, 5, "wsguest@plane.so")
        own = _view(guest, workspace, name="Guest view")

        response = client.get(_workspace_url(workspace))

        assert response.status_code == status.HTTP_200_OK
        assert [str(v["id"]) for v in response.data["results"]] == [str(own.id)]
