# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest import mock
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from plane.db.models import FileAsset, Project, ProjectMember, User, Workspace, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

S3_PATH = "plane.app.views.asset.v2.S3Storage"
ACTIVITY_PATH = "plane.app.views.project.overview.record_project_activity"
ATTACHMENT = FileAsset.EntityTypeContext.PROJECT_ATTACHMENT


def collection_url(workspace, project):
    return f"/api/assets/v2/workspaces/{workspace.slug}/projects/{project.id}/"


def detail_url(workspace, project, asset):
    return f"{collection_url(workspace, project)}{asset.id}/"


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Attachments", identifier="ATT", workspace=workspace)
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
    return project


@pytest.fixture
def payload(project):
    return {
        "entity_type": ATTACHMENT,
        "entity_identifier": str(project.id),
        "name": "project-plan.pdf",
        "size": 1024,
        "type": "application/pdf",
    }


@pytest.fixture
def storage():
    with mock.patch(S3_PATH) as storage_class:
        storage = storage_class.return_value
        storage.generate_presigned_post.return_value = {"url": "https://storage.example/upload", "fields": {}}
        storage.generate_presigned_url.return_value = "https://storage.example/download"
        storage.get_object_metadata.return_value = {"ContentLength": 1024, "ContentType": "application/pdf"}
        yield storage


@pytest.fixture
def activity():
    with mock.patch(ACTIVITY_PATH) as record:
        yield record


@pytest.fixture
def make_asset(workspace, project, create_user):
    def make(**overrides):
        fields = {
            "workspace": workspace,
            "project": project,
            "asset": f"{workspace.id}/{uuid4().hex}-project-plan.pdf",
            "attributes": {"name": "project-plan.pdf", "size": 1024, "type": "application/pdf"},
            "size": 1024,
            "entity_type": ATTACHMENT,
            "entity_identifier": str(project.id),
            "created_by": create_user,
            "is_uploaded": True,
        }
        fields.update(overrides)
        asset = FileAsset(**fields)
        asset.save(disable_auto_set_user=True)
        return asset

    return make


@pytest.fixture
def member_client(workspace, project):
    def make(*, role=15, workspace_role=15, project_active=True, workspace_active=True, join_project=True):
        unique_id = uuid4().hex
        user = User.objects.create(email=f"attachment-{unique_id}@example.com", username=f"attachment-{unique_id}")
        WorkspaceMember.objects.create(
            workspace=workspace, member=user, role=workspace_role, is_active=workspace_active
        )
        if join_project:
            ProjectMember.objects.create(
                workspace=workspace, project=project, member=user, role=role, is_active=project_active
            )
        client = APIClient()
        client.force_authenticate(user=user)
        return client, user

    return make


def test_signed_upload_list_download_and_soft_delete(
    session_client, workspace, project, create_user, payload, storage, activity
):
    url = collection_url(workspace, project)
    response = session_client.post(url, payload, format="json")
    assert response.status_code == 200
    asset = FileAsset.objects.get(id=response.data["asset_id"])
    assert asset.entity_identifier == str(project.id)
    assert asset.project_id == project.id
    assert asset.workspace_id == workspace.id
    assert asset.created_by_id == create_user.id
    assert asset.size == 1024
    assert not asset.is_uploaded
    assert response.data["asset_url"] == detail_url(workspace, project, asset)
    storage.generate_presigned_post.assert_called_once_with(
        object_name=asset.asset.name, file_type="application/pdf", file_size=1024
    )
    assert session_client.get(url).data == []
    assert session_client.get(asset.asset_url).status_code == 404

    assert session_client.patch(asset.asset_url).status_code == 204
    assert session_client.patch(asset.asset_url).status_code == 204
    asset.refresh_from_db()
    assert asset.is_uploaded
    assert asset.storage_metadata == storage.get_object_metadata.return_value
    storage.get_object_metadata.assert_called_once_with(object_name=asset.asset.name)
    activity.assert_called_once_with(
        project,
        create_user,
        "added",
        "attachment",
        new_value={"id": str(asset.id), "name": "project-plan.pdf"},
    )

    response = session_client.get(url)
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0] == {
        "id": str(asset.id),
        "attributes": {"name": "project-plan.pdf", "size": 1024, "type": "application/pdf"},
        "asset_url": asset.asset_url,
        "created_at": asset.created_at,
        "created_by": str(create_user.id),
        "created_by_detail": {
            "id": create_user.id,
            "first_name": create_user.first_name,
            "last_name": create_user.last_name,
            "avatar": create_user.avatar,
            "avatar_url": create_user.avatar_url,
            "is_bot": create_user.is_bot,
            "display_name": create_user.display_name,
        },
    }
    response = session_client.get(asset.asset_url)
    assert response.status_code == 302
    assert response["Location"] == "https://storage.example/download"
    storage.generate_presigned_url.assert_called_once_with(
        object_name=asset.asset.name, disposition="attachment", filename="project-plan.pdf"
    )

    assert session_client.delete(asset.asset_url).status_code == 204
    assert session_client.delete(asset.asset_url).status_code == 404
    deleted = FileAsset.all_objects.get(id=asset.id)
    assert deleted.is_deleted and deleted.deleted_at is not None
    assert session_client.get(url).data == []
    assert session_client.get(asset.asset_url).status_code == 404
    assert session_client.patch(asset.asset_url).status_code == 404
    assert activity.call_count == 2
    activity.assert_called_with(
        project,
        create_user,
        "deleted",
        "attachment",
        old_value={"id": str(asset.id), "name": "project-plan.pdf"},
    )
    storage.delete_files.assert_not_called()


def test_list_retains_uploader_details_after_membership_removed(
    session_client, workspace, project, make_asset, member_client
):
    _, uploader = member_client()
    uploader.display_name = "Former uploader"
    uploader.save(update_fields=["display_name"])
    avatar = make_asset(entity_type=FileAsset.EntityTypeContext.USER_AVATAR)
    uploader.avatar_asset = avatar
    uploader.save(update_fields=["avatar_asset"])
    attachment = make_asset(created_by=uploader)
    ProjectMember.objects.filter(project=project, member=uploader).delete()
    WorkspaceMember.objects.filter(workspace=workspace, member=uploader).delete()

    response = session_client.get(collection_url(workspace, project))

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["id"] == str(attachment.id)
    author = response.data[0]["created_by_detail"]
    assert str(author["id"]) == str(uploader.id)
    assert author["display_name"] == "Former uploader"
    assert author["avatar_url"] == avatar.asset_url
    assert "email" not in author


def test_list_handles_deleted_uploader(session_client, workspace, project, make_asset):
    attachment = make_asset(created_by=None)

    response = session_client.get(collection_url(workspace, project))

    assert response.status_code == 200
    assert response.data[0]["id"] == str(attachment.id)
    assert response.data[0]["created_by"] is None
    assert response.data[0]["created_by_detail"] is None


@pytest.mark.parametrize("mime_type", ["application/pdf", "text/plain", "application/octet-stream", "text/html"])
def test_documents_are_accepted(session_client, workspace, project, payload, storage, mime_type):
    payload["type"] = mime_type
    response = session_client.post(collection_url(workspace, project), payload, format="json")
    assert response.status_code == 200
    assert FileAsset.objects.get(id=response.data["asset_id"]).attributes["type"] == mime_type


@pytest.mark.parametrize("size", [None, True, False, 0, -1, 1.5, "1024", "NaN", "Infinity", 1e100, 1025])
def test_invalid_and_oversized_size_rejected(session_client, workspace, project, payload, storage, settings, size):
    settings.FILE_SIZE_LIMIT = 1024
    payload["size"] = size
    response = session_client.post(collection_url(workspace, project), payload, format="json")
    assert response.status_code == 400
    assert not FileAsset.objects.exists()
    storage.generate_presigned_post.assert_not_called()


@pytest.mark.parametrize("size", [1, 1024])
def test_size_boundaries_are_signed_without_truncation(
    session_client, workspace, project, payload, storage, settings, size
):
    settings.FILE_SIZE_LIMIT = 1024
    payload["size"] = size
    response = session_client.post(collection_url(workspace, project), payload, format="json")
    assert response.status_code == 200
    assert storage.generate_presigned_post.call_args.kwargs["file_size"] == size
    asset = FileAsset.objects.get(id=response.data["asset_id"])
    assert asset.size == size and asset.attributes["size"] == size


@pytest.mark.parametrize(
    "field,value",
    [
        ("name", None),
        ("name", ""),
        ("name", ".."),
        ("name", 123),
        ("name", "a" * 256),
        ("name", "bad\r\nname.pdf"),
        ("type", None),
        ("type", ""),
        ("type", "pdf"),
        ("type", "text/html\r\nInjected: yes"),
        ("type", []),
        ("type", "text/" + "a" * 256),
    ],
)
def test_invalid_metadata_rejected(session_client, workspace, project, payload, storage, field, value):
    payload[field] = value
    response = session_client.post(collection_url(workspace, project), payload, format="json")
    assert response.status_code == 400
    assert not FileAsset.objects.exists()
    storage.generate_presigned_post.assert_not_called()


def test_filename_sanitized(session_client, workspace, project, payload, storage):
    payload["name"] = "../../报告.pdf"
    response = session_client.post(collection_url(workspace, project), payload, format="json")
    assert response.status_code == 200
    asset = FileAsset.objects.get(id=response.data["asset_id"])
    assert asset.attributes["name"] == "报告.pdf"
    assert asset.asset.name.endswith("-报告.pdf")


@pytest.mark.parametrize("identifier", [None, "invalid", str(uuid4())])
def test_entity_identifier_must_match_url(session_client, workspace, project, payload, storage, identifier):
    payload["entity_identifier"] = identifier
    response = session_client.post(collection_url(workspace, project), payload, format="json")
    assert response.status_code == 400
    assert not FileAsset.objects.exists()
    storage.generate_presigned_post.assert_not_called()


@pytest.mark.parametrize(
    "metadata",
    [
        None,
        {},
        {"ContentLength": 0, "ContentType": "application/pdf"},
        {"ContentLength": 1023, "ContentType": "application/pdf"},
        {"ContentLength": 1025, "ContentType": "application/pdf"},
        {"ContentLength": "1024", "ContentType": "application/pdf"},
        {"ContentLength": 1024, "ContentType": "text/html"},
        {"ContentLength": 1024},
    ],
)
def test_completion_requires_matching_stored_object(
    session_client, workspace, project, make_asset, storage, activity, settings, metadata
):
    settings.FILE_SIZE_LIMIT = 1024
    asset = make_asset(is_uploaded=False)
    storage.get_object_metadata.return_value = metadata
    response = session_client.patch(detail_url(workspace, project, asset))
    assert response.status_code == 400
    asset.refresh_from_db()
    assert not asset.is_uploaded
    activity.assert_not_called()


@pytest.mark.parametrize(
    "data",
    [
        {"attributes": {"name": "changed.html", "size": 1, "type": "text/html"}},
        {"entity_identifier": str(uuid4())},
        {"is_uploaded": True},
    ],
)
def test_completion_cannot_replace_metadata(session_client, workspace, project, make_asset, storage, activity, data):
    asset = make_asset(is_uploaded=False)
    response = session_client.patch(detail_url(workspace, project, asset), data, format="json")
    assert response.status_code == 400
    asset.refresh_from_db()
    assert not asset.is_uploaded
    assert asset.attributes["name"] == "project-plan.pdf"
    storage.get_object_metadata.assert_not_called()
    activity.assert_not_called()


@pytest.mark.parametrize(
    "options",
    [
        {"join_project": False},
        {"project_active": False},
        {"workspace_active": False},
    ],
)
def test_scope_requires_active_workspace_and_project_membership(
    workspace, project, payload, make_asset, member_client, storage, activity, options
):
    client, _ = member_client(**options)
    asset = make_asset(is_uploaded=False)
    url = detail_url(workspace, project, asset)
    assert client.get(collection_url(workspace, project)).status_code == 403
    assert client.get(url).status_code == 403
    assert client.post(collection_url(workspace, project), payload, format="json").status_code == 403
    assert client.patch(url).status_code == 403
    assert client.delete(url).status_code == 403
    storage.generate_presigned_post.assert_not_called()
    storage.generate_presigned_url.assert_not_called()
    activity.assert_not_called()


@pytest.mark.parametrize("role,workspace_role", [(5, 5), (15, 15), (20, 15)])
def test_active_members_including_guests_can_read(
    workspace, project, make_asset, member_client, storage, role, workspace_role
):
    client, _ = member_client(role=role, workspace_role=workspace_role)
    asset = make_asset()
    assert client.get(collection_url(workspace, project)).status_code == 200
    assert client.get(detail_url(workspace, project, asset)).status_code == 302


@pytest.mark.parametrize("role,workspace_role,allowed", [(5, 5, False), (15, 15, True), (20, 15, True), (5, 20, True)])
def test_upload_roles(workspace, project, payload, member_client, storage, role, workspace_role, allowed):
    client, _ = member_client(role=role, workspace_role=workspace_role)
    response = client.post(collection_url(workspace, project), payload, format="json")
    assert response.status_code == (200 if allowed else 403)
    assert FileAsset.objects.count() == int(allowed)


def test_guest_cannot_complete_upload(workspace, project, make_asset, member_client, storage, activity):
    client, user = member_client(role=5, workspace_role=5)
    asset = make_asset(is_uploaded=False, created_by=user)
    assert client.patch(detail_url(workspace, project, asset)).status_code == 403
    storage.get_object_metadata.assert_not_called()
    activity.assert_not_called()


def test_member_cannot_complete_another_users_upload(workspace, project, make_asset, member_client, storage, activity):
    client, _ = member_client()
    asset = make_asset(is_uploaded=False)
    assert client.patch(detail_url(workspace, project, asset)).status_code == 403
    storage.get_object_metadata.assert_not_called()
    activity.assert_not_called()


@pytest.mark.parametrize(
    "role,workspace_role,owner,allowed",
    [
        (5, 5, False, False),
        (15, 15, False, False),
        (15, 15, True, True),
        (5, 5, True, True),
        (20, 15, False, True),
        (5, 20, False, True),
    ],
)
def test_delete_creator_or_admin_only(
    workspace, project, make_asset, member_client, activity, role, workspace_role, owner, allowed
):
    client, user = member_client(role=role, workspace_role=workspace_role)
    asset = make_asset(**({"created_by": user} if owner else {}))
    response = client.delete(detail_url(workspace, project, asset))
    assert response.status_code == (204 if allowed else 403)
    assert FileAsset.all_objects.get(id=asset.id).is_deleted == allowed
    assert activity.call_count == int(allowed)


def test_archived_projects_are_read_only(session_client, workspace, project, payload, make_asset, storage, activity):
    project.archived_at = timezone.now()
    project.save(update_fields=["archived_at"])
    uploaded = make_asset()
    pending = make_asset(is_uploaded=False)
    assert session_client.get(collection_url(workspace, project)).status_code == 200
    assert session_client.get(detail_url(workspace, project, uploaded)).status_code == 302
    assert session_client.post(collection_url(workspace, project), payload, format="json").status_code == 403
    assert session_client.patch(detail_url(workspace, project, pending)).status_code == 403
    assert session_client.delete(detail_url(workspace, project, uploaded)).status_code == 403
    storage.generate_presigned_post.assert_not_called()
    storage.get_object_metadata.assert_not_called()
    activity.assert_not_called()


def test_collection_excludes_other_scopes_types_and_deleted_assets(
    session_client, workspace, project, create_user, make_asset
):
    expected = make_asset()
    make_asset(is_uploaded=False)
    make_asset(is_deleted=True)
    make_asset(deleted_at=timezone.now())
    make_asset(entity_type=FileAsset.EntityTypeContext.ISSUE_DESCRIPTION)
    make_asset(entity_identifier=str(uuid4()))
    other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
    make_asset(project=other, entity_identifier=str(other.id))
    other_workspace = Workspace.objects.create(name="Other", slug="other-attachment-ws", owner=create_user)
    make_asset(workspace=other_workspace)
    response = session_client.get(collection_url(workspace, project))
    assert response.status_code == 200
    assert [row["id"] for row in response.data] == [str(expected.id)]


def test_cross_project_and_workspace_asset_ids_rejected(
    session_client, workspace, project, create_user, make_asset, storage, activity
):
    other_project = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
    other_workspace = Workspace.objects.create(name="Other", slug="other-attachment-ws", owner=create_user)
    assets = [
        make_asset(project=other_project, entity_identifier=str(other_project.id)),
        make_asset(workspace=other_workspace),
        make_asset(entity_identifier=str(uuid4())),
    ]
    for asset in assets:
        url = detail_url(workspace, project, asset)
        assert session_client.get(url).status_code == 404
        assert session_client.patch(url).status_code == 404
        assert session_client.delete(url).status_code == 404
    storage.generate_presigned_url.assert_not_called()
    activity.assert_not_called()


def test_failed_signing_does_not_create_pending_asset(session_client, workspace, project, payload, storage):
    storage.generate_presigned_post.return_value = None
    response = session_client.post(collection_url(workspace, project), payload, format="json")
    assert response.status_code == 503
    assert not FileAsset.objects.exists()


@pytest.mark.parametrize("operation", ["patch", "delete"])
def test_activity_and_state_change_are_atomic(
    session_client, workspace, project, make_asset, storage, activity, operation
):
    asset = make_asset(is_uploaded=operation == "delete")
    activity.side_effect = RuntimeError("Activity write failed")
    response = getattr(session_client, operation)(detail_url(workspace, project, asset))
    assert response.status_code == 500
    asset.refresh_from_db()
    assert asset.is_uploaded == (operation == "delete")
    assert not asset.is_deleted
    assert asset.deleted_at is None


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "{id}/"),
        ("patch", "{id}/"),
        ("delete", "{id}/"),
        ("post", "restore/{id}/"),
        ("get", "download/{id}/"),
    ],
)
def test_workspace_generic_endpoints_reject_project_attachments(
    session_client, workspace, make_asset, storage, activity, method, path
):
    asset = make_asset()
    url = f"/api/assets/v2/workspaces/{workspace.slug}/{path.format(id=asset.id)}"
    assert getattr(session_client, method)(url).status_code == 400
    asset.refresh_from_db()
    assert asset.is_uploaded and not asset.is_deleted
    storage.generate_presigned_url.assert_not_called()
    activity.assert_not_called()


def test_workspace_upload_and_duplicate_reject_attachment_type(
    session_client, workspace, project, payload, make_asset, storage
):
    url = f"/api/assets/v2/workspaces/{workspace.slug}/"
    assert session_client.post(url, payload, format="json").status_code == 400
    original = make_asset(entity_type=FileAsset.EntityTypeContext.ISSUE_DESCRIPTION)
    response = session_client.post(
        f"{url}duplicate-assets/{original.id}/",
        {"entity_type": ATTACHMENT, "project_id": str(project.id), "entity_id": str(project.id)},
        format="json",
    )
    assert response.status_code == 400
    assert FileAsset.objects.count() == 1
    storage.copy_object.assert_not_called()


def test_duplicate_cannot_relabel_attachment_source(session_client, workspace, project, make_asset, storage):
    asset = make_asset()
    response = session_client.post(
        f"/api/assets/v2/workspaces/{workspace.slug}/duplicate-assets/{asset.id}/",
        {"entity_type": "ISSUE_DESCRIPTION", "project_id": str(project.id)},
        format="json",
    )
    assert response.status_code == 400
    assert FileAsset.objects.count() == 1
    storage.copy_object.assert_not_called()


def test_bulk_cannot_modify_attachment_in_mixed_batch(session_client, workspace, project, make_asset):
    attachment = make_asset()
    cover = make_asset(entity_type=FileAsset.EntityTypeContext.PROJECT_COVER)
    response = session_client.post(
        f"{collection_url(workspace, project)}{project.id}/bulk/",
        {"asset_ids": [str(cover.id), str(attachment.id)]},
        format="json",
    )
    assert response.status_code == 400
    project.refresh_from_db()
    assert project.cover_image_asset_id is None
    attachment.refresh_from_db()
    assert attachment.entity_type == ATTACHMENT
    assert attachment.entity_identifier == str(project.id)


def test_workspace_asset_check_does_not_leak_attachment(session_client, workspace, make_asset):
    asset = make_asset()
    response = session_client.get(f"/api/assets/v2/workspaces/{workspace.slug}/check/{asset.id}/")
    assert response.status_code == 200
    assert response.data == {"exists": False}


def test_static_endpoint_cannot_serve_project_attachment(api_client, make_asset, storage):
    asset = make_asset()
    assert api_client.get(f"/api/assets/v2/static/{asset.id}/").status_code == 400
    storage.generate_presigned_url.assert_not_called()


def test_minio_signed_upload_and_authorized_download_roundtrip(
    session_client, workspace, project, create_user, monkeypatch
):
    import os

    import requests

    from plane.db.models import ProjectActivity
    from plane.settings.storage import S3Storage

    # Exercise the isolated compose test service through real S3 signing and HEAD.
    # Public endpoints configured for a local browser are unreachable in the test network.
    endpoint = os.environ.get("AWS_S3_ENDPOINT_URL", "")
    if endpoint != "http://test-minio:9000":
        pytest.skip("Requires the isolated compose test-minio service.")
    monkeypatch.setenv("USE_MINIO", "0")
    monkeypatch.delenv("AWS_S3_PUBLIC_ENDPOINT_URL", raising=False)
    content = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n"
    storage = S3Storage()
    asset = None
    try:
        response = session_client.post(
            collection_url(workspace, project),
            {
                "entity_type": ATTACHMENT,
                "entity_identifier": str(project.id),
                "name": "roundtrip.pdf",
                "size": len(content),
                "type": "application/pdf",
            },
            format="json",
        )
        assert response.status_code == 200
        asset = FileAsset.objects.get(pk=response.data["asset_id"])
        upload = response.data["upload_data"]
        uploaded = requests.post(
            upload["url"],
            data=upload["fields"],
            files={"file": ("roundtrip.pdf", content, "application/pdf")},
            timeout=15,
        )
        assert uploaded.status_code in (200, 201, 204)
        asset_url = response.data["asset_url"]
        assert session_client.patch(asset_url).status_code == 204
        assert session_client.patch(asset_url).status_code == 204
        asset.refresh_from_db()
        assert asset.storage_metadata["ContentLength"] == len(content)
        assert asset.storage_metadata["ContentType"] == "application/pdf"
        response = session_client.get(collection_url(workspace, project))
        assert [row["id"] for row in response.data] == [str(asset.id)]
        assert response.data[0]["attributes"]["size"] == len(content)
        download = session_client.get(asset_url)
        assert download.status_code == 302
        downloaded = requests.get(download["Location"], timeout=15)
        assert downloaded.status_code == 200
        assert downloaded.content == content
        assert downloaded.headers["Content-Disposition"].startswith("attachment;")
        events = ProjectActivity.objects.filter(project=project, field="attachment")
        assert events.filter(verb="added", actor=create_user).count() == 1
        assert session_client.delete(asset_url).status_code == 204
        assert session_client.get(asset_url).status_code == 404
        assert session_client.get(collection_url(workspace, project)).data == []
        assert events.filter(verb="deleted", actor=create_user).count() == 1
    finally:
        if asset is not None:
            assert storage.delete_files([asset.asset.name])
