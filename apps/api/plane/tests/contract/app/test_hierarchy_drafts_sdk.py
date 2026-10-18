"""Hierarchy contracts for private drafts, publication and Runner SDK writes."""

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from plane.app.serializers.draft import DraftIssueCreateSerializer
from plane.db.models import DraftIssue, Issue, IssueType, Project, ProjectIssueType, ProjectMember, State
from plane.db.models.workflow_runner import WorkflowExecution, WorkflowExecutionStep
from plane.services import workflow_sdk as sdk

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]


@pytest.fixture
def hierarchy_ctx(workspace, create_user, monkeypatch):
    from plane.app.views.workspace import draft as views

    monkeypatch.setattr(views.issue_activity, "delay", Mock())
    monkeypatch.setattr(views, "base_host", lambda **kwargs: "http://testserver")
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Hierarchy", identifier="HD", hierarchy_enabled=True)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    types = []
    for level in range(3):
        kind = IssueType.objects.create(workspace=workspace, name=f"Level {level}")
        ProjectIssueType.objects.create(project=project, issue_type=kind, level=level, is_default=level == 2)
        types.append(kind)
    parent = Issue.objects.create(project=project, state=state, name="Parent", type=types[1])
    return SimpleNamespace(
        workspace=workspace,
        user=create_user,
        project=project,
        state=state,
        types=types,
        parent=parent,
        context={"workspace_id": workspace.pk, "project_id": project.pk},
    )


def save_draft(ctx, data, instance=None, **context):
    serializer = DraftIssueCreateSerializer(
        instance, data=data, partial=instance is not None, context={**ctx.context, **context}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save()


def owned_draft(ctx, **attrs):
    draft = DraftIssue(workspace=ctx.workspace, project=ctx.project, name="Private draft", **attrs)
    draft.save(created_by_id=ctx.user.pk)
    return draft


def test_draft_save_checks_final_type_and_parent(hierarchy_ctx):
    ctx = hierarchy_ctx
    draft = save_draft(ctx, {"name": "Leaf", "type_id": None, "parent_id": str(ctx.parent.pk)})
    renamed = save_draft(ctx, {"name": "Renamed"}, draft)
    assert renamed.parent_id == ctx.parent.pk
    assert renamed.type_id is None
    with pytest.raises(ValidationError):
        save_draft(ctx, {"type_id": str(ctx.types[1].pk)}, draft)
    draft.refresh_from_db()
    assert draft.type_id is None
    assert draft.parent_id == ctx.parent.pk
    detached = save_draft(ctx, {"parent_id": None, "type_id": str(ctx.types[1].pk)}, draft)
    assert detached.parent_id is None
    assert detached.type_id == ctx.types[1].pk


@pytest.mark.parametrize("destination", ["other", "none"])
def test_draft_project_move_rejects_inherited_parent(hierarchy_ctx, destination):
    ctx = hierarchy_ctx
    draft = owned_draft(ctx, parent=ctx.parent)
    target = (
        Project.objects.create(workspace=ctx.workspace, name="Destination", identifier="DST")
        if destination == "other"
        else None
    )
    with pytest.raises(ValidationError):
        save_draft(
            ctx, {"project_id": str(target.pk) if target else None}, draft, project_id=target.pk if target else None
        )
    draft.refresh_from_db()
    assert draft.project_id == ctx.project.pk
    assert draft.parent_id == ctx.parent.pk
    moved = save_draft(
        ctx,
        {"project_id": str(target.pk) if target else None, "parent_id": None, "type_id": None},
        draft,
        project_id=target.pk if target else None,
    )
    moved.refresh_from_db()
    assert moved.project_id == (target.pk if target else None)
    assert moved.parent_id is None


def test_projectless_draft_cannot_have_parent(hierarchy_ctx):
    ctx = hierarchy_ctx
    with pytest.raises(ValidationError):
        save_draft(ctx, {"parent_id": str(ctx.parent.pk), "type_id": None}, project_id=None)
    assert not DraftIssue.objects.exists()


@pytest.mark.parametrize("override", [False, True])
def test_publish_inherits_parent_and_null_type(session_client, hierarchy_ctx, override):
    ctx = hierarchy_ctx
    draft = owned_draft(ctx, parent=ctx.parent)
    payload = {"name": "Published"}
    if override:
        payload.update(parent_id=None, type_id=str(ctx.types[2].pk))
    response = session_client.post(
        f"/api/workspaces/{ctx.workspace.slug}/draft-to-issue/{draft.pk}/", payload, format="json"
    )
    assert response.status_code == 201, response.data
    issue = Issue.objects.get(pk=response.data["id"])
    assert issue.parent_id == (None if override else ctx.parent.pk)
    assert issue.type_id == (ctx.types[2].pk if override else None)
    assert not DraftIssue.objects.filter(pk=draft.pk).exists()


def test_publish_revalidates_historical_draft_relationship(session_client, hierarchy_ctx):
    ctx = hierarchy_ctx
    draft = owned_draft(ctx, parent=ctx.parent, type=ctx.types[1])
    response = session_client.post(
        f"/api/workspaces/{ctx.workspace.slug}/draft-to-issue/{draft.pk}/", {"name": "Invalid"}, format="json"
    )
    assert response.status_code == 400, response.data
    assert DraftIssue.objects.filter(pk=draft.pk).exists()
    assert not Issue.objects.filter(name="Invalid").exists()


@pytest.mark.parametrize("edge", ["parent", "child", "draft_child"])
@pytest.mark.parametrize("dry_run", [False, True])
def test_sdk_type_mutation_validates_both_directions(hierarchy_ctx, edge, dry_run):
    ctx = hierarchy_ctx
    issue = Issue.objects.create(project=ctx.project, state=ctx.state, name="SDK", type=ctx.types[1])
    if edge == "parent":
        parent = Issue.objects.create(project=ctx.project, name="Top", type=ctx.types[2])
        Issue.objects.filter(pk=issue.pk).update(parent=parent)
        new_type = ctx.types[0]
    elif edge == "child":
        Issue.objects.create(project=ctx.project, name="Leaf", parent=issue, type=ctx.types[0])
        new_type = ctx.types[2]
    else:
        owned_draft(ctx, parent=issue, type=ctx.types[0])
        new_type = ctx.types[2]
    execution = WorkflowExecution.objects.create(
        project=ctx.project,
        issue=issue,
        actor=ctx.user,
        phase="post",
        status="running",
        capabilities=["updateWorkItem"],
        policy_version=ctx.project.workflow_version,
        lease_expires_at=timezone.now() + timedelta(minutes=2),
        dry_run=True,
    )
    # Dry runs may omit a script version; real writes below use a published version.
    step = WorkflowExecutionStep.objects.create(
        project=ctx.project, execution=execution, index=0, status="running", capabilities=["updateWorkItem"]
    )
    if not dry_run:
        from plane.db.models.workflow_runner import WorkflowScript, WorkflowScriptVersion

        script = WorkflowScript.objects.create(project=ctx.project, name="Hierarchy SDK")
        version = WorkflowScriptVersion.objects.create(
            project=ctx.project,
            script=script,
            version=1,
            source="return null",
            source_hash="a" * 64,
            capabilities=["updateWorkItem"],
        )
        WorkflowExecution.objects.filter(pk=execution.pk).update(dry_run=False)
        WorkflowExecutionStep.objects.filter(pk=step.pk).update(script_version=version)
        execution.refresh_from_db()
        step.refresh_from_db()
    with pytest.raises(sdk.WorkflowSDKError) as exc:
        sdk.invoke_sdk(execution, step, "updateWorkItem", [str(issue.pk), {"type_id": str(new_type.pk)}], 1)
    assert exc.value.sdk_code == "WORKFLOW_VALIDATION_FAILED"
    issue.refresh_from_db()
    assert issue.type_id == ctx.types[1].pk
