# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from plane.db.models import (
    FileAsset,
    Issue,
    Project,
    ProjectActivity,
    ProjectMember,
    ProjectReaction,
    ProjectUpdate,
    ProjectUpdateComment,
    ProjectUpdateReaction,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.tests.contract.app.test_project_overview import add_member, client_for, url

pytestmark = [pytest.mark.django_db, pytest.mark.contract]


@pytest.fixture
def project(workspace, create_user):
    instance = Project.objects.create(
        name="Update details", identifier="UPD", workspace=workspace, network=0, project_updates_view=True
    )
    ProjectMember.objects.create(project=instance, member=create_user, role=20)
    return instance


def child_url(project, update, resource, child=None):
    base = f"{url(project, 'updates', update.id)}{resource}/"
    return f"{base}{child}/" if child else base


@pytest.fixture
def update(session_client, project):
    response = session_client.post(url(project, "updates"), {"body": "Published"}, format="json")
    assert response.status_code == 201, response.data
    return ProjectUpdate.objects.get(pk=response.data["id"])


def test_publication_snapshot_matches_visible_issues_and_is_immutable(session_client, project):
    states = {
        group: State.objects.create(project=project, name=group, group=group, color="#60646C")
        for group in ["backlog", "unstarted", "started", "completed", "cancelled", "triage"]
    }
    for group in states:
        Issue.objects.create(project=project, name=group, state=states[group])
    for excluded in ["draft", "archived", "deleted"]:
        issue = Issue.objects.create(project=project, name=excluded, state=states["completed"])
        values = {
            "draft": {"is_draft": True},
            "archived": {"archived_at": timezone.now().date()},
            "deleted": {"deleted_at": timezone.now()},
        }
        Issue.objects.filter(pk=issue.pk).update(**values[excluded])
    other = Project.objects.create(workspace=project.workspace, name="Other", identifier="OTH")
    Issue.objects.create(project=other, name="Foreign issue")
    first = session_client.post(url(project, "updates"), {"body": "Snapshot"}, format="json")
    assert first.status_code == 201, first.data
    assert first.data["progress"] == {"completed": 1, "total": 4}
    assert first.data["progress_source"] == "snapshot"
    assert first.data["comment_count"] == 0 and first.data["reactions"] == []
    Issue.objects.filter(project=project, state=states["started"]).update(state=states["completed"])
    second = session_client.post(url(project, "updates"), {"body": "New snapshot"}, format="json")
    assert second.data["progress"] == {"completed": 2, "total": 4}
    patched = session_client.patch(
        url(project, "updates", first.data["id"]), {"body": "Edited", "health": "at_risk"}, format="json"
    )
    assert patched.status_code == 200, patched.data
    assert patched.data["progress"] == first.data["progress"]
    assert patched.data["progress_source"] == "snapshot"
    assert session_client.get(url(project, "updates", first.data["id"])).data["progress"] == first.data["progress"]
    assert ProjectUpdate.objects.get(pk=first.data["id"]).progress == first.data["progress"]


def test_historical_updates_read_current_progress_but_keep_database_null(session_client, project, create_user):
    historical = ProjectUpdate(project=project, body="Historical", created_by=create_user)
    historical.save(disable_auto_set_user=True)
    assert historical.progress is None
    listed = session_client.get(url(project, "updates")).data[0]
    assert listed["progress"] == {"completed": 0, "total": 0}
    assert listed["progress_source"] == "current"
    done = State.objects.create(project=project, name="Done", group="completed", color="#60646C")
    cancelled = State.objects.create(project=project, name="Cancelled", group="cancelled", color="#60646C")
    Issue.objects.create(project=project, name="Completed", state=done)
    Issue.objects.create(project=project, name="Cancelled", state=cancelled)
    Issue.objects.create(project=project, name="Draft", state=done, is_draft=True)
    Issue.objects.create(project=project, name="Archived", state=done, archived_at=timezone.now().date())
    detail = session_client.get(url(project, "updates", historical.id)).data
    assert detail["progress"] == {"completed": 1, "total": 1}
    assert detail["progress_source"] == "current"
    patched = session_client.patch(url(project, "updates", historical.id), {"body": "Edited"}, format="json")
    assert patched.status_code == 200 and patched.data["progress"] == detail["progress"]
    assert patched.data["progress_source"] == "current"
    assert patched.data["comment_count"] == 0 and patched.data["reactions"] == []
    historical.refresh_from_db()
    assert historical.progress is None


def test_guest_comments_contract_counts_and_owner_deletion(session_client, project, update):
    author = add_member(project, role=5, workspace_role=5)
    guest = client_for(author)
    comments_url = child_url(project, update, "comments")
    count = ProjectActivity.objects.filter(project=project).count()
    response = guest.post(comments_url, {"body": "Guest comment"}, format="json")
    assert response.status_code == 201, response.data
    assert set(response.data) == {"id", "body", "created_by", "created_by_detail", "created_at", "updated_at"}
    assert str(response.data["created_by"]) == str(author.id)
    assert str(response.data["created_by_detail"]["id"]) == str(author.id)
    second = session_client.post(comments_url, {"body": "Admin comment"}, format="json")
    assert guest.get(comments_url).data == [response.data, second.data]
    detail = url(project, "updates", update.id)
    assert guest.get(detail).data["comment_count"] == 2
    patched = session_client.patch(detail, {"body": "Edited"}, format="json")
    assert patched.status_code == 200 and patched.data["comment_count"] == 2
    assert guest.delete(child_url(project, update, "comments", second.data["id"])).status_code == 403
    assert guest.delete(child_url(project, update, "comments", response.data["id"])).status_code == 204
    assert guest.get(comments_url).data == [second.data]
    assert guest.get(url(project, "updates")).data[0]["comment_count"] == 1
    assert ProjectUpdateComment.all_objects.get(pk=response.data["id"]).deleted_at is not None
    # Only the update edit records an activity; discussion actions do not duplicate it.
    assert ProjectActivity.objects.filter(project=project).count() == count + 1


@pytest.mark.parametrize("role,workspace_role", [(20, 15), (5, 20)])
def test_project_or_workspace_admin_can_delete_other_comment(session_client, project, update, role, workspace_role):
    created = session_client.post(child_url(project, update, "comments"), {"body": "Comment"}, format="json")
    admin = client_for(add_member(project, role=role, workspace_role=workspace_role))
    assert admin.delete(child_url(project, update, "comments", created.data["id"])).status_code == 204
    assert not ProjectUpdateComment.objects.filter(pk=created.data["id"]).exists()


def test_comment_author_can_edit_without_changing_identity_or_count(session_client, project, update):
    author = add_member(project, role=5, workspace_role=5)
    guest = client_for(author)
    created = guest.post(child_url(project, update, "comments"), {"body": "Original"}, format="json")
    endpoint = child_url(project, update, "comments", created.data["id"])
    activity_count = ProjectActivity.objects.filter(project=project).count()
    patched = guest.patch(endpoint, {"body": "  Edited\ncomment  "}, format="json")
    assert patched.status_code == 200, patched.data
    assert set(patched.data) == set(created.data)
    assert patched.data["body"] == "Edited\ncomment"
    assert patched.data["created_by"] == created.data["created_by"]
    assert patched.data["created_by_detail"] == created.data["created_by_detail"]
    assert patched.data["created_at"] == created.data["created_at"]
    saved = ProjectUpdateComment.objects.get(pk=created.data["id"])
    assert saved.body == "Edited\ncomment" and saved.updated_by_id == author.id
    assert guest.get(url(project, "updates", update.id)).data["comment_count"] == 1
    assert ProjectActivity.objects.filter(project=project).count() == activity_count
    unchanged = guest.patch(endpoint, {}, format="json")
    assert unchanged.status_code == 200 and unchanged.data["updated_at"] == patched.data["updated_at"]
    assert guest.delete(endpoint).status_code == 204
    assert guest.patch(endpoint, {"body": "Deleted"}, format="json").status_code == 404


@pytest.mark.parametrize("role,workspace_role", [(15, 15), (20, 15), (5, 20)])
def test_only_author_can_edit_comment_even_for_admins(session_client, project, update, role, workspace_role):
    created = session_client.post(child_url(project, update, "comments"), {"body": "Original"}, format="json")
    client = client_for(add_member(project, role=role, workspace_role=workspace_role))
    response = client.patch(
        child_url(project, update, "comments", created.data["id"]), {"body": "Forbidden"}, format="json"
    )
    assert response.status_code == 403, response.data
    assert ProjectUpdateComment.objects.get(pk=created.data["id"]).body == "Original"


@pytest.mark.parametrize(
    "payload",
    [
        {"body": ""},
        {"body": " \t\n"},
        {"body": None},
        {"body": "x" * 100001},
        {"created_by": str(uuid4())},
        {"update": str(uuid4())},
        {"project": str(uuid4())},
        {"workspace": str(uuid4())},
    ],
)
def test_comment_patch_validates_body_and_rejects_ownership_or_parent_changes(session_client, project, update, payload):
    created = session_client.post(child_url(project, update, "comments"), {"body": "Original"}, format="json")
    response = session_client.patch(child_url(project, update, "comments", created.data["id"]), payload, format="json")
    assert response.status_code == 400, response.data
    assert ProjectUpdateComment.objects.get(pk=created.data["id"]).body == "Original"


def test_comment_verbs_are_limited_to_their_routes(session_client, project, update):
    collection = child_url(project, update, "comments")
    created = session_client.post(collection, {"body": "Comment"}, format="json")
    detail = child_url(project, update, "comments", created.data["id"])
    assert session_client.patch(collection, {"body": "Edited"}, format="json").status_code == 405
    assert session_client.put(detail, {"body": "Edited"}, format="json").status_code == 405
    assert session_client.post(detail, {"body": "Extra"}, format="json").status_code == 405
    assert session_client.get(detail).status_code == 405


@pytest.mark.parametrize("reaction", ["128077", "127462-127464", "👍", "👩‍💻", "❤️", "1️⃣"])
def test_update_reactions_are_scoped_idempotent_and_do_not_write_project_activity(
    session_client, project, update, reaction
):
    guest_user = add_member(project, role=5, workspace_role=5)
    guest = client_for(guest_user)
    endpoint = child_url(project, update, "reactions")
    activity_count = ProjectActivity.objects.filter(project=project).count()
    created = guest.post(endpoint, {"reaction": reaction}, format="json")
    assert created.status_code == 201, created.data
    assert str(created.data["actor"]) == str(guest_user.id)
    assert str(created.data["actor_detail"]["id"]) == str(guest_user.id)
    from plane.app.serializers.project_overview import ProjectReactionSerializer

    assert set(created.data) == set(ProjectReactionSerializer().fields)
    duplicate = guest.post(endpoint, {"reaction": reaction}, format="json")
    assert duplicate.status_code == 200 and duplicate.data == created.data
    own = session_client.post(endpoint, {"reaction": reaction}, format="json")
    listed = guest.get(url(project, "updates", update.id)).data
    assert listed["reactions"] == [own.data, created.data]
    patched = session_client.patch(url(project, "updates", update.id), {"body": update.body}, format="json")
    assert patched.data["reactions"] == listed["reactions"]
    assert guest.delete(endpoint, {"reaction": reaction}, format="json").status_code == 204
    assert guest.delete(endpoint, {"reaction": reaction}, format="json").status_code == 204
    assert session_client.get(url(project, "updates")).data[0]["reactions"] == [own.data]
    assert ProjectActivity.objects.filter(project=project).count() == activity_count
    assert not ProjectReaction.objects.filter(project=project).exists()
    assert guest.post(endpoint, {"reaction": reaction}, format="json").status_code == 201


@pytest.mark.parametrize("reaction", ["", "hello", "12345", "1114112", "👍 ", "👍" * 65, None, 128077])
def test_invalid_update_reactions(session_client, project, update, reaction):
    for method in ["post", "delete"]:
        response = getattr(session_client, method)(
            child_url(project, update, "reactions"), {"reaction": reaction}, format="json"
        )
        assert response.status_code == 400, response.data
    assert not ProjectUpdateReaction.objects.filter(update=update).exists()


@pytest.mark.parametrize("body", ["", " \t\n", None, "x" * 100001])
def test_invalid_update_comments(session_client, project, update, body):
    response = session_client.post(child_url(project, update, "comments"), {"body": body}, format="json")
    assert response.status_code == 400, response.data
    assert not ProjectUpdateComment.objects.filter(update=update).exists()


@pytest.mark.parametrize("scope", ["other_update", "other_project", "other_workspace", "deleted_update"])
def test_children_never_cross_parent_scope(session_client, project, update, create_user, scope):
    comment = session_client.post(child_url(project, update, "comments"), {"body": "Private"}, format="json")
    session_client.post(child_url(project, update, "reactions"), {"reaction": "128077"}, format="json")
    target_project, target_update = project, update
    if scope == "other_update":
        target_update = ProjectUpdate.objects.create(project=project, body="Other")
    elif scope == "other_project":
        target_project = Project.objects.create(
            workspace=project.workspace, name="Other", identifier="OTH", project_updates_view=True
        )
        ProjectMember.objects.create(project=target_project, member=create_user, role=20)
    elif scope == "other_workspace":
        workspace = Workspace.objects.create(name="Foreign", slug="foreign-updates", owner=create_user)
        WorkspaceMember.objects.create(workspace=workspace, member=create_user, role=20)
        target_project = Project.objects.create(
            workspace=workspace, name="Foreign", identifier="FOR", project_updates_view=True
        )
        ProjectMember.objects.create(project=target_project, member=create_user, role=20)
    else:
        assert session_client.delete(url(project, "updates", update.id)).status_code == 204
    assert (
        session_client.delete(child_url(target_project, target_update, "comments", comment.data["id"])).status_code
        == 404
    )
    assert (
        session_client.patch(
            child_url(target_project, target_update, "comments", comment.data["id"]),
            {"body": "Forbidden"},
            format="json",
        ).status_code
        == 404
    )
    if scope == "other_update":
        detail = session_client.get(url(project, "updates", target_update.id)).data
        assert detail["comment_count"] == 0 and detail["reactions"] == []
        assert session_client.get(child_url(project, target_update, "comments")).data == []
        assert (
            session_client.delete(
                child_url(project, target_update, "reactions"), {"reaction": "128077"}, format="json"
            ).status_code
            == 204
        )
        assert ProjectUpdateReaction.objects.filter(update=update).count() == 1
    else:
        for method, resource, payload in [
            ("get", "comments", {}),
            ("post", "comments", {"body": "Blocked"}),
            ("post", "reactions", {"reaction": "128077"}),
            ("delete", "reactions", {"reaction": "128077"}),
        ]:
            response = getattr(session_client, method)(
                child_url(target_project, target_update, resource), payload, format="json"
            )
            assert response.status_code == 404, response.data


@pytest.mark.parametrize(
    "scope",
    [
        "project_inactive",
        "workspace_inactive",
        "no_project",
        "user_inactive",
        "project_deleted",
        "workspace_deleted",
        "archived",
        "disabled",
    ],
)
def test_child_permissions_apply_to_every_read_and_write(session_client, project, update, scope):
    member = add_member(project, role=5, workspace_role=5)
    client = client_for(member)
    comment = client.post(child_url(project, update, "comments"), {"body": "Existing"}, format="json")
    client.post(child_url(project, update, "reactions"), {"reaction": "128077"}, format="json")
    if scope == "project_inactive":
        ProjectMember.objects.filter(project=project, member=member).update(is_active=False)
    elif scope == "workspace_inactive":
        WorkspaceMember.objects.filter(workspace=project.workspace, member=member).update(is_active=False)
    elif scope == "no_project":
        ProjectMember.objects.filter(project=project, member=member).delete()
    elif scope == "user_inactive":
        User.objects.filter(pk=member.pk).update(is_active=False)
    elif scope == "project_deleted":
        Project.objects.filter(pk=project.pk).update(deleted_at=timezone.now())
    elif scope == "workspace_deleted":
        Workspace.objects.filter(pk=project.workspace_id).update(deleted_at=timezone.now())
    elif scope == "archived":
        Project.objects.filter(pk=project.pk).update(archived_at=timezone.now())
    else:
        Project.objects.filter(pk=project.pk).update(project_updates_view=False)
    expected = 400 if scope == "archived" else 404 if scope.endswith("deleted") else 403
    read_status = 200 if scope in ["archived", "disabled"] else expected
    assert client.get(child_url(project, update, "comments")).status_code == read_status
    operations = [
        ("post", child_url(project, update, "comments"), {"body": "Blocked"}),
        ("delete", child_url(project, update, "comments", comment.data["id"]), {}),
        ("patch", child_url(project, update, "comments", comment.data["id"]), {"body": "Blocked"}),
        ("post", child_url(project, update, "reactions"), {"reaction": "❤️"}),
        ("delete", child_url(project, update, "reactions"), {"reaction": "128077"}),
    ]
    for method, endpoint, payload in operations:
        response = getattr(client, method)(endpoint, payload, format="json")
        assert response.status_code == expected, response.data
    assert ProjectUpdateComment.objects.filter(update=update).count() == 1
    assert ProjectUpdateReaction.objects.filter(update=update).count() == 1


def test_reaction_uniqueness_is_per_update_and_allows_recreation(project, update, create_user):
    reaction = ProjectUpdateReaction(project=project, update=update, actor=create_user, reaction="128077")
    reaction.save()
    assert reaction.workspace_id == project.workspace_id
    with pytest.raises(IntegrityError), transaction.atomic():
        ProjectUpdateReaction(project=project, update=update, actor=create_user, reaction="128077").save()
    other_update = ProjectUpdate.objects.create(project=project, body="Other")
    ProjectUpdateReaction.objects.create(project=project, update=other_update, actor=create_user, reaction="128077")
    ProjectUpdateReaction.objects.filter(pk=reaction.pk).delete()
    ProjectUpdateReaction.objects.create(project=project, update=update, actor=create_user, reaction="128077")
    assert ProjectUpdateReaction.objects.filter(project=project).count() == 2


def test_list_queries_stay_constant_with_comments_reactions_and_avatar_assets(
    session_client, project, update, django_assert_num_queries
):
    def discussion(entry):
        author = add_member(project)
        asset = FileAsset.objects.create(
            workspace=project.workspace,
            asset=f"{project.workspace_id}/{uuid4()}.png",
            user=author,
            entity_type=FileAsset.EntityTypeContext.USER_AVATAR,
            is_uploaded=True,
        )
        User.objects.filter(pk=author.pk).update(avatar_asset=asset)
        ProjectUpdate.objects.filter(pk=entry.pk).update(created_by=author)
        comment = ProjectUpdateComment(project=project, update=entry, body="Comment", created_by=author)
        comment.save(disable_auto_set_user=True)
        ProjectUpdateReaction.objects.create(project=project, update=entry, actor=author, reaction="128077")
        return asset

    asset = discussion(update)
    # Warm up URL resolution and any request-level lazy setup before counting.
    session_client.get(url(project, "updates"))
    with django_assert_num_queries(5):
        response = session_client.get(url(project, "updates"))
    assert response.data[0]["comment_count"] == 1
    assert response.data[0]["created_by_detail"]["avatar_url"].endswith(f"/{asset.id}/")
    assert response.data[0]["reactions"][0]["actor_detail"]["avatar_url"].endswith(f"/{asset.id}/")
    discussion(ProjectUpdate.objects.create(project=project, body="Historical"))
    with django_assert_num_queries(6):
        mixed = session_client.get(url(project, "updates"))
    assert {row["progress_source"] for row in mixed.data} == {"snapshot", "current"}
    for index in range(3):
        discussion(ProjectUpdate.objects.create(project=project, body=f"Update {index}"))
    with django_assert_num_queries(6):
        listed = session_client.get(url(project, "updates"))
    assert len(listed.data) == 5
    assert all(row["progress"] == {"completed": 0, "total": 0} for row in listed.data)
    assert ProjectUpdate.objects.filter(project=project, progress__isnull=True).count() == 4
    assert all(row["comment_count"] == 1 and len(row["reactions"]) == 1 for row in listed.data)
    # Soft-deleted comments and reactions must disappear from aggregates/prefetches.
    ProjectUpdateComment.objects.filter(update=update).delete()
    ProjectUpdateReaction.objects.filter(update=update).delete()
    detail = session_client.get(url(project, "updates", update.id)).data
    assert detail["comment_count"] == 0 and detail["reactions"] == []
