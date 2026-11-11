"""Contract for direct-only and recursive task-detail sub-issue reads."""

from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from plane.db.models import Issue, Project, ProjectMember, State, Workspace

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def subtree(workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Subtree", identifier="SUB")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    root = Issue.objects.create(project=project, state=state, name="Root")
    child = Issue.objects.create(project=project, state=state, name="Child", parent=root)
    grandchild = Issue.objects.create(project=project, state=state, name="Grandchild", parent=child)
    return SimpleNamespace(
        workspace=workspace, project=project, state=state, root=root, child=child, grandchild=grandchild
    )


def route(ctx, root_id=None):
    return f"/api/workspaces/{ctx.workspace.slug}/projects/{ctx.project.pk}/issues/{root_id or ctx.root.pk}/sub-issues/"


def ids(response):
    assert response.status_code == 200, response.data
    return {str(row["id"]) for row in response.data["sub_issues"]}


@pytest.mark.parametrize("params", [{}, {"include_descendants": "false"}])
def test_direct_reads_remain_compatible(subtree, session_client, params):
    response = session_client.get(route(subtree), params)
    assert ids(response) == {str(subtree.child.pk)}
    assert set(response.data) == {"sub_issues", "state_distribution"}
    assert response.data["state_distribution"] == {"backlog": [str(subtree.child.pk)]}


@pytest.mark.parametrize("updates", [{"is_draft": True}, {"archived_at": "2026-11-01"}])
def test_legacy_direct_reads_under_hidden_roots_are_preserved(subtree, session_client, updates):
    Issue.objects.filter(pk=subtree.root.pk).update(**updates)
    assert ids(session_client.get(route(subtree))) == {str(subtree.child.pk)}


def test_recursive_reads_preserve_parents_order_and_direct_progress(subtree, session_client):
    ctx = subtree
    completed = State.objects.create(project=ctx.project, name="Done", group="completed")
    Issue.objects.filter(pk=ctx.grandchild.pk).update(state=completed)
    response = session_client.get(route(ctx), {"include_descendants": "true", "order_by": "created_at"})
    assert ids(response) == {str(ctx.child.pk), str(ctx.grandchild.pk)}
    rows = response.data["sub_issues"]
    assert [str(row["id"]) for row in rows] == [str(ctx.child.pk), str(ctx.grandchild.pk)]
    assert [str(row["parent_id"]) for row in rows] == [str(ctx.root.pk), str(ctx.child.pk)]
    assert response.data["state_distribution"] == {"backlog": [str(ctx.child.pk)]}
    assert set(response.data) == {"sub_issues", "state_distribution"}


@pytest.mark.parametrize("recursive", [False, True])
def test_grouping_is_preserved(subtree, session_client, recursive):
    response = session_client.get(
        route(subtree), {"include_descendants": str(recursive).lower(), "group_by": "state_group"}
    )
    assert response.status_code == 200, response.data
    expected = {str(subtree.child.pk)}
    if recursive:
        expected.add(str(subtree.grandchild.pk))
    assert {str(row["id"]) for row in response.data["sub_issues"]["backlog"]} == expected
    assert response.data["state_distribution"] == {"backlog": [str(subtree.child.pk)]}


@pytest.mark.parametrize("hidden", ["deleted", "archived", "draft", "triage"])
def test_hidden_nodes_cut_off_the_entire_branch(subtree, session_client, hidden):
    ctx = subtree
    updates = {
        "deleted": {"deleted_at": timezone.now()},
        "archived": {"archived_at": timezone.now()},
        "draft": {"is_draft": True},
    }
    if hidden == "triage":
        triage = State.objects.create(project=ctx.project, name="Triage", group="triage")
        updates[hidden] = {"state": triage}
    Issue.all_objects.filter(pk=ctx.child.pk).update(**updates[hidden])
    visible = Issue.objects.create(project=ctx.project, state=ctx.state, name="Visible", parent=ctx.root)
    response = session_client.get(route(ctx), {"include_descendants": "true"})
    assert ids(response) == {str(visible.pk)}
    assert response.data["state_distribution"] == {"backlog": [str(visible.pk)]}
    Issue.all_objects.filter(pk=ctx.root.pk).update(**updates[hidden])
    response = session_client.get(route(ctx), {"include_descendants": "true"})
    if hidden == "archived":
        assert ids(response) == {str(visible.pk)}
        assert response.data["state_distribution"] == {"backlog": [str(visible.pk)]}
    else:
        assert ids(response) == set()
        assert response.data["state_distribution"] == {}


def test_archived_root_returns_visible_descendants_but_stops_at_archived_branches(subtree, session_client):
    ctx = subtree
    Issue.objects.filter(pk=ctx.root.pk).update(archived_at=timezone.now().date())
    hidden = Issue.objects.create(project=ctx.project, state=ctx.state, name="Archived branch", parent=ctx.root)
    Issue.objects.create(project=ctx.project, state=ctx.state, name="Hidden descendant", parent=hidden)
    Issue.objects.filter(pk=hidden.pk).update(archived_at=timezone.now().date())
    response = session_client.get(route(ctx), {"include_descendants": "true"})
    assert ids(response) == {str(ctx.child.pk), str(ctx.grandchild.pk)}
    assert response.data["state_distribution"] == {"backlog": [str(ctx.child.pk)]}
    assert {str(row["id"]): str(row["parent_id"]) for row in response.data["sub_issues"]} == {
        str(ctx.child.pk): str(ctx.root.pk),
        str(ctx.grandchild.pk): str(ctx.child.pk),
    }


@pytest.mark.parametrize("recursive", [False, True])
@pytest.mark.parametrize("foreign_workspace", [False, True])
def test_root_must_belong_to_url_project_and_workspace(
    subtree, session_client, create_user, recursive, foreign_workspace
):
    ctx = subtree
    workspace = (
        Workspace.objects.create(name="Other", slug="other-subtree", owner=create_user)
        if foreign_workspace
        else ctx.workspace
    )
    foreign = Project.objects.create(workspace=workspace, name="Foreign", identifier="FOR")
    root = Issue.objects.create(project=foreign, name="Foreign root")
    # Malicious legacy edge: the child is local but its parent is foreign.
    Issue.objects.filter(pk=ctx.child.pk).update(parent=root)
    response = session_client.get(route(ctx, root.pk), {"include_descendants": str(recursive).lower()})
    assert ids(response) == set()
    assert response.data["state_distribution"] == {}


def test_recursive_reads_do_not_cross_foreign_branches(subtree, session_client):
    ctx = subtree
    foreign = Project.objects.create(workspace=ctx.workspace, name="Foreign branch", identifier="FBR")
    bridge = Issue.objects.create(project=foreign, name="Foreign child", parent=ctx.root)
    Issue.objects.filter(pk=ctx.child.pk).update(parent=bridge)
    assert ids(session_client.get(route(ctx), {"include_descendants": "true"})) == set()


@pytest.mark.parametrize("cycle", ["self", "deep"])
def test_corrupt_cycles_terminate_without_returning_root(subtree, session_client, cycle):
    ctx = subtree
    parent = ctx.root if cycle == "self" else ctx.grandchild
    Issue.objects.filter(pk=ctx.root.pk).update(parent=parent)
    response = session_client.get(route(ctx), {"include_descendants": "true"})
    assert ids(response) == {str(ctx.child.pk), str(ctx.grandchild.pk)}
    assert len(response.data["sub_issues"]) == 2
    assert response.data["state_distribution"] == {"backlog": [str(ctx.child.pk)]}


def test_missing_root_and_archived_project_return_empty(subtree, session_client):
    ctx = subtree
    assert ids(session_client.get(route(ctx, uuid4()), {"include_descendants": "true"})) == set()
    Project.objects.filter(pk=ctx.project.pk).update(archived_at=timezone.now())
    assert ids(session_client.get(route(ctx), {"include_descendants": "true"})) == set()


def test_recursive_query_count_does_not_grow_with_depth(subtree, session_client):
    ctx = subtree
    with CaptureQueriesContext(connection) as shallow:
        assert len(ids(session_client.get(route(ctx), {"include_descendants": "true"}))) == 2
    parent = ctx.grandchild
    for index in range(12):
        parent = Issue.objects.create(project=ctx.project, state=ctx.state, name=f"Depth {index}", parent=parent)
    with CaptureQueriesContext(connection) as deep:
        assert len(ids(session_client.get(route(ctx), {"include_descendants": "true"}))) == 14
    assert len(deep) == len(shallow)
    recursive_queries = [query for query in deep if "WITH RECURSIVE" in query["sql"]]
    assert len(recursive_queries) == 1
