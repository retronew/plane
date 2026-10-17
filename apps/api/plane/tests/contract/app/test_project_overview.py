# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from plane.db.models import (
    Project,
    ProjectActivity,
    ProjectCategory,
    ProjectLink,
    ProjectMember,
    ProjectReaction,
    ProjectUpdate,
    User,
    Workspace,
    WorkspaceMember,
)

pytestmark = [pytest.mark.django_db, pytest.mark.contract]


@pytest.fixture
def project(workspace, create_user):
    instance = Project.objects.create(
        name="Overview", identifier="OVR", workspace=workspace, network=0, project_updates_view=True
    )
    ProjectMember.objects.create(project=instance, member=create_user, role=20)
    return instance


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def add_member(project, *, role=15, workspace_role=15):
    token = uuid4().hex
    user = User.objects.create(email=f"{token}@example.test", username=token, first_name="Overview member")
    WorkspaceMember.objects.create(workspace=project.workspace, member=user, role=workspace_role)
    ProjectMember.objects.create(project=project, member=user, role=role)
    return user


def url(project, resource, pk=None, slug=None):
    base = f"/api/workspaces/{slug or project.workspace.slug}/projects/{project.id}/{resource}/"
    return f"{base}{pk}/" if pk else base


def test_project_updates_default_disabled_and_admin_toggle_contract(session_client, project, create_user):
    assert Project._meta.get_field("project_updates_view").default is False
    detail = f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/"
    Project.objects.filter(pk=project.pk).update(project_updates_view=False)
    listed = session_client.get(f"/api/workspaces/{project.workspace.slug}/projects/")
    assert listed.status_code == 200, listed.data
    assert next(row for row in listed.data if str(row["id"]) == str(project.id))["project_updates_view"] is False
    for role in (5, 15):
        member_client = client_for(add_member(project, role=role))
        response = member_client.patch(detail, {"project_updates_view": True}, format="json")
        assert response.status_code == 403, response.data
    response = session_client.patch(detail, {"project_updates_view": True}, format="json")
    assert response.status_code == 200 and response.data["project_updates_view"] is True, response.data
    assert session_client.get(detail).data["project_updates_view"] is True
    created = session_client.post(url(project, "updates"), {"body": "Enabled"}, format="json")
    assert created.status_code == 201, created.data
    response = session_client.patch(detail, {"project_updates_view": False}, format="json")
    assert response.status_code == 200 and response.data["project_updates_view"] is False, response.data
    assert ProjectUpdate.objects.get(pk=created.data["id"]).body == "Enabled"


@pytest.mark.parametrize("role,workspace_role", [(15, 15), (20, 15), (5, 20)])
def test_disabled_updates_block_all_writes_and_preserve_existing_data_and_audit(
    session_client, project, create_user, role, workspace_role
):
    author = add_member(project, role=role, workspace_role=workspace_role)
    client = client_for(author)
    existing = ProjectUpdate(project=project, body="Preserved", health="at_risk", created_by=author)
    existing.save(disable_auto_set_user=True)
    Project.objects.filter(pk=project.pk).update(project_updates_view=False)
    count = ProjectActivity.objects.filter(project=project).count()
    operations = [
        ("post", None, {"body": "Blocked"}),
        ("patch", existing.id, {"body": "Blocked"}),
        ("put", existing.id, {"body": "Blocked"}),
        ("delete", existing.id, {}),
    ]
    for method, pk, payload in operations:
        response = getattr(client, method)(url(project, "updates", pk), payload, format="json")
        assert response.status_code == 403, response.data
    existing.refresh_from_db()
    assert existing.body == "Preserved" and existing.health == "at_risk" and existing.deleted_at is None
    assert ProjectActivity.objects.filter(project=project).count() == count
    assert ProjectUpdate.objects.filter(project=project).count() == 1
    # Disabling hides the UI without deleting historical updates; re-enabling restores it.
    Project.objects.filter(pk=project.pk).update(project_updates_view=True)
    assert client.get(url(project, "updates")).data[0]["body"] == "Preserved"
    response = client.patch(url(project, "updates", existing.id), {"body": "Restored"}, format="json")
    assert response.status_code == 200, response.data
    assert ProjectActivity.objects.filter(project=project).count() == count + 1


RESOURCE_CASES = [
    ("links", {"title": "Design", "url": "https://example.com/design"}, {"title": "Specification"}, ProjectLink),
    (
        "updates",
        {"body": "Ready for review", "health": "on_track"},
        {"body": "Shipped", "health": "at_risk"},
        ProjectUpdate,
    ),
]


@pytest.mark.parametrize("resource,payload,changes,model", RESOURCE_CASES)
def test_resource_crud_and_activity_contract(session_client, project, create_user, resource, payload, changes, model):
    response = session_client.post(url(project, resource), payload, format="json")
    assert response.status_code == 201, response.data
    pk = response.data["id"]
    assert str(response.data["created_by"]) == str(create_user.id)
    assert str(response.data["created_by_detail"]["id"]) == str(create_user.id)
    assert str(response.data["project"]) == str(project.id)
    assert str(response.data["workspace"]) == str(project.workspace_id)
    assert session_client.get(url(project, resource, pk)).data["id"] == pk
    listed = session_client.get(url(project, resource))
    assert listed.status_code == 200 and isinstance(listed.data, list)
    assert [row["id"] for row in listed.data] == [pk]
    patched = session_client.patch(url(project, resource, pk), changes, format="json")
    assert patched.status_code == 200, patched.data
    assert all(patched.data[key] == value for key, value in changes.items())
    count = ProjectActivity.objects.filter(project=project).count()
    assert session_client.patch(url(project, resource, pk), changes, format="json").status_code == 200
    assert ProjectActivity.objects.filter(project=project).count() == count
    assert session_client.delete(url(project, resource, pk)).status_code == 204
    assert not model.objects.filter(pk=pk).exists()
    assert model.all_objects.get(pk=pk).deleted_at is not None
    assert session_client.get(url(project, resource)).data == []
    assert session_client.get(url(project, resource, pk)).status_code == 404
    events = session_client.get(url(project, "activities")).data["results"]
    assert [event["verb"] for event in events] == ["deleted", "updated", "added"]
    assert all(str(event["actor_detail"]["id"]) == str(create_user.id) for event in events)
    assert events[0]["old_value"]["id"] == str(pk)
    assert events[-1]["new_value"]["id"] == str(pk)


@pytest.mark.parametrize("resource,payload,changes,model", RESOURCE_CASES)
def test_members_can_create_but_only_owner_or_admin_can_edit(
    session_client, project, resource, payload, changes, model
):
    owner = add_member(project)
    owner_client = client_for(owner)
    created = owner_client.post(url(project, resource), payload, format="json")
    assert created.status_code == 201, created.data
    pk = created.data["id"]
    peer = client_for(add_member(project))
    for method, data in [("patch", changes), ("put", changes), ("delete", {})]:
        assert getattr(peer, method)(url(project, resource, pk), data, format="json").status_code == 403
    assert owner_client.patch(url(project, resource, pk), changes, format="json").status_code == 200
    for role, workspace_role in [(20, 15), (5, 20)]:
        admin = client_for(add_member(project, role=role, workspace_role=workspace_role))
        assert admin.patch(url(project, resource, pk), payload, format="json").status_code == 200
    assert session_client.delete(url(project, resource, pk)).status_code == 204


@pytest.mark.parametrize("resource,payload,changes,model", RESOURCE_CASES)
def test_guests_can_read_resources_but_cannot_create(session_client, project, resource, payload, changes, model):
    created = session_client.post(url(project, resource), payload, format="json")
    guest = client_for(add_member(project, role=5, workspace_role=5))
    assert guest.get(url(project, resource)).status_code == 200
    assert guest.get(url(project, resource, created.data["id"])).status_code == 200
    assert guest.get(url(project, "activities")).status_code == 200
    assert guest.post(url(project, resource), payload, format="json").status_code == 403
    assert guest.patch(url(project, resource, created.data["id"]), changes, format="json").status_code == 403
    assert guest.delete(url(project, resource, created.data["id"])).status_code == 403


@pytest.mark.parametrize("resource,payload,changes,model", RESOURCE_CASES)
@pytest.mark.parametrize("forbidden", ["project", "workspace", "created_by", "updated_by", "deleted_at", "id"])
def test_resource_payload_cannot_reassign_parent_or_ownership(
    session_client, project, create_user, resource, payload, changes, model, forbidden
):
    created = session_client.post(url(project, resource), payload, format="json")
    bad = {forbidden: str(uuid4())}
    assert session_client.post(url(project, resource), {**payload, **bad}, format="json").status_code == 400
    assert session_client.patch(url(project, resource, created.data["id"]), bad, format="json").status_code == 400
    instance = model.objects.get(pk=created.data["id"])
    assert instance.project_id == project.id and instance.created_by_id == create_user.id


@pytest.mark.parametrize(
    "resource,payload",
    [
        ("links", {"title": None, "url": "https://example.com"}),
        ("links", {"title": "x" * 256, "url": "https://example.com"}),
        ("links", {"url": "https://example.com/" + "x" * 2049}),
        ("links", {"title": "Missing URL"}),
        ("links", {"url": ""}),
        ("links", {"title": "File", "url": "file:///etc/passwd"}),
        ("links", {"title": "FTP", "url": "ftp://example.com"}),
        ("links", {"title": "Script", "url": "javascript:alert(1)"}),
        ("links", {"title": "Bad", "url": "not-a-url"}),
        ("updates", {"body": "   ", "health": "on_track"}),
        ("updates", {"body": "Status", "health": "unknown"}),
        ("updates", {"body": "x" * 100001}),
        ("links", []),
        ("updates", "text"),
    ],
)
def test_invalid_resource_payloads(session_client, project, resource, payload):
    response = session_client.post(url(project, resource), payload, format="json")
    assert response.status_code == 400, response.data
    assert not ProjectActivity.objects.filter(project=project).exists()


@pytest.mark.parametrize(
    "title_payload,expected_title",
    [({}, ""), ({"title": ""}, ""), ({"title": " \t\n "}, ""), ({"title": "Docs"}, "Docs")],
)
@pytest.mark.parametrize("scheme", ["http", "https"])
def test_link_optional_title_create_and_audit_contract(
    session_client, project, create_user, title_payload, expected_title, scheme
):
    link_url = f"{scheme}://example.com/docs"
    response = session_client.post(url(project, "links"), {**title_payload, "url": link_url}, format="json")
    assert response.status_code == 201, response.data
    pk = response.data["id"]
    assert response.data["title"] == expected_title
    instance = ProjectLink.objects.get(pk=pk)
    assert instance.title == expected_title and instance.url == link_url
    assert instance.created_by_id == create_user.id
    assert session_client.get(url(project, "links", pk)).data["title"] == expected_title
    assert session_client.get(url(project, "links")).data[0]["title"] == expected_title
    event = ProjectActivity.objects.get(project=project)
    assert event.verb == "added" and event.field == "link"
    assert event.actor_id == create_user.id and event.old_value is None
    assert event.new_value == {"id": str(pk), "title": expected_title, "url": link_url}


@pytest.mark.parametrize("blank_title", ["", " \t\n "])
def test_link_title_can_be_cleared_and_renamed_with_audit(session_client, project, create_user, blank_title):
    link_url = "https://example.com/docs"
    response = session_client.post(url(project, "links"), {"title": "Docs", "url": link_url}, format="json")
    assert response.status_code == 201, response.data
    pk = response.data["id"]
    detail = url(project, "links", pk)
    cleared = session_client.patch(detail, {"title": blank_title}, format="json")
    assert cleared.status_code == 200, cleared.data
    assert cleared.data["title"] == "" and cleared.data["url"] == link_url
    instance = ProjectLink.objects.get(pk=pk)
    assert instance.title == "" and instance.url == link_url
    assert instance.created_by_id == create_user.id and instance.updated_by_id == create_user.id
    event = ProjectActivity.objects.get(project=project, verb="updated")
    assert event.field == "link" and event.actor_id == create_user.id
    assert event.old_value == {"id": str(pk), "title": "Docs", "url": link_url}
    assert event.new_value == {"id": str(pk), "title": "", "url": link_url}
    assert session_client.patch(detail, {"title": blank_title}, format="json").status_code == 200
    assert ProjectActivity.objects.filter(project=project).count() == 2
    renamed = session_client.patch(detail, {"title": "Specification"}, format="json")
    assert renamed.status_code == 200, renamed.data
    instance.refresh_from_db()
    assert instance.title == "Specification" and instance.url == link_url
    renamed_event = ProjectActivity.objects.get(project=project, verb="updated", new_value__title="Specification")
    assert renamed_event.old_value == event.new_value
    assert renamed_event.new_value == {"id": str(pk), "title": "Specification", "url": link_url}
    assert ProjectActivity.objects.filter(project=project).count() == 3


def test_link_validation_does_not_fetch_metadata(session_client, project, mocker):
    get = mocker.patch("requests.get", side_effect=AssertionError("URLs must not be fetched"))
    response = session_client.post(
        url(project, "links"), {"title": "Internal", "url": "https://example.com/private"}, format="json"
    )
    assert response.status_code == 201, response.data
    get.assert_not_called()


@pytest.mark.parametrize("reaction", ["128077", "127462-127464", "👍", "👩‍💻", "❤️", "1️⃣"])
def test_guest_reactions_are_idempotent_and_only_delete_the_requesters_reaction(
    session_client, project, create_user, reaction
):
    guest_user = add_member(project, role=5, workspace_role=5)
    guest = client_for(guest_user)
    first = guest.post(url(project, "reactions"), {"reaction": reaction}, format="json")
    assert first.status_code == 201, first.data
    assert str(first.data["actor_detail"]["id"]) == str(guest_user.id)
    duplicate = guest.post(url(project, "reactions"), {"reaction": reaction}, format="json")
    assert duplicate.status_code == 200 and duplicate.data["id"] == first.data["id"]
    assert ProjectReaction.objects.filter(project=project, actor=guest_user).count() == 1
    assert ProjectActivity.objects.filter(project=project, field="reaction").count() == 1
    own = session_client.post(url(project, "reactions"), {"reaction": reaction}, format="json")
    assert own.status_code == 201
    listed = guest.get(url(project, "reactions"))
    assert isinstance(listed.data, list) and len(listed.data) == 2
    assert listed.data[0]["id"] == own.data["id"]
    assert guest.delete(url(project, "reactions"), {"reaction": reaction}, format="json").status_code == 204
    count = ProjectActivity.objects.filter(project=project).count()
    assert guest.delete(url(project, "reactions"), {"reaction": reaction}, format="json").status_code == 204
    assert ProjectActivity.objects.filter(project=project).count() == count
    assert ProjectReaction.objects.get(project=project).actor_id == create_user.id
    assert guest.post(url(project, "reactions"), {"reaction": reaction}, format="json").status_code == 201


@pytest.mark.parametrize("reaction", ["", "hello", "12345", "1114112", "1f44d", "👍 ", "👍" * 65, None, 128077])
def test_invalid_reactions(session_client, project, reaction):
    for method in ("post", "delete"):
        response = getattr(session_client, method)(url(project, "reactions"), {"reaction": reaction}, format="json")
        assert response.status_code == 400, response.data
    assert not ProjectReaction.objects.filter(project=project).exists()


@pytest.mark.parametrize("resource", ["links", "updates", "reactions", "activities"])
@pytest.mark.parametrize(
    "scope",
    [
        "project_inactive",
        "workspace_inactive",
        "project_deleted",
        "workspace_deleted",
        "no_project_membership",
        "user_inactive",
    ],
)
def test_reads_require_active_scoped_memberships(session_client, project, resource, scope):
    user = add_member(project, workspace_role=20)
    project_member = ProjectMember.objects.get(project=project, member=user)
    workspace_member = WorkspaceMember.objects.get(workspace=project.workspace, member=user)
    if scope == "project_inactive":
        ProjectMember.objects.filter(pk=project_member.pk).update(is_active=False)
    elif scope == "workspace_inactive":
        WorkspaceMember.objects.filter(pk=workspace_member.pk).update(is_active=False)
    elif scope == "no_project_membership":
        ProjectMember.objects.filter(pk=project_member.pk).delete()
    elif scope == "project_deleted":
        Project.objects.filter(pk=project.pk).update(deleted_at=timezone.now())
    elif scope == "workspace_deleted":
        Workspace.objects.filter(pk=project.workspace_id).update(deleted_at=timezone.now())
    else:
        User.objects.filter(pk=user.pk).update(is_active=False)
    assert client_for(user).get(url(project, resource)).status_code in (403, 404)


@pytest.mark.parametrize("resource,payload,changes,model", RESOURCE_CASES)
def test_resource_ids_cannot_cross_project_or_workspace(
    session_client, project, create_user, resource, payload, changes, model
):
    pk = session_client.post(url(project, resource), payload, format="json").data["id"]
    other = Project.objects.create(
        workspace=project.workspace, name="Other", identifier="OTH", project_updates_view=True
    )
    ProjectMember.objects.create(project=other, member=create_user, role=20)
    assert session_client.get(url(other, resource)).data == []
    for method, data in [("get", {}), ("patch", changes), ("delete", {})]:
        assert getattr(session_client, method)(url(other, resource, pk), data, format="json").status_code == 404
    foreign = Workspace.objects.create(name="Foreign", slug="foreign-overview", owner=create_user)
    WorkspaceMember.objects.create(workspace=foreign, member=create_user, role=20)
    assert session_client.get(url(project, resource, slug=foreign.slug)).status_code == 404


@pytest.mark.parametrize("resource,payload,changes,model", RESOURCE_CASES)
def test_archived_resources_are_read_only(session_client, project, resource, payload, changes, model):
    pk = session_client.post(url(project, resource), payload, format="json").data["id"]
    session_client.post(url(project, "reactions"), {"reaction": "128077"}, format="json")
    Project.objects.filter(pk=project.pk).update(archived_at=timezone.now())
    for read in [
        url(project, resource),
        url(project, resource, pk),
        url(project, "reactions"),
        url(project, "activities"),
    ]:
        assert session_client.get(read).status_code == 200
    for method, endpoint, data in [
        ("post", url(project, resource), payload),
        ("patch", url(project, resource, pk), changes),
        ("delete", url(project, resource, pk), {}),
        ("post", url(project, "reactions"), {"reaction": "128077"}),
        ("delete", url(project, "reactions"), {"reaction": "128077"}),
    ]:
        assert getattr(session_client, method)(endpoint, data, format="json").status_code == 400
    assert model.objects.filter(pk=pk).exists()


def test_activity_cursor_pagination_has_stable_tie_breaker(session_client, project, create_user):
    rows = [
        ProjectActivity(project=project, workspace=project.workspace, actor=create_user, verb="updated", field="name")
        for _ in range(5)
    ]
    ProjectActivity.objects.bulk_create(rows)
    ProjectActivity.objects.filter(project=project).update(created_at=timezone.now())
    expected = list(
        ProjectActivity.objects.filter(project=project).order_by("-created_at", "-id").values_list("id", flat=True)
    )
    cursor = None
    seen = []
    for _ in range(3):
        params = {"per_page": 2}
        if cursor:
            params["cursor"] = cursor
        response = session_client.get(url(project, "activities"), params)
        assert response.status_code == 200, response.data
        assert {"results", "next_cursor", "next_page_results"} <= response.data.keys()
        seen.extend(str(row["id"]) for row in response.data["results"])
        cursor = response.data["next_cursor"]
    assert seen == list(map(str, expected))
    assert response.data["next_page_results"] is False
    for params in [{"per_page": 0}, {"per_page": -1}, {"per_page": 101}, {"cursor": "invalid"}]:
        assert session_client.get(url(project, "activities"), params).status_code == 400


@pytest.mark.parametrize("method", ["patch", "put"])
def test_project_planning_changes_are_audited_once(session_client, project, create_user, method):
    label = ProjectCategory.objects.create(workspace=project.workspace, name="Strategic", kind="label")
    state = ProjectCategory.objects.create(workspace=project.workspace, name="Active", kind="status")
    lead = add_member(project)
    values = {
        "name": "Renamed overview",
        "description": "Roadmap",
        "description_text": {"type": "doc", "content": []},
        "description_html": "<p>Rich roadmap</p>",
        "emoji": "128077",
        "icon_prop": {"name": "star"},
        "logo_props": {"name": "star"},
        "cover_image": "https://example.com/cover.png",
        "priority": "high",
        "status": str(state.id),
        "labels": [str(label.id)],
        "project_lead": str(lead.id),
        "start_date": "2026-10-17",
        "target_date": "2026-10-20",
    }
    detail = f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/"
    response = getattr(session_client, method)(detail, values, format="json")
    assert response.status_code == 200, response.data
    events = {row.field: row for row in ProjectActivity.objects.filter(project=project)}
    assert set(events) == set(values)
    assert events["name"].old_value == "Overview" and events["name"].new_value == "Renamed overview"
    assert events["labels"].old_value == [] and events["labels"].new_value == [str(label.id)]
    assert events["status"].new_value == str(state.id)
    assert events["project_lead"].new_value == str(lead.id)
    assert all(row.actor_id == create_user.id and row.verb == "updated" for row in events.values())
    assert getattr(session_client, method)(detail, values, format="json").status_code == 200
    assert ProjectActivity.objects.filter(project=project).count() == len(values)
    cleared = session_client.patch(detail, {"labels": [], "status": None, "project_lead": None}, format="json")
    assert cleared.status_code == 200, cleared.data
    assert ProjectActivity.objects.filter(project=project).count() == len(values) + 3


@pytest.mark.parametrize("method", ["patch", "put"])
def test_project_put_and_patch_share_permissions(session_client, project, method):
    client = client_for(add_member(project))
    detail = f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/"
    assert getattr(client, method)(detail, {"name": "Forbidden"}, format="json").status_code == 403
    assert not ProjectActivity.objects.filter(project=project).exists()


@pytest.mark.parametrize("resource,payload,changes,model", RESOURCE_CASES)
def test_resource_create_rolls_back_when_activity_fails(
    session_client, project, resource, payload, changes, model, mocker
):
    mocker.patch("plane.app.views.project.overview.record_project_activity", side_effect=RuntimeError("Audit failure"))
    response = session_client.post(url(project, resource), payload, format="json")
    assert response.status_code == 500
    assert not model.objects.filter(project=project).exists()
    assert not ProjectActivity.objects.filter(project=project).exists()


@pytest.mark.parametrize("operation", ["patch", "delete"])
def test_mutation_rolls_back_when_activity_fails(session_client, project, mocker, operation):
    pk = session_client.post(url(project, "updates"), {"body": "Original"}, format="json").data["id"]
    mocker.patch("plane.app.views.project.overview.record_project_activity", side_effect=RuntimeError("Audit failure"))
    response = getattr(session_client, operation)(url(project, "updates", pk), {"body": "Changed"}, format="json")
    assert response.status_code == 500
    assert ProjectUpdate.objects.get(pk=pk).body == "Original"
    assert ProjectActivity.objects.filter(project=project).count() == 1


def test_project_change_and_labels_roll_back_when_activity_fails(session_client, project, mocker):
    label = ProjectCategory.objects.create(workspace=project.workspace, name="Rollback", kind="label")
    mocker.patch("plane.app.views.project.overview.record_project_activity", side_effect=RuntimeError("Audit failure"))
    response = session_client.patch(
        f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/",
        {"name": "Must roll back", "labels": [str(label.id)]},
        format="json",
    )
    assert response.status_code == 500
    project.refresh_from_db()
    assert project.name == "Overview" and not project.labels.exists()


def test_reaction_and_audit_roll_back_together(session_client, project, mocker):
    mocker.patch("plane.app.views.project.overview.record_project_activity", side_effect=RuntimeError("Audit failure"))
    response = session_client.post(url(project, "reactions"), {"reaction": "128077"}, format="json")
    assert response.status_code == 500
    assert not ProjectReaction.objects.filter(project=project).exists()


def test_activity_body_is_bounded_and_full_content_change_is_still_detected(session_client, project):
    body = "a" * 1000
    pk = session_client.post(url(project, "updates"), {"body": body}, format="json").data["id"]
    assert (
        session_client.patch(url(project, "updates", pk), {"body": body + "changed"}, format="json").status_code == 200
    )
    assert ProjectActivity.objects.filter(project=project).count() == 2
    for event in ProjectActivity.objects.filter(project=project):
        assert len(event.new_value["body"]) <= 500
    assert ProjectUpdate.objects.get(pk=pk).body == body + "changed"


@pytest.mark.parametrize("title", ["Docs", ""])
def test_link_url_only_patch_records_changed_url(session_client, project, create_user, title):
    response = session_client.post(
        url(project, "links"), {"title": title, "url": "https://example.com/old"}, format="json"
    )
    assert response.status_code == 201, response.data
    pk = response.data["id"]
    detail = url(project, "links", pk)
    patched = session_client.patch(detail, {"url": "https://example.com/new"}, format="json")
    assert patched.status_code == 200, patched.data
    assert patched.data["title"] == title
    instance = ProjectLink.objects.get(pk=pk)
    assert instance.title == title and instance.url == "https://example.com/new"
    assert instance.created_by_id == create_user.id and instance.updated_by_id == create_user.id
    event = ProjectActivity.objects.filter(project=project, verb="updated").get()
    assert event.field == "link" and event.actor_id == create_user.id
    assert event.old_value == {"id": str(pk), "title": title, "url": "https://example.com/old"}
    assert event.new_value == {"id": str(pk), "title": title, "url": "https://example.com/new"}
    assert session_client.patch(detail, {"url": "https://example.com/new"}, format="json").status_code == 200
    assert ProjectActivity.objects.filter(project=project).count() == 2


def test_reaction_delete_rolls_back_on_audit_failure(session_client, project, mocker):
    session_client.post(url(project, "reactions"), {"reaction": "128077"}, format="json")
    mocker.patch("plane.app.views.project.overview.record_project_activity", side_effect=RuntimeError("Audit failure"))
    response = session_client.delete(url(project, "reactions"), {"reaction": "128077"}, format="json")
    assert response.status_code == 500
    assert ProjectReaction.objects.filter(project=project).count() == 1
    assert ProjectActivity.objects.filter(project=project).count() == 1


@pytest.mark.parametrize("membership", ["project", "workspace"])
def test_inactive_members_cannot_mutate_resources(session_client, project, membership):
    owner = add_member(project)
    client = client_for(owner)
    pk = client.post(url(project, "updates"), {"body": "Original"}, format="json").data["id"]
    if membership == "project":
        ProjectMember.objects.filter(project=project, member=owner).update(is_active=False)
    else:
        WorkspaceMember.objects.filter(workspace=project.workspace, member=owner).update(is_active=False)
    operations = [
        ("post", "updates", None, {"body": "Blocked"}),
        ("patch", "updates", pk, {"body": "Blocked"}),
        ("delete", "updates", pk, {}),
        ("post", "reactions", None, {"reaction": "128077"}),
        ("delete", "reactions", None, {"reaction": "128077"}),
    ]
    for method, resource, resource_id, payload in operations:
        assert getattr(client, method)(url(project, resource, resource_id), payload, format="json").status_code == 403
    assert ProjectUpdate.objects.get(pk=pk).body == "Original"


def test_reaction_unique_constraint_and_project_workspace_inheritance(project, create_user):
    first = ProjectReaction(project=project, actor=create_user, reaction="128077")
    first.save()
    assert first.workspace_id == project.workspace_id
    with pytest.raises(IntegrityError), transaction.atomic():
        ProjectReaction(project=project, actor=create_user, reaction="128077").save()
    ProjectReaction.objects.filter(pk=first.pk).delete()
    ProjectReaction(project=project, actor=create_user, reaction="128077").save()
    assert ProjectReaction.objects.filter(project=project).count() == 1


@pytest.mark.parametrize("order_by", [None, "-created_at", "created_at"])
def test_activity_order_is_stable_across_next_and_previous_pages(session_client, project, create_user, order_by):
    # Deliberately mix timestamps and IDs, including a tie spanning page boundaries.
    timestamp = timezone.now()
    entries = [
        (timestamp + timedelta(days=day), UUID(int=index + 1)) for index, day in enumerate([2, 0, 1, 1, 1, 2, 0])
    ]
    ProjectActivity.objects.bulk_create(
        [
            ProjectActivity(
                id=activity_id,
                project=project,
                workspace=project.workspace,
                actor=create_user,
                verb="updated",
                field="name",
            )
            for _, activity_id in entries
        ]
    )
    for created_at, activity_id in entries:
        ProjectActivity.objects.filter(pk=activity_id).update(created_at=created_at)
    expected = [str(activity_id) for _, activity_id in sorted(entries, reverse=order_by != "created_at")]
    params = {"per_page": 2}
    if order_by is not None:
        params["order_by"] = order_by
    pages = []
    for index in range(4):
        response = session_client.get(url(project, "activities"), params)
        assert response.status_code == 200, response.data
        page = response.data
        ids = [str(row["id"]) for row in page["results"]]
        assert ids == expected[index * 2 : index * 2 + 2]
        assert page["next_page_results"] is (index < 3)
        assert page["prev_page_results"] is (index > 0)
        if index:
            previous = session_client.get(url(project, "activities"), {**params, "cursor": page["prev_cursor"]})
            assert previous.status_code == 200, previous.data
            assert [str(row["id"]) for row in previous.data["results"]] == pages[-1]
        pages.append(ids)
        params["cursor"] = page["next_cursor"]
    assert [activity_id for page in pages for activity_id in page] == expected


@pytest.mark.parametrize("order_by", ["", "id", "-id", "updated_at", "created_at,id", "actor__email"])
def test_activity_rejects_unsupported_order_fields(session_client, project, order_by):
    response = session_client.get(url(project, "activities"), {"order_by": order_by})
    assert response.status_code == 400, response.data
    assert str(response.data["detail"]) == "order_by must be '-created_at' or 'created_at'."
