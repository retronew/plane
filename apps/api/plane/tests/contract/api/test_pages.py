# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import APIToken, Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember


@pytest.fixture(autouse=True)
def _no_background_tasks():
    with (
        patch("plane.api.views.page.page_transaction.delay"),
        patch("plane.api.views.page.track_page_version.delay"),
    ):
        yield


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Docs", identifier="DOC", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


def _make_page(project, owner, **kwargs):
    page = Page.objects.create(
        workspace=project.workspace,
        owned_by=owner,
        name=kwargs.pop("name", "Spec"),
        description_html=kwargs.pop("description_html", "<p>old</p>"),
        **kwargs,
    )
    ProjectPage.objects.create(workspace=project.workspace, project=project, page=page)
    return page


def _member_client(workspace, project, role, email):
    user = User.objects.create(email=email, username=email.split("@")[0])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    ProjectMember.objects.create(project=project, member=user, role=role, is_active=True)
    token = APIToken.objects.create(user=user, label="t", token=f"token-{user.username}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client, user


def _url(workspace, project, page=None, suffix=""):
    base = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/"
    return f"{base}{page.id}/{suffix}" if page else base


@pytest.mark.contract
class TestPageListCreate:
    @pytest.mark.django_db
    def test_create_page(self, api_key_client, workspace, project, create_user):
        response = api_key_client.post(
            _url(workspace, project), {"name": "Roadmap", "description_html": "<p>hello</p>"}, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        page = Page.objects.get(pk=response.data["id"])
        assert page.owned_by == create_user
        assert page.description_html == "<p>hello</p>"
        assert ProjectPage.objects.filter(page=page, project=project).exists()

    @pytest.mark.django_db
    def test_list_hides_others_private_and_archived(self, api_key_client, workspace, project, create_user):
        other = User.objects.create(email="o@plane.so", username="o")
        mine = _make_page(project, create_user, name="Mine")
        _make_page(project, other, name="Private", access=Page.PRIVATE_ACCESS)
        public = _make_page(project, other, name="Public")
        archived = _make_page(project, create_user, name="Old")
        Page.objects.filter(pk=archived.pk).update(archived_at="2026-01-01")

        response = api_key_client.get(_url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert {str(p["id"]) for p in response.data["results"]} == {str(mine.id), str(public.id)}

        response = api_key_client.get(_url(workspace, project), {"archived": "true"})
        assert [str(p["id"]) for p in response.data["results"]] == [str(archived.id)]

    @pytest.mark.django_db
    def test_guest_cannot_create(self, workspace, project):
        client, _ = _member_client(workspace, project, 5, "guest@plane.so")
        response = client.post(_url(workspace, project), {"name": "x"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_non_member_cannot_list(self, workspace, project):
        user = User.objects.create(email="out@plane.so", username="out")
        token = APIToken.objects.create(user=user, label="t", token="token-out")
        client = APIClient()
        client.credentials(HTTP_X_API_KEY=token.token)
        assert client.get(_url(workspace, project)).status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
class TestPageDetail:
    @pytest.mark.django_db
    def test_retrieve_includes_body(self, api_key_client, workspace, project, create_user):
        page = _make_page(project, create_user)
        response = api_key_client.get(_url(workspace, project, page))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["description_html"] == "<p>old</p>"
        assert "description_binary" not in response.data

    @pytest.mark.django_db
    def test_body_update_clears_binary(self, api_key_client, workspace, project, create_user):
        page = _make_page(project, create_user, description_binary=b"yjs-state")

        response = api_key_client.patch(
            _url(workspace, project, page), {"description_html": "<p>new</p>"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.description_html == "<p>new</p>"
        assert page.description_binary is None

    @pytest.mark.django_db
    def test_rename_keeps_binary(self, api_key_client, workspace, project, create_user):
        page = _make_page(project, create_user, description_binary=b"yjs-state")
        response = api_key_client.patch(_url(workspace, project, page), {"name": "Renamed"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.name == "Renamed"
        assert bytes(page.description_binary) == b"yjs-state"

    @pytest.mark.django_db
    def test_locked_page_rejects_update(self, api_key_client, workspace, project, create_user):
        page = _make_page(project, create_user, is_locked=True)
        response = api_key_client.patch(_url(workspace, project, page), {"name": "x"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_only_owner_changes_access(self, workspace, project, create_user):
        page = _make_page(project, create_user)
        client, _ = _member_client(workspace, project, 15, "member@plane.so")
        response = client.patch(_url(workspace, project, page), {"access": 1}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_parent_must_be_in_project(self, api_key_client, workspace, project, create_user):
        other_project = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
        foreign = _make_page(other_project, create_user)
        page = _make_page(project, create_user)
        response = api_key_client.patch(_url(workspace, project, page), {"parent": str(foreign.id)}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_private_page_of_other_user_not_found(self, api_key_client, workspace, project):
        other = User.objects.create(email="o2@plane.so", username="o2")
        page = _make_page(project, other, access=Page.PRIVATE_ACCESS)
        assert api_key_client.get(_url(workspace, project, page)).status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        )


@pytest.mark.contract
class TestPageLifecycle:
    @pytest.mark.django_db
    def test_delete_requires_archive(self, api_key_client, workspace, project, create_user):
        page = _make_page(project, create_user)
        assert api_key_client.delete(_url(workspace, project, page)).status_code == status.HTTP_400_BAD_REQUEST

        assert api_key_client.post(_url(workspace, project, page, "archive/")).status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.archived_at is not None

        assert api_key_client.delete(_url(workspace, project, page)).status_code == status.HTTP_204_NO_CONTENT
        assert not Page.objects.filter(pk=page.pk).exists()

    @pytest.mark.django_db
    def test_archive_cascades_and_unarchive(self, api_key_client, workspace, project, create_user):
        parent = _make_page(project, create_user)
        child = _make_page(project, create_user, parent=parent)

        api_key_client.post(_url(workspace, project, parent, "archive/"))
        child.refresh_from_db()
        assert child.archived_at is not None

        response = api_key_client.delete(_url(workspace, project, parent, "archive/"))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        child.refresh_from_db()
        assert child.archived_at is None

    @pytest.mark.django_db
    def test_member_cannot_archive_others_page(self, workspace, project, create_user):
        page = _make_page(project, create_user)
        client, _ = _member_client(workspace, project, 15, "m2@plane.so")
        response = client.post(_url(workspace, project, page, "archive/"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_lock_and_unlock(self, api_key_client, workspace, project, create_user):
        page = _make_page(project, create_user)
        assert api_key_client.post(_url(workspace, project, page, "lock/")).status_code == status.HTTP_204_NO_CONTENT
        page.refresh_from_db()
        assert page.is_locked
        assert api_key_client.delete(_url(workspace, project, page, "lock/")).status_code == status.HTTP_204_NO_CONTENT
        page.refresh_from_db()
        assert not page.is_locked
