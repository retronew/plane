from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest

from plane.db.models import Issue, IssueType, Project, ProjectIssueType, ProjectMember, State

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def bulk_search_ctx(workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    monkeypatch.setattr("plane.bgtasks.issue_activities_task.issue_activity.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Bulk search", identifier="BLS")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    types = [IssueType.objects.create(workspace=workspace, name=f"Bulk level {n}") for n in range(3)]
    for n, issue_type in enumerate(types):
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, level=n, is_default=n == 1)
    return SimpleNamespace(project=project, workspace=workspace, state=state, types=types)


def make_item(ctx, level=0, parent=None):
    return Issue.objects.create(
        project=ctx.project,
        state=ctx.state,
        type=ctx.types[level] if level is not None else None,
        parent=parent,
        name=f"Candidate {level}",
    )


def bulk_route(ctx, parent, surface):
    if surface == "app":
        return (
            f"/api/workspaces/{ctx.workspace.slug}/projects/{ctx.project.pk}/issues/{parent.pk}/sub-issues/",
            "sub_issue_ids",
        )
    return (
        f"/api/v1/workspaces/{ctx.workspace.slug}/projects/{ctx.project.pk}/work-items/{parent.pk}/sub-items/",
        "sub_work_item_ids",
    )


def search_url(ctx):
    return f"/api/workspaces/{ctx.workspace.slug}/projects/{ctx.project.pk}/search-issues/"


@pytest.mark.parametrize("surface", ["app", "public"])
@pytest.mark.parametrize("bad_kind", ["malformed", "missing", "foreign"])
def test_bulk_invalid_ids_are_atomic(bulk_search_ctx, session_client, api_key_client, surface, bad_kind):
    ctx = bulk_search_ctx
    parent, child = make_item(ctx), make_item(ctx)
    if bad_kind == "foreign":
        foreign_project = Project.objects.create(workspace=ctx.workspace, name="Foreign bulk", identifier="FBL")
        bad_id = str(Issue.objects.create(project=foreign_project, name="Foreign").pk)
    else:
        bad_id = "invalid-uuid" if bad_kind == "malformed" else str(uuid4())
    url, key = bulk_route(ctx, parent, surface)
    client = session_client if surface == "app" else api_key_client
    response = client.post(url, {key: [str(child.pk), bad_id]}, format="json")
    assert response.status_code == 400, response.data
    assert "HIERARCHY_INVALID_ISSUE" in str(response.data)
    child.refresh_from_db()
    assert child.parent_id is None


@pytest.mark.parametrize("surface", ["app", "public"])
def test_bulk_disabled_rejects_deep_cycle(bulk_search_ctx, session_client, api_key_client, surface):
    ctx = bulk_search_ctx
    root = make_item(ctx)
    middle = make_item(ctx, parent=root)
    leaf = make_item(ctx, parent=middle)
    independent = make_item(ctx)
    url, key = bulk_route(ctx, leaf, surface)
    client = session_client if surface == "app" else api_key_client
    response = client.post(url, {key: [str(independent.pk), str(root.pk)]}, format="json")
    assert response.status_code == 400, response.data
    assert "HIERARCHY_CYCLE" in str(response.data)
    root.refresh_from_db()
    independent.refresh_from_db()
    assert root.parent_id is None and independent.parent_id is None


@pytest.mark.parametrize("surface", ["app", "public"])
@pytest.mark.parametrize("child_level,valid", [(1, True), (2, False), (0, False)])
def test_bulk_enforces_levels_atomically(bulk_search_ctx, session_client, api_key_client, surface, child_level, valid):
    ctx = bulk_search_ctx
    ctx.project.hierarchy_enabled = True
    ctx.project.save(update_fields=["hierarchy_enabled"])
    parent = make_item(ctx, 2)
    good = make_item(ctx, 1)
    other = make_item(ctx, child_level)
    url, key = bulk_route(ctx, parent, surface)
    client = session_client if surface == "app" else api_key_client
    response = client.post(url, {key: [str(good.pk), str(other.pk)]}, format="json")
    assert response.status_code == (200 if valid else 400), response.data
    good.refresh_from_db()
    other.refresh_from_db()
    assert good.parent_id == (parent.pk if valid else None)
    assert other.parent_id == (parent.pk if valid else None)


def test_search_excludes_full_cycle_paths(bulk_search_ctx, session_client):
    ctx = bulk_search_ctx
    root = make_item(ctx)
    middle = make_item(ctx, parent=root)
    leaf = make_item(ctx, parent=middle)
    independent = make_item(ctx)
    response = session_client.get(search_url(ctx), {"parent": "true", "issue_id": str(root.pk)})
    assert response.status_code == 200, response.data
    assert {str(row["id"]) for row in response.data} == {str(independent.pk)}
    response = session_client.get(search_url(ctx), {"sub_issue": "true", "issue_id": str(leaf.pk)})
    assert response.status_code == 200, response.data
    assert {str(row["id"]) for row in response.data} == {str(independent.pk)}


def test_search_final_type_null_existing_and_default(bulk_search_ctx, session_client):
    ctx = bulk_search_ctx
    ctx.project.hierarchy_enabled = True
    ctx.project.save(update_fields=["hierarchy_enabled"])
    low, middle, high = [make_item(ctx, n) for n in range(3)]
    url = search_url(ctx)
    response = session_client.get(url, {"parent": "true", "type_id": "null"})
    assert response.status_code == 200, response.data
    assert {str(row["id"]) for row in response.data} == {str(middle.pk)}
    assert all(str(row["type_id"]) == str(ctx.types[1].pk) and row["level"] == 1 for row in response.data)
    response = session_client.get(url, {"parent": "true", "issue_id": str(low.pk)})
    assert response.status_code == 200, response.data
    assert {str(row["id"]) for row in response.data} == {str(middle.pk)}
    response = session_client.get(url, {"parent": "true"})
    assert response.status_code == 200, response.data
    assert {str(row["id"]) for row in response.data} == {str(high.pk)}
    response = session_client.get(url, {"sub_issue": "true", "issue_id": str(high.pk), "type_id": "null"})
    assert response.status_code == 200, response.data
    assert list(response.data) == []


def test_search_normal_relations_ignore_hierarchy(bulk_search_ctx, session_client):
    ctx = bulk_search_ctx
    ctx.project.hierarchy_enabled = True
    ctx.project.save(update_fields=["hierarchy_enabled"])
    current = make_item(ctx, 0)
    same_level = make_item(ctx, 0)
    high = make_item(ctx, 2)
    response = session_client.get(search_url(ctx), {"issue_relation": "true", "issue_id": str(current.pk)})
    assert response.status_code == 200, response.data
    assert {str(row["id"]) for row in response.data} == {str(same_level.pk), str(high.pk)}
