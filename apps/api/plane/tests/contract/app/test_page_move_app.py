# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import Mock
import uuid

import pytest
from django.utils import timezone
from plane.db.models import (
    FileAsset,
    Page,
    PageVersion,
    Project,
    ProjectMember,
    ProjectPage,
    User,
    UserFavorite,
    UserRecentVisit,
    Workspace,
)


@pytest.fixture
def move_case(workspace, create_user, monkeypatch):
    source = Project.objects.create(workspace=workspace, name="Source", identifier="SRC")
    target = Project.objects.create(workspace=workspace, name="Target", identifier="DST")
    for project in (source, target):
        ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=15)
    page = Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Preserve me",
        description_html="<p>content</p>",
        description_binary=b"binary",
    )
    ProjectPage.objects.create(workspace=workspace, project=source, page=page)
    redis = Mock()
    monkeypatch.setattr("plane.app.views.page.move.redis_instance", lambda: redis)
    url = f"/api/workspaces/{workspace.slug}/projects/{source.id}/pages/{page.id}/move/"
    return source, target, page, redis, url


pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def test_move_preserves_content_versions_assets_and_references(session_client, workspace, create_user, move_case):
    source, target, page, redis, url = move_case
    version = PageVersion.objects.create(workspace=workspace, page=page, owned_by=create_user, description_html="old")
    child = Page.objects.create(workspace=workspace, owned_by=create_user, parent=page, access=1)
    ProjectPage.objects.create(workspace=workspace, project=source, page=child)
    asset = FileAsset.objects.create(workspace=workspace, project=source, page=page, asset="test/image.png")
    favorite = UserFavorite.objects.create(
        workspace=workspace, project=source, user=create_user, entity_type="page", entity_identifier=page.id
    )
    visit = UserRecentVisit.objects.create(
        workspace=workspace, project=source, user=create_user, entity_name="page", entity_identifier=page.id
    )
    response = session_client.post(url, {"new_project_id": str(target.id)}, format="json")
    assert response.status_code == 200, response.data
    assert set(response.data["page_ids"]) == {str(page.id), str(child.id)}
    page.refresh_from_db()
    child.refresh_from_db()
    assert page.description_html == "<p>content</p>" and bytes(page.description_binary) == b"binary"
    assert child.parent_id == page.id and child.access == 1
    assert PageVersion.objects.get(id=version.id).page_id == page.id
    for obj in (asset, favorite, visit):
        obj.refresh_from_db()
        assert obj.project_id == target.id
    assert not ProjectPage.objects.filter(page__in=[page, child], project=source).exists()
    assert redis.publish.call_count == 2
    assert (
        session_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{source.id}/pages/{page.id}/versions/"
        ).status_code
        == 403
    )
    assert (
        session_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{target.id}/pages/{page.id}/versions/"
        ).status_code
        == 200
    )


@pytest.mark.parametrize("role,active", [(5, True), (15, False)])
def test_destination_requires_active_membership(session_client, create_user, move_case, role, active):
    source, target, page, redis, url = move_case
    ProjectMember.objects.filter(project=target, member=create_user).update(role=role, is_active=active)
    assert session_client.post(url, {"new_project_id": str(target.id)}, format="json").status_code == 403
    assert ProjectPage.objects.filter(project=source, page=page).exists()
    redis.publish.assert_not_called()


@pytest.mark.parametrize("private,role,expected", [(0, 15, 403), (0, 20, 200), (1, 20, 403)])
def test_only_owner_or_public_page_admin_can_move(session_client, create_user, move_case, private, role, expected):
    source, target, page, _, url = move_case
    other = User.objects.create(email="other@move.test", username=uuid.uuid4().hex)
    page.owned_by = other
    page.access = private
    page.save()
    ProjectMember.objects.filter(project=source, member=create_user).update(role=role)
    assert session_client.post(url, {"new_project_id": str(target.id)}, format="json").status_code == expected


@pytest.mark.parametrize("field,value", [("is_locked", True), ("archived_at", timezone.now().date())])
def test_locked_or_archived_page_not_moved(session_client, move_case, field, value):
    source, target, page, redis, url = move_case
    setattr(page, field, value)
    page.save()
    assert session_client.post(url, {"new_project_id": str(target.id)}, format="json").status_code == 400
    assert ProjectPage.objects.filter(project=source, page=page).exists()
    redis.publish.assert_not_called()


@pytest.mark.parametrize("kind", ["same", "missing", "invalid", "other_workspace", "archived_project"])
def test_invalid_destination(session_client, create_user, move_case, kind):
    source, target, page, _, url = move_case
    destination = str(target.id)
    expected = 400
    if kind == "same":
        destination = str(source.id)
    elif kind == "missing":
        destination = str(uuid.uuid4())
        expected = 404
    elif kind == "invalid":
        destination = "invalid"
    elif kind == "other_workspace":
        other = Workspace.objects.create(name="Other", slug="other-move", owner=create_user)
        target.workspace = other
        target.save()
        expected = 404
    else:
        target.archived_at = timezone.now()
        target.save()
        expected = 404
    assert session_client.post(url, {"new_project_id": destination}, format="json").status_code == expected
    assert ProjectPage.objects.filter(project=source, page=page).exists()


def test_inaccessible_child_rolls_back_whole_tree(session_client, workspace, move_case):
    source, target, page, redis, url = move_case
    owner = User.objects.create(email="child@move.test", username=uuid.uuid4().hex)
    child = Page.objects.create(workspace=workspace, owned_by=owner, parent=page, access=1)
    ProjectPage.objects.create(workspace=workspace, project=source, page=child)
    assert session_client.post(url, {"new_project_id": str(target.id)}, format="json").status_code == 403
    assert ProjectPage.objects.filter(project=source, page__in=[page, child]).count() == 2
    redis.publish.assert_not_called()


def test_live_revocation_failure_rolls_back_move(session_client, move_case):
    source, target, page, redis, url = move_case
    redis.publish.side_effect = RuntimeError("unavailable")
    assert session_client.post(url, {"new_project_id": str(target.id)}, format="json").status_code == 500
    assert ProjectPage.objects.filter(project=source, page=page).exists()
