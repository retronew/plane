from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from rest_framework.exceptions import ValidationError

from plane.api.serializers.issue import IssueSerializer as PublicIssueSerializer
from plane.app.serializers.issue import IssueCreateSerializer
from plane.db.models import (
    DraftIssue,
    Issue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
    WorkspaceTemplate,
)
from plane.services.hierarchy import validate_hierarchy_write

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def hierarchy_ctx(workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    monkeypatch.setattr("plane.bgtasks.issue_activities_task.issue_activity.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Hierarchy", identifier="HIE")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    types = [IssueType.objects.create(workspace=workspace, name=f"Level {n}") for n in range(3)]
    for n, issue_type in enumerate(types):
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, level=n, is_default=n == 0)
    return SimpleNamespace(
        project=project,
        state=state,
        types=types,
        workspace=workspace,
        user=create_user,
        base=f"/api/workspaces/{workspace.slug}/projects/{project.pk}/issue-hierarchy/",
        context={
            "project_id": project.pk,
            "workspace_id": workspace.pk,
            "default_assignee_id": None,
            "request": SimpleNamespace(user=create_user),
        },
    )


def payload(ctx, **overrides):
    return {
        "enabled": True,
        "default_level": 0,
        "policy_version": ctx.project.workflow_version,
        "type_levels": [{"type_id": str(t.pk), "level": n} for n, t in enumerate(ctx.types)],
        **overrides,
    }


def make_issue(ctx, level, parent=None, **kwargs):
    return Issue.objects.create(
        project=ctx.project,
        state=ctx.state,
        type=ctx.types[level] if level is not None else None,
        parent=parent,
        name=f"Item {level}",
        **kwargs,
    )


def enable(ctx):
    ctx.project.hierarchy_enabled = True
    ctx.project.save(update_fields=["hierarchy_enabled"])


@pytest.mark.parametrize("serializer_cls", [IssueCreateSerializer, PublicIssueSerializer])
@pytest.mark.parametrize(
    "parent_level,child_level,valid",
    [(2, 1, True), (1, 0, True), (0, 0, False), (2, 0, False), (1, 1, False), (0, 2, False)],
)
def test_normal_writes_enforce_adjacent_levels(hierarchy_ctx, serializer_cls, parent_level, child_level, valid):
    ctx = hierarchy_ctx
    enable(ctx)
    parent = make_issue(ctx, parent_level)
    serializer = serializer_cls(
        data={"name": "Child", "parent": str(parent.pk), "type_id": str(ctx.types[child_level].pk)}, context=ctx.context
    )
    assert serializer.is_valid(), serializer.errors
    if valid:
        assert serializer.save().parent_id == parent.pk
    else:
        with pytest.raises(ValidationError, match="HIERARCHY_INVALID_LEVEL"):
            serializer.save()
        assert Issue.objects.count() == 1


def test_disabled_preserves_nesting_but_rejects_cycles_and_cross_project(hierarchy_ctx):
    ctx = hierarchy_ctx
    root = make_issue(ctx, 0)
    middle = make_issue(ctx, 0, root)
    leaf = make_issue(ctx, 0, middle)
    validate_hierarchy_write(ctx.project.pk, {"parent": root}, leaf)
    with pytest.raises(ValidationError, match="HIERARCHY_CYCLE"):
        validate_hierarchy_write(ctx.project.pk, {"parent": leaf}, root)
    with pytest.raises(ValidationError, match="HIERARCHY_CYCLE"):
        validate_hierarchy_write(ctx.project.pk, {"parent": root}, root)
    foreign_project = Project.objects.create(workspace=ctx.workspace, name="Foreign", identifier="FOR")
    foreign = Issue.objects.create(project=foreign_project, name="Foreign")
    with pytest.raises(ValidationError, match="HIERARCHY_CROSS_PROJECT"):
        validate_hierarchy_write(ctx.project.pk, {"parent": foreign}, root)


def test_combined_type_parent_and_all_children_are_checked(hierarchy_ctx):
    ctx = hierarchy_ctx
    enable(ctx)
    high = make_issue(ctx, 2)
    middle = make_issue(ctx, 1, high)
    leaf = make_issue(ctx, 0, middle)
    with pytest.raises(ValidationError, match="HIERARCHY_INVALID_LEVEL"):
        validate_hierarchy_write(ctx.project.pk, {"type": ctx.types[0]}, middle)
    with pytest.raises(ValidationError, match="HIERARCHY_CHILDREN_CONFLICT"):
        validate_hierarchy_write(ctx.project.pk, {"type": ctx.types[0], "parent": None}, middle)
    validate_hierarchy_write(ctx.project.pk, {"type": None}, leaf)


def test_preview_apply_detaches_real_edges_and_requires_confirmation(
    hierarchy_ctx, session_client, django_capture_on_commit_callbacks
):
    ctx = hierarchy_ctx
    parent = make_issue(ctx, 0)
    child = make_issue(ctx, 0, parent)
    draft = DraftIssue.objects.create(
        project=ctx.project, workspace=ctx.workspace, name="Draft", parent=parent, type=ctx.types[0]
    )
    request = payload(ctx)
    preview = session_client.post(ctx.base + "preview/", request, format="json")
    assert preview.status_code == 200, preview.data
    assert preview.data["conflict_count"] == 2
    assert {row["kind"] for row in preview.data["examples"]} == {"issue", "draft"}
    response = session_client.post(ctx.base + "apply/", {**request, "token": preview.data["token"]}, format="json")
    assert response.status_code == 400
    child.refresh_from_db()
    assert child.parent_id == parent.pk
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = session_client.post(
            ctx.base + "apply/", {**request, "token": preview.data["token"], "confirm_detach": True}, format="json"
        )
    assert response.status_code == 200, response.data
    assert response.data["detached_count"] == 2
    assert callbacks
    child.refresh_from_db()
    draft.refresh_from_db()
    assert child.parent_id is None and draft.parent_id is None
    assert Issue.objects.filter(pk=parent.pk).exists()
    ctx.project.refresh_from_db()
    assert ctx.project.hierarchy_enabled
    disable = session_client.post(ctx.base + "preview/", payload(ctx, enabled=False), format="json")
    assert disable.status_code == 400
    assert "HIERARCHY_CANNOT_DISABLE" in str(disable.data)


@pytest.mark.parametrize("mutation", ["edge", "type", "draft", "version"])
def test_preview_is_bound_to_live_snapshot(hierarchy_ctx, session_client, mutation):
    ctx = hierarchy_ctx
    parent = make_issue(ctx, 2)
    child = make_issue(ctx, 1, parent)
    request = payload(ctx)
    preview = session_client.post(ctx.base + "preview/", request, format="json")
    assert preview.status_code == 200, preview.data
    if mutation == "edge":
        Issue.objects.filter(pk=child.pk).update(parent=None)
    elif mutation == "type":
        ProjectIssueType.objects.filter(project=ctx.project, issue_type=ctx.types[1]).update(level=0)
    elif mutation == "draft":
        DraftIssue.objects.create(project=ctx.project, workspace=ctx.workspace, name="New draft", parent=parent)
    else:
        Project.objects.filter(pk=ctx.project.pk).update(workflow_version=1)
    result = session_client.post(
        ctx.base + "apply/", {**request, "token": preview.data["token"], "confirm_detach": True}, format="json"
    )
    assert result.status_code == 409, result.data
    child.refresh_from_db()
    assert child.parent_id == (None if mutation == "edge" else parent.pk)


def test_full_mapping_normalizes_sparse_levels_and_default(hierarchy_ctx, session_client):
    ctx = hierarchy_ctx
    request = payload(
        ctx,
        default_level=200,
        type_levels=[{"type_id": str(t.pk), "level": n} for t, n in zip(ctx.types, [0, 200, 2147483647])],
    )
    preview = session_client.post(ctx.base + "preview/", request, format="json")
    assert preview.status_code == 200, preview.data
    assert preview.data["levels"] == [0, 1, 2]
    assert preview.data["default_level"] == 1
    result = session_client.post(ctx.base + "apply/", {**request, "token": preview.data["token"]}, format="json")
    assert result.status_code == 200, result.data
    assert result.data["config"]["default_level"] == 1
    assert session_client.post(ctx.base + "preview/", payload(ctx, type_levels=[]), format="json").status_code == 409


def test_shared_type_clone_preserves_draft_template_and_other_project(hierarchy_ctx, session_client):
    ctx = hierarchy_ctx
    foreign = Project.objects.create(workspace=ctx.workspace, name="Shared", identifier="SHA")
    ProjectIssueType.objects.create(project=foreign, issue_type=ctx.types[1], level=7)
    issue = make_issue(ctx, 1)
    draft = DraftIssue.objects.create(
        project=ctx.project, workspace=ctx.workspace, name="Typed draft", type=ctx.types[1]
    )
    template = WorkspaceTemplate.objects.create(
        project=ctx.project,
        workspace=ctx.workspace,
        kind="work_item",
        name="Typed template",
        configuration={
            "type_id": str(ctx.types[1].pk),
            "children": [{"type_id": str(ctx.types[1].pk), "name": "Nested"}],
        },
    )
    request = payload(ctx, type_levels=[{"type_id": str(t.pk), "level": n} for t, n in zip(ctx.types, [0, 2, 1])])
    preview = session_client.post(ctx.base + "preview/", request, format="json")
    result = session_client.post(ctx.base + "apply/", {**request, "token": preview.data["token"]}, format="json")
    assert result.status_code == 200, result.data
    cloned = result.data["type_id_map"][str(ctx.types[1].pk)]
    issue.refresh_from_db()
    draft.refresh_from_db()
    template.refresh_from_db()
    assert str(issue.type_id) == str(draft.type_id) == cloned
    assert template.configuration["type_id"] == template.configuration["children"][0]["type_id"] == cloned
    assert ProjectIssueType.objects.get(project=foreign).level == 7
    assert not IssueType.objects.get(pk=cloned).is_epic


def test_generic_project_serializer_cannot_enable_hierarchy(hierarchy_ctx):
    from plane.app.serializers.project import ProjectSerializer

    ctx = hierarchy_ctx
    serializer = ProjectSerializer(
        ctx.project,
        data={"hierarchy_enabled": True, "hierarchy_default_level": 5},
        partial=True,
        context={"workspace_id": ctx.workspace.pk},
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    ctx.project.refresh_from_db()
    assert not ctx.project.hierarchy_enabled and ctx.project.hierarchy_default_level == 0


def test_template_children_check_final_parent_type(hierarchy_ctx):
    ctx = hierarchy_ctx
    enable(ctx)
    data = {
        "name": "Parent",
        "type_id": str(ctx.types[2].pk),
        "template_children": [{"name": "Bad leaf", "type_id": str(ctx.types[0].pk)}],
    }
    serializer = IssueCreateSerializer(data=data, context=ctx.context)
    assert serializer.is_valid(), serializer.errors
    with pytest.raises(ValidationError, match="HIERARCHY_INVALID_LEVEL"):
        serializer.save()
    assert not Issue.objects.exists()
    data["template_children"][0]["type_id"] = str(ctx.types[1].pk)
    serializer = IssueCreateSerializer(data=data, context=ctx.context)
    assert serializer.is_valid(), serializer.errors
    parent = serializer.save()
    assert Issue.objects.get(parent=parent).type_id == ctx.types[1].pk


@pytest.mark.parametrize("invalid", [True, 1.0, 1.5, -1, 2147483648])
def test_configuration_requires_real_nonnegative_integer_levels(hierarchy_ctx, session_client, invalid):
    ctx = hierarchy_ctx
    request = payload(ctx)
    request["type_levels"][0]["level"] = invalid
    response = session_client.post(ctx.base + "preview/", request, format="json")
    assert response.status_code == 400, response.data


@pytest.mark.parametrize("kind", ["duplicate", "missing", "foreign", "bad_default"])
def test_configuration_requires_complete_owned_mapping(hierarchy_ctx, session_client, kind):
    ctx = hierarchy_ctx
    request = payload(ctx)
    if kind == "duplicate":
        request["type_levels"].append(request["type_levels"][0])
    elif kind == "missing":
        request["type_levels"].pop()
    elif kind == "foreign":
        request["type_levels"][0]["type_id"] = str(ctx.project.pk)
    else:
        request["default_level"] = 8
    response = session_client.post(ctx.base + "preview/", request, format="json")
    assert response.status_code == 400, response.data


def test_read_only_member_can_read_but_cannot_preview(hierarchy_ctx, session_client):
    ctx = hierarchy_ctx
    ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(role=10)
    # Workspace admin membership is sufficient for project administration, so
    # downgrade the workspace role too to exercise the ordinary viewer contract.
    from plane.db.models import WorkspaceMember

    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(role=15)
    response = session_client.get(ctx.base)
    assert response.status_code == 200, response.data
    assert not response.data["can_manage"]
    response = session_client.post(ctx.base + "preview/", payload(ctx), format="json")
    assert response.status_code == 403


def test_hierarchy_apply_preserves_pending_approvals(hierarchy_ctx, session_client, monkeypatch):
    ctx = hierarchy_ctx
    cancel = Mock()
    monkeypatch.setattr("plane.services.workflow.cancel_approvals", cancel)
    preview = session_client.post(ctx.base + "preview/", payload(ctx), format="json")
    result = session_client.post(ctx.base + "apply/", {**payload(ctx), "token": preview.data["token"]}, format="json")
    assert result.status_code == 200, result.data
    cancel.assert_not_called()


def test_type_level_patch_and_default_level_have_distinct_behavior(hierarchy_ctx, session_client):
    ctx = hierarchy_ctx
    types_base = ctx.base.replace("issue-hierarchy/", "issue-types/")
    response = session_client.patch(types_base + str(ctx.types[1].pk) + "/", {"version": 0, "level": 4}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["level"] == 4
    assert not response.data["is_epic"]
    ctx.project.refresh_from_db()
    request = payload(
        ctx, default_level=4, type_levels=[{"type_id": str(t.pk), "level": n} for t, n in zip(ctx.types, [0, 4, 8])]
    )
    preview = session_client.post(ctx.base + "preview/", request, format="json")
    result = session_client.post(ctx.base + "apply/", {**request, "token": preview.data["token"]}, format="json")
    assert result.status_code == 200, result.data
    ctx.project.refresh_from_db()
    response = session_client.patch(
        types_base + str(ctx.types[1].pk) + "/", {"version": ctx.project.workflow_version, "level": 0}, format="json"
    )
    assert response.status_code == 400
    assert "HIERARCHY_PREVIEW_REQUIRED" in str(response.data)
    created = session_client.post(types_base, {"name": "Uses default level"}, format="json")
    assert created.status_code == 201, created.data
    assert created.data["level"] == 1
    serializer = IssueCreateSerializer(data={"name": "Uses default type"}, context=ctx.context)
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().type_id == ctx.types[0].pk


def test_invalid_or_expired_preview_tokens_are_rejected(hierarchy_ctx, session_client, monkeypatch):
    from django.core import signing

    ctx = hierarchy_ctx
    preview = session_client.post(ctx.base + "preview/", payload(ctx), format="json")
    result = session_client.post(ctx.base + "apply/", {**payload(ctx), "token": "invalid"}, format="json")
    assert result.status_code == 409
    original = signing.loads

    def expire(token, **kwargs):
        if kwargs.get("max_age"):
            raise signing.SignatureExpired()
        return original(token, **kwargs)

    monkeypatch.setattr(signing, "loads", expire)
    result = session_client.post(ctx.base + "apply/", {**payload(ctx), "token": preview.data["token"]}, format="json")
    assert result.status_code == 409
    assert "HIERARCHY_PREVIEW_STALE" in str(result.data)


def test_archived_relations_are_previewed_and_activities_are_real(hierarchy_ctx, session_client):
    from datetime import date
    from plane.bgtasks.issue_activities_task import issue_activity
    from plane.db.models import IssueActivity

    ctx = hierarchy_ctx
    parent = make_issue(ctx, 0)
    child = make_issue(ctx, 0, parent, archived_at=date.today())
    preview = session_client.post(ctx.base + "preview/", payload(ctx), format="json")
    assert preview.data["conflict_count"] == 1
    result = session_client.post(
        ctx.base + "apply/", {**payload(ctx), "token": preview.data["token"], "confirm_detach": True}, format="json"
    )
    assert result.status_code == 200, result.data
    child.refresh_from_db()
    assert child.parent_id is None and child.archived_at
    # Run the existing activity task with its real before/after payload; no fake
    # activity objects are inserted by the hierarchy service.
    issue_activity.run(
        type="issue.activity.updated",
        requested_data='{"parent_id": null}',
        current_instance='{"parent_id": "' + str(parent.pk) + '"}',
        issue_id=str(child.pk),
        actor_id=str(ctx.user.pk),
        project_id=str(ctx.project.pk),
        epoch=1,
        notification=False,
    )
    activity = IssueActivity.objects.get(issue=child, field="parent")
    assert activity.old_identifier == str(parent.pk) or str(activity.old_identifier) == str(parent.pk)
    assert activity.new_identifier is None


def test_deleting_last_type_of_middle_level_requires_configuration(hierarchy_ctx, session_client):
    ctx = hierarchy_ctx
    enable(ctx)
    url = ctx.base.replace("issue-hierarchy/", "issue-types/") + str(ctx.types[1].pk) + "/"
    response = session_client.delete(url, {"version": 0}, format="json")
    assert response.status_code == 400, response.data
    assert "HIERARCHY_PREVIEW_REQUIRED" in str(response.data)
    assert ProjectIssueType.objects.filter(project=ctx.project, issue_type=ctx.types[1]).exists()
