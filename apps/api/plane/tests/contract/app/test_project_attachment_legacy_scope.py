# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Project attachments must only be served or mutated through the project asset API."""

from unittest import mock
from uuid import uuid4

import pytest
from django.core.cache import cache
from django.utils import timezone

from plane.db.models import DeployBoard, FileAsset, Project, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

PROJECT_ATTACHMENT = FileAsset.EntityTypeContext.PROJECT_ATTACHMENT
COMMENT_DESCRIPTION = FileAsset.EntityTypeContext.COMMENT_DESCRIPTION


@pytest.fixture
def private_project(workspace, create_user):
    # The caller is an active workspace member with no membership of this private project.
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    return Project.objects.create(name="Private attachments", identifier="PRA", workspace=workspace, network=0)


@pytest.fixture
def board(workspace, private_project):
    return DeployBoard.objects.create(
        workspace=workspace,
        project=private_project,
        entity_name="project",
        entity_identifier=private_project.id,
    )


@pytest.fixture
def make_asset(workspace, private_project, create_user):
    def create(entity_type=PROJECT_ATTACHMENT, *, user_key=False):
        key = f"{uuid4().hex}-secret.png"
        asset = FileAsset.objects.create(
            workspace=workspace,
            project=private_project,
            user=create_user,
            entity_type=entity_type,
            asset=key if user_key else f"{workspace.id}/{key}",
            attributes={"name": "secret.png", "type": "image/png", "size": 32},
            size=32,
            is_uploaded=True,
            storage_metadata={"size": 32},
        )
        # BaseModel clears created_by outside a request; the old user-key lookup requires it.
        FileAsset.objects.filter(pk=asset.pk).update(created_by_id=create_user.id)
        return asset

    return create


@pytest.fixture
def asset(make_asset):
    return make_asset()


@pytest.fixture
def legacy_api_client(api_key_client, api_token):
    # This file lives outside contract/api, whose autouse fixture clears API-key throttles.
    cache.delete(f"api_key:{api_token.token}")
    yield api_key_client
    cache.delete(f"api_key:{api_token.token}")


def assert_project_api_required(response):
    assert response.status_code == 403, getattr(response, "data", None)
    assert "project asset API" in str(response.data)


def public_url(board):
    return f"/api/public/assets/v2/anchor/{board.anchor}/"


@pytest.mark.parametrize("authenticated", [False, True])
@pytest.mark.parametrize("network", [0, 2])
def test_published_space_cannot_download_project_attachment(
    api_client, session_client, board, asset, authenticated, network
):
    Project.objects.filter(pk=asset.project_id).update(network=network)
    client = session_client if authenticated else api_client
    if not authenticated:
        client.force_authenticate(user=None)
    with mock.patch("plane.space.views.asset.S3Storage") as storage:
        response = client.get(f"{public_url(board)}{asset.id}/")
    assert_project_api_required(response)
    storage.assert_not_called()


@pytest.mark.parametrize("operation", ["patch", "delete", "restore"])
def test_published_space_cannot_mutate_project_attachment(session_client, board, asset, operation):
    if operation == "restore":
        FileAsset.objects.filter(pk=asset.pk).update(is_deleted=True, deleted_at=timezone.now())
        asset.refresh_from_db()
    original_deleted_at = asset.deleted_at
    url = f"{public_url(board)}{asset.id}/"
    with mock.patch("plane.space.views.asset.get_asset_object_metadata.delay") as metadata:
        if operation == "restore":
            response = session_client.post(f"{public_url(board)}restore/{asset.id}/", {}, format="json")
        elif operation == "patch":
            response = session_client.patch(url, {"attributes": {"name": "changed"}}, format="json")
        else:
            response = session_client.delete(url)
    assert_project_api_required(response)
    metadata.assert_not_called()
    asset.refresh_from_db()
    assert asset.attributes["name"] == "secret.png"
    assert asset.is_uploaded is True
    assert asset.is_deleted is (operation == "restore")
    assert asset.deleted_at == original_deleted_at


@pytest.mark.parametrize("mixed", [False, True])
def test_space_bulk_rejects_project_attachment_before_any_update(session_client, board, asset, make_asset, mixed):
    assets = [asset]
    if mixed:
        # Newest first: the old implementation checks only this comment asset before updating the whole batch.
        assets.insert(0, make_asset(COMMENT_DESCRIPTION))
    response = session_client.post(
        f"{public_url(board)}{uuid4()}/bulk/",
        {"asset_ids": [str(item.id) for item in assets]},
        format="json",
    )
    assert_project_api_required(response)
    for item in assets:
        item.refresh_from_db()
        assert item.comment_id is None


def test_space_legacy_description_download_still_works(api_client, board, make_asset):
    asset = make_asset(COMMENT_DESCRIPTION)
    with mock.patch("plane.space.views.asset.S3Storage") as storage:
        storage.return_value.generate_presigned_url.return_value = "https://signed.example/download"
        response = api_client.get(f"{public_url(board)}{asset.id}/")
    assert response.status_code == 302
    storage.return_value.generate_presigned_url.assert_called_once()


@pytest.mark.parametrize("operation", ["get", "patch"])
def test_generic_api_cannot_access_project_attachment(legacy_api_client, workspace, asset, operation):
    url = f"/api/v1/workspaces/{workspace.slug}/assets/{asset.id}/"
    with (
        mock.patch("plane.api.views.asset.S3Storage") as storage,
        mock.patch("plane.api.views.asset.get_asset_object_metadata.delay") as metadata,
    ):
        if operation == "get":
            response = legacy_api_client.get(url)
        else:
            response = legacy_api_client.patch(url, {"is_uploaded": False}, format="json")
    assert_project_api_required(response)
    storage.assert_not_called()
    metadata.assert_not_called()
    asset.refresh_from_db()
    assert asset.is_uploaded is True


def test_generic_api_external_id_lookup_cannot_disclose_project_attachment(legacy_api_client, workspace, asset):
    FileAsset.objects.filter(pk=asset.pk).update(external_id="private-file", external_source="integration")
    with mock.patch("plane.api.views.asset.S3Storage") as storage:
        response = legacy_api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/assets/",
            {
                "name": "upload.png",
                "type": "image/png",
                "size": 32,
                "external_id": "private-file",
                "external_source": "integration",
            },
            format="json",
        )
    assert_project_api_required(response)
    assert "asset_id" not in response.data
    assert "asset_url" not in response.data
    assert FileAsset.objects.filter(workspace=workspace).count() == 1
    storage.assert_not_called()


@pytest.mark.parametrize("operation", ["get", "patch"])
def test_generic_api_legacy_asset_still_works(legacy_api_client, workspace, make_asset, operation):
    asset = make_asset(FileAsset.EntityTypeContext.ISSUE_ATTACHMENT)
    url = f"/api/v1/workspaces/{workspace.slug}/assets/{asset.id}/"
    with mock.patch("plane.api.views.asset.S3Storage") as storage:
        storage.return_value.generate_presigned_url.return_value = "https://signed.example/download"
        if operation == "get":
            response = legacy_api_client.get(url)
            assert response.status_code == 200
            assert response.data["asset_url"] == "https://signed.example/download"
        else:
            response = legacy_api_client.patch(url, {"is_uploaded": False}, format="json")
            assert response.status_code == 204
            asset.refresh_from_db()
            assert asset.is_uploaded is False


@pytest.mark.parametrize(
    ("key_scope", "operation"),
    [("workspace", "get"), ("workspace", "delete"), ("workspace", "restore"), ("user", "get"), ("user", "delete")],
)
def test_old_key_endpoints_cannot_access_project_attachment(
    session_client, workspace, make_asset, key_scope, operation
):
    asset = make_asset(user_key=key_scope == "user")
    if key_scope == "user":
        url = f"/api/users/file-assets/{asset.asset.name}/"
    else:
        key = asset.asset.name.split("/", 1)[1]
        url = f"/api/workspaces/file-assets/{workspace.id}/{key}/"
    if operation == "restore":
        FileAsset.objects.filter(pk=asset.pk).update(is_deleted=True)
        response = session_client.post(f"{url}restore/", {}, format="json")
    else:
        response = getattr(session_client, operation)(url)
    assert_project_api_required(response)
    asset.refresh_from_db()
    assert asset.is_deleted is (operation == "restore")


def test_old_key_restore_cannot_restore_soft_deleted_project_attachment(session_client, workspace, asset):
    deleted_at = timezone.now()
    FileAsset.objects.filter(pk=asset.pk).update(is_deleted=True, deleted_at=deleted_at)
    key = asset.asset.name.split("/", 1)[1]
    response = session_client.post(f"/api/workspaces/file-assets/{workspace.id}/{key}/restore/", {}, format="json")
    # The old manager already hides assets with deleted_at set; that 404 remains valid.
    assert response.status_code == 404
    asset.refresh_from_db()
    assert asset.is_deleted is True
    assert asset.deleted_at == deleted_at


@pytest.mark.parametrize("operation", ["get", "delete", "restore"])
def test_old_workspace_key_legacy_asset_still_works(session_client, workspace, make_asset, operation):
    asset = make_asset(FileAsset.EntityTypeContext.WORKSPACE_LOGO)
    key = asset.asset.name.split("/", 1)[1]
    url = f"/api/workspaces/file-assets/{workspace.id}/{key}/"
    if operation == "restore":
        FileAsset.objects.filter(pk=asset.pk).update(is_deleted=True)
        response = session_client.post(f"{url}restore/", {}, format="json")
    else:
        response = getattr(session_client, operation)(url)
    assert response.status_code == (200 if operation == "get" else 204)
    asset.refresh_from_db()
    assert asset.is_deleted is (operation == "delete")


@pytest.mark.parametrize("server", [False, True])
@pytest.mark.parametrize("operation", ["patch", "delete"])
def test_user_asset_api_cannot_mutate_project_attachment(legacy_api_client, asset, server, operation):
    suffix = "server/" if server else ""
    url = f"/api/v1/assets/user-assets/{asset.id}/{suffix}"
    with mock.patch("plane.api.views.asset.get_asset_object_metadata.delay") as metadata:
        if operation == "patch":
            response = legacy_api_client.patch(url, {"attributes": {"name": "changed"}}, format="json")
        else:
            response = legacy_api_client.delete(url)
    assert_project_api_required(response)
    metadata.assert_not_called()
    asset.refresh_from_db()
    assert asset.attributes["name"] == "secret.png"
    assert asset.is_deleted is False


@pytest.mark.parametrize("endpoint", ["space", "workspace-key", "user-key", "generic", "user", "user-server"])
def test_legacy_uploads_reject_project_attachment_type(session_client, legacy_api_client, workspace, board, endpoint):
    urls = {
        "space": public_url(board),
        "workspace-key": f"/api/workspaces/{workspace.slug}/file-assets/",
        "user-key": "/api/users/file-assets/",
        "generic": f"/api/v1/workspaces/{workspace.slug}/assets/",
        "user": "/api/v1/assets/user-assets/",
        "user-server": "/api/v1/assets/user-assets/server/",
    }
    client = legacy_api_client if endpoint in {"generic", "user", "user-server"} else session_client
    with (
        mock.patch("plane.space.views.asset.S3Storage") as space_storage,
        mock.patch("plane.api.views.asset.S3Storage") as api_storage,
    ):
        response = client.post(
            urls[endpoint],
            {"name": "secret.png", "type": "image/png", "size": 32, "entity_type": PROJECT_ATTACHMENT},
            format="multipart" if endpoint == "user-key" else "json",
        )
    assert_project_api_required(response)
    assert not FileAsset.objects.filter(workspace=workspace).exists()
    space_storage.assert_not_called()
    api_storage.assert_not_called()
