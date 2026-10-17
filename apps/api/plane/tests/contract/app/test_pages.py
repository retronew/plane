# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import patch
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Label, Page, PageLabel, Project, ProjectMember, ProjectPage, User, WorkspaceMember


pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def _no_background_tasks():
    with patch("plane.db.mixins.soft_delete_related_objects.delay"):
        yield


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Docs", identifier="DOC", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20)
    return project


def _make_page(project, owner, **kwargs):
    page = Page.objects.create(workspace=project.workspace, owned_by=owner, name="Spec", **kwargs)
    ProjectPage.objects.create(workspace=project.workspace, project=project, page=page)
    return page


def _url(workspace, project, page):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/"


@pytest.mark.parametrize("public_api", [False, True], ids=["app", "public-api"])
def test_list_filters_labels(session_client, api_key_client, workspace, project, create_user, public_api):
    labels = [
        Label.objects.create(workspace=workspace, project=project, name=name)
        for name in ("Design", "Backend", "Other")
    ]
    pages = [_make_page(project, create_user) for _ in range(4)]
    for page, page_labels in zip(pages, ([labels[0]], [labels[1]], labels, [])):
        for label in page_labels:
            PageLabel.objects.create(workspace=workspace, page=page, label=label)
    Page.objects.filter(pk=pages[0].pk).update(name="Search match")

    # A matching label must not bypass project or page visibility restrictions.
    other_project = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
    other_user = User.objects.create(email="private@plane.so", username="private")
    for page in (
        _make_page(other_project, create_user),
        _make_page(project, other_user, access=Page.PRIVATE_ACCESS),
    ):
        PageLabel.objects.create(workspace=workspace, page=page, label=labels[0])

    client = api_key_client if public_api else session_client
    prefix = "/api/v1" if public_api else "/api"
    url = f"{prefix}/workspaces/{workspace.slug}/projects/{project.id}/pages/"
    first, second = (str(label.id) for label in labels[:2])
    cases = [
        ({"labels": first}, pages[::2]),
        ({"labels": f"{first},{second}"}, pages[:3]),
        ({"labels": f" {first},,{first},invalid,null "}, pages[::2]),
        ({"labels": str(uuid4())}, []),
        ({"labels": ""}, pages),
        ({"labels": ",null,invalid,"}, pages),
        ({"labels": f"{first},{second}", "search": "Search match"}, pages[:1]),
    ]
    for params, expected in cases:
        response = client.get(url, params)
        assert response.status_code == status.HTTP_200_OK, params
        results = response.data["results"] if public_api else response.data
        assert {str(page["id"]) for page in results} == {str(page.id) for page in expected}, params
        assert len(results) == len(expected), params
        if not public_api and params == {"labels": first}:
            # Filtering must preserve all labels on a matched page in its response.
            matching_page = next(page for page in results if str(page["id"]) == str(pages[2].id))
            assert {str(label_id) for label_id in matching_page["label_ids"]} == {
                str(label.id) for label in labels
            }


@pytest.mark.parametrize("archived", [False, True], ids=["active", "archived"])
def test_delete_preserves_child_pages(session_client, workspace, project, create_user, archived):
    archived_at = timezone.now().date() if archived else None
    page = _make_page(project, create_user, archived_at=archived_at)
    child = _make_page(project, create_user, parent=page, archived_at=archived_at)
    grandchild = _make_page(project, create_user, parent=child, archived_at=archived_at)

    response = session_client.delete(_url(workspace, project, page))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not Page.objects.filter(pk=page.pk).exists()
    assert session_client.get(_url(workspace, project, page)).status_code == status.HTTP_403_FORBIDDEN
    child.refresh_from_db()
    grandchild.refresh_from_db()
    assert child.parent_id is None
    assert grandchild.parent_id == child.id
    for survivor in (child, grandchild):
        assert survivor.archived_at == archived_at
        assert ProjectPage.objects.filter(project=project, page=survivor).exists()
    response = session_client.get(_url(workspace, project, child), {"track_visit": "false"})
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.parametrize("archived", [False, True], ids=["active", "archived"])
@pytest.mark.parametrize(
    "role,is_owner,expected_status",
    [
        (15, True, status.HTTP_204_NO_CONTENT),
        (15, False, status.HTTP_403_FORBIDDEN),
        (20, False, status.HTTP_204_NO_CONTENT),
    ],
    ids=["owner", "other-member", "admin"],
)
def test_delete_permissions(workspace, project, create_user, archived, role, is_owner, expected_status):
    user = User.objects.create(email="deleter@plane.so", username="deleter")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    archived_at = timezone.now().date() if archived else None
    page = _make_page(project, user if is_owner else create_user, archived_at=archived_at)
    child = _make_page(project, create_user, parent=page, archived_at=archived_at)

    response = client.delete(_url(workspace, project, page))

    assert response.status_code == expected_status
    child.refresh_from_db()
    assert child.archived_at == archived_at
    if expected_status == status.HTTP_204_NO_CONTENT:
        assert not Page.objects.filter(pk=page.pk).exists()
        assert child.parent_id is None
    else:
        page.refresh_from_db()
        assert page.archived_at == archived_at
        assert child.parent_id == page.id
        assert ProjectPage.objects.filter(project=project, page=page).exists()
        response = client.get(_url(workspace, project, page), {"track_visit": "false"})
        assert response.status_code == status.HTTP_200_OK
