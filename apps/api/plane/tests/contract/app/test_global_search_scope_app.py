# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for ``GlobalSearchEndpoint`` access scoping.

``/api/workspaces/<slug>/search/`` returned other users' private pages and
views, and ignored the guest restriction on projects with
``guest_view_all_features=False``. It now mirrors ``WorkspaceSearchAPIEndpoint``.
"""

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    Issue,
    IssueView,
    Page,
    Project,
    ProjectMember,
    ProjectPage,
    User,
    WorkspaceMember,
)

SEARCH_URL = "/api/workspaces/{slug}/search/"


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Search Project", identifier="SRCH", workspace=workspace)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


def _make_user(workspace, project, role):
    unique_id = uuid4().hex[:8]
    user = User.objects.create(email=f"u-{unique_id}@plane.so", username=f"u_{unique_id}")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def member(db, workspace, project):
    return _make_user(workspace, project, 15)


@pytest.fixture
def guest(db, workspace, project):
    return _make_user(workspace, project, 5)


def _page(name, workspace, project, owner, access):
    page = Page.objects.create(name=name, workspace=workspace, owned_by=owner, access=access)
    ProjectPage.objects.create(page=page, project=project, workspace=workspace)
    return page


def _view(name, workspace, project, owner, access):
    return IssueView.objects.create(name=name, workspace=workspace, project=project, owned_by=owner, access=access)


def _issue(name, workspace, project, author):
    issue = Issue.objects.create(name=name, workspace=workspace, project=project)
    # BaseModel.save overwrites created_by without a request user
    Issue.objects.filter(pk=issue.pk).update(created_by=author)
    return issue


def _search(client, workspace, entities, query="Secret"):
    response = client.get(SEARCH_URL.format(slug=workspace.slug), {"search": query, "entities": entities})
    assert response.status_code == status.HTTP_200_OK, response.data
    return response.data["results"][entities]


def _ids(rows):
    return {str(row["id"]) for row in rows}


@pytest.mark.contract
class TestGlobalSearchScope:
    @pytest.mark.django_db
    def test_private_page_of_other_user_hidden(self, workspace, project, create_user, member):
        private = _page("Secret private", workspace, project, create_user, Page.PRIVATE_ACCESS)
        public = _page("Secret public", workspace, project, create_user, Page.PUBLIC_ACCESS)
        own = _page("Secret mine", workspace, project, member, Page.PRIVATE_ACCESS)

        ids = _ids(_search(_client(member), workspace, "page"))
        assert str(private.id) not in ids
        assert {str(public.id), str(own.id)} <= ids

    @pytest.mark.django_db
    def test_archived_and_unlinked_pages_hidden(self, workspace, project, create_user, member):
        from django.utils import timezone

        archived = _page("Secret archived", workspace, project, create_user, Page.PUBLIC_ACCESS)
        Page.objects.filter(pk=archived.pk).update(archived_at=timezone.now())
        unlinked = _page("Secret unlinked", workspace, project, create_user, Page.PUBLIC_ACCESS)
        ProjectPage.objects.filter(page=unlinked).update(deleted_at=timezone.now())

        ids = _ids(_search(_client(member), workspace, "page"))
        assert str(archived.id) not in ids
        assert str(unlinked.id) not in ids

    @pytest.mark.django_db
    def test_private_view_of_other_user_hidden(self, workspace, project, create_user, member):
        private = _view("Secret private", workspace, project, create_user, 0)
        public = _view("Secret public", workspace, project, create_user, 1)

        ids = _ids(_search(_client(member), workspace, "issue_view"))
        assert str(private.id) not in ids
        assert str(public.id) in ids

    @pytest.mark.django_db
    def test_restricted_guest_sees_only_own_items(self, workspace, project, create_user, guest):
        assert project.guest_view_all_features is False
        client = _client(guest)

        own_issue = _issue("Secret own", workspace, project, guest)
        other_issue = _issue("Secret other", workspace, project, create_user)
        ids = _ids(_search(client, workspace, "issue"))
        assert str(own_issue.id) in ids
        assert str(other_issue.id) not in ids

        own_page = _page("Secret own", workspace, project, guest, Page.PUBLIC_ACCESS)
        other_page = _page("Secret other", workspace, project, create_user, Page.PUBLIC_ACCESS)
        ids = _ids(_search(client, workspace, "page"))
        assert str(own_page.id) in ids
        assert str(other_page.id) not in ids

        own_view = _view("Secret own", workspace, project, guest, 1)
        other_view = _view("Secret other", workspace, project, create_user, 1)
        ids = _ids(_search(client, workspace, "issue_view"))
        assert str(own_view.id) in ids
        assert str(other_view.id) not in ids

    @pytest.mark.django_db
    def test_guest_with_view_all_sees_public_items(self, workspace, project, create_user, guest):
        Project.objects.filter(pk=project.pk).update(guest_view_all_features=True)
        other_issue = _issue("Secret other", workspace, project, create_user)
        other_page = _page("Secret other", workspace, project, create_user, Page.PUBLIC_ACCESS)

        client = _client(guest)
        assert str(other_issue.id) in _ids(_search(client, workspace, "issue"))
        assert str(other_page.id) in _ids(_search(client, workspace, "page"))
