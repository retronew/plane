# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import APIToken, Issue, Project, ProjectMember, State, User, WorkspaceMember


@pytest.fixture(autouse=True)
def _no_activity_tasks():
    with patch("plane.api.views.work_item_lifecycle.issue_activity.delay"):
        yield


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Life", identifier="LIFE", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def states(project, workspace):
    return {
        "done": State.objects.create(name="Done", group="completed", project=project, workspace=workspace),
        "doing": State.objects.create(name="Doing", group="started", project=project, workspace=workspace),
    }


def _issue(project, name, state=None, **kwargs):
    return Issue.objects.create(name=name, project=project, workspace=project.workspace, state=state, **kwargs)


def _base(workspace, project):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/"


def _member_client(workspace, project, role, email):
    user = User.objects.create(email=email, username=email.split("@")[0])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    ProjectMember.objects.create(project=project, member=user, role=role, is_active=True)
    token = APIToken.objects.create(user=user, label="t", token=f"token-{user.username}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client


@pytest.mark.contract
class TestSubItems:
    @pytest.mark.django_db
    def test_add_list_remove(self, api_key_client, workspace, project, states):
        parent = _issue(project, "Parent", states["doing"])
        a = _issue(project, "A", states["doing"])
        b = _issue(project, "B", states["doing"])
        url = f"{_base(workspace, project)}work-items/{parent.id}/sub-items/"

        response = api_key_client.post(url, {"sub_work_item_ids": [str(a.id), str(b.id)]}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert set(Issue.objects.filter(parent=parent).values_list("id", flat=True)) == {a.id, b.id}

        response = api_key_client.get(url)
        assert {str(i["id"]) for i in response.data["results"]} == {str(a.id), str(b.id)}

        assert api_key_client.delete(f"{url}{a.id}/").status_code == status.HTTP_204_NO_CONTENT
        a.refresh_from_db()
        assert a.parent_id is None

    @pytest.mark.django_db
    def test_rejects_cycle(self, api_key_client, workspace, project, states):
        grandparent = _issue(project, "GP", states["doing"])
        parent = _issue(project, "P", states["doing"], parent=grandparent)
        url = f"{_base(workspace, project)}work-items/{parent.id}/sub-items/"

        for target in (grandparent, parent):
            response = api_key_client.post(url, {"sub_work_item_ids": [str(target.id)]}, format="json")
            assert response.status_code == status.HTTP_400_BAD_REQUEST
        grandparent.refresh_from_db()
        assert grandparent.parent_id is None

    @pytest.mark.django_db
    def test_rejects_other_project_items(self, api_key_client, workspace, project, states):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
        foreign = _issue(other, "Foreign")
        parent = _issue(project, "Parent", states["doing"])
        url = f"{_base(workspace, project)}work-items/{parent.id}/sub-items/"
        response = api_key_client.post(url, {"sub_work_item_ids": [str(foreign.id)]}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        foreign.refresh_from_db()
        assert foreign.parent_id is None

    @pytest.mark.django_db
    def test_guest_cannot_add(self, workspace, project, states):
        parent = _issue(project, "Parent", states["doing"])
        child = _issue(project, "Child", states["doing"])
        client = _member_client(workspace, project, 5, "guest@plane.so")
        url = f"{_base(workspace, project)}work-items/{parent.id}/sub-items/"
        response = client.post(url, {"sub_work_item_ids": [str(child.id)]}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
class TestArchive:
    @pytest.mark.django_db
    def test_archive_requires_done_state(self, api_key_client, workspace, project, states):
        doing = _issue(project, "Doing", states["doing"])
        response = api_key_client.post(f"{_base(workspace, project)}work-items/{doing.id}/archive/")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_archive_list_unarchive(self, api_key_client, workspace, project, states):
        done = _issue(project, "Done", states["done"])
        base = _base(workspace, project)

        assert api_key_client.post(f"{base}work-items/{done.id}/archive/").status_code == status.HTTP_200_OK
        done.refresh_from_db()
        assert done.archived_at is not None

        response = api_key_client.get(f"{base}archived-work-items/")
        assert [str(i["id"]) for i in response.data["results"]] == [str(done.id)]

        assert api_key_client.delete(f"{base}work-items/{done.id}/archive/").status_code == status.HTTP_204_NO_CONTENT
        done.refresh_from_db()
        assert done.archived_at is None


@pytest.mark.contract
class TestBulk:
    @pytest.mark.django_db
    def test_bulk_archive_is_all_or_nothing(self, api_key_client, workspace, project, states):
        done = _issue(project, "Done", states["done"])
        doing = _issue(project, "Doing", states["doing"])
        url = f"{_base(workspace, project)}work-items/bulk-archive/"

        response = api_key_client.post(url, {"work_item_ids": [str(done.id), str(doing.id)]}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["work_item_ids"] == [str(doing.id)]
        done.refresh_from_db()
        assert done.archived_at is None

        response = api_key_client.post(url, {"work_item_ids": [str(done.id)]}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1

    @pytest.mark.django_db
    def test_bulk_limit(self, api_key_client, workspace, project):
        url = f"{_base(workspace, project)}work-items/bulk-archive/"
        ids = [str(i) for i in range(101)]
        assert api_key_client.post(url, {"work_item_ids": ids}, format="json").status_code == 400

    @pytest.mark.django_db
    def test_bulk_delete_admin_only(self, api_key_client, workspace, project, states):
        a = _issue(project, "A", states["doing"])
        b = _issue(project, "B", states["doing"])
        url = f"{_base(workspace, project)}work-items/bulk-delete/"

        member = _member_client(workspace, project, 15, "member@plane.so")
        assert member.post(url, {"work_item_ids": [str(a.id)]}, format="json").status_code == 403

        response = api_key_client.post(url, {"work_item_ids": [str(a.id), str(b.id)]}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2
        assert not Issue.issue_objects.filter(pk__in=[a.id, b.id]).exists()
