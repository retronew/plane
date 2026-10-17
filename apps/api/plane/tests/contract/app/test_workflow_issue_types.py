from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from plane.api.serializers.intake import IntakeIssueUpdateSerializer
from plane.api.serializers.issue import IssueSerializer as PublicIssueSerializer
from plane.app.serializers.draft import DraftIssueCreateSerializer, DraftIssueSerializer
from plane.app.serializers.issue import IssueCreateSerializer, IssueDetailSerializer, IssueIntakeSerializer
from plane.db.models import (
    DeployBoard,
    DraftIssue,
    Intake,
    IntakeIssue,
    Issue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
)
from plane.db.models.workflow import ProjectWorkflow, WorkflowTransition

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def typed_ctx(workspace, create_user, monkeypatch):
    from plane.api.views import intake as public_intake
    from plane.app.views.intake import base as app_intake
    from plane.app.views.issue import base as issue_views
    from plane.app.views.workspace import draft as draft_views
    from plane.space.views import intake as space_intake

    for module in (public_intake, app_intake, issue_views, draft_views, space_intake):
        monkeypatch.setattr(module.issue_activity, "delay", Mock())
    monkeypatch.setattr(issue_views.model_activity, "delay", Mock())
    monkeypatch.setattr(issue_views.recent_visited_task, "delay", Mock())
    monkeypatch.setattr(app_intake.issue_description_version_task, "delay", Mock())
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Typed writes", identifier="TYP", intake_view=True)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    backlog = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    todo = State.objects.create(project=project, name="Typed start", group="unstarted")
    done = State.objects.create(project=project, name="Done", group="completed")
    cancelled = State.objects.create(project=project, name="Cancelled", group="cancelled")
    triage = State.objects.create(project=project, name="Triage", group="triage", is_triage=True)
    ProjectWorkflow.objects.create(project=project, enabled=True, initial_state=backlog)
    typed_workflow = ProjectWorkflow.objects.create(
        project=project, name="Typed workflow", is_default=False, initial_state=todo
    )
    typed_workflow.states.add(todo, done, cancelled)
    default_type = IssueType.objects.create(workspace=workspace, name="Default project type")
    other_type = IssueType.objects.create(workspace=workspace, name="Other project type")
    ProjectIssueType.objects.create(project=project, issue_type=default_type, is_default=True, workflow=typed_workflow)
    ProjectIssueType.objects.create(project=project, issue_type=other_type)
    intake = Intake.objects.create(project=project, name="Intake")
    return SimpleNamespace(
        workspace=workspace,
        user=create_user,
        project=project,
        backlog=backlog,
        todo=todo,
        done=done,
        cancelled=cancelled,
        triage=triage,
        workflow=typed_workflow,
        default_type=default_type,
        other_type=other_type,
        intake=intake,
        base=f"/api/workspaces/{workspace.slug}/projects/{project.id}/",
        context={
            "project_id": project.id,
            "workspace_id": workspace.id,
            "default_assignee_id": None,
            "request": SimpleNamespace(user=create_user),
        },
    )


@pytest.mark.parametrize("serializer_class", [IssueCreateSerializer, PublicIssueSerializer, DraftIssueCreateSerializer])
def test_type_id_maps_to_model_relation_and_round_trips(typed_ctx, serializer_class):
    ctx = typed_ctx
    serializer = serializer_class(data={"name": "Mapped", "type_id": str(ctx.other_type.id)}, context=ctx.context)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["type"] == ctx.other_type
    assert "type_id" not in serializer.validated_data
    issue = serializer.save()
    assert issue.type_id == ctx.other_type.id
    assert str(serializer.data["type_id"]) == str(ctx.other_type.id)
    update = serializer_class(issue, data={"type_id": None}, partial=True, context=ctx.context)
    assert update.is_valid(), update.errors
    update.save()
    issue.refresh_from_db()
    assert issue.type_id is None


@pytest.mark.parametrize("serializer_class", [IssueCreateSerializer, PublicIssueSerializer, DraftIssueCreateSerializer])
def test_alias_conflicts_are_rejected_before_source_mapping(typed_ctx, serializer_class):
    ctx = typed_ctx
    serializer = serializer_class(
        data={"name": "Conflict", "type": str(ctx.default_type.id), "type_id": str(ctx.other_type.id)},
        context=ctx.context,
    )
    assert not serializer.is_valid()
    assert "WORKFLOW_CONFLICTING_TYPE" in str(serializer.errors)
    serializer = serializer_class(
        data={"name": "Same", "type": str(ctx.other_type.id), "type_id": str(ctx.other_type.id)},
        context=ctx.context,
    )
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().type_id == ctx.other_type.id


@pytest.mark.parametrize("serializer_class", [IssueCreateSerializer, PublicIssueSerializer, DraftIssueCreateSerializer])
@pytest.mark.parametrize("invalid_kind", ["foreign_project", "inactive", "deleted"])
def test_type_membership_validation_is_shared(typed_ctx, serializer_class, invalid_kind):
    ctx = typed_ctx
    invalid_type = IssueType.objects.create(workspace=ctx.workspace, name="Invalid")
    if invalid_kind == "foreign_project":
        foreign = Project.objects.create(workspace=ctx.workspace, name="Foreign", identifier="FOR")
        ProjectIssueType.objects.create(project=foreign, issue_type=invalid_type)
    else:
        ProjectIssueType.objects.create(project=ctx.project, issue_type=invalid_type)
        IssueType.objects.filter(pk=invalid_type.pk).update(
            **({"is_active": False} if invalid_kind == "inactive" else {"deleted_at": timezone.now()})
        )
    serializer = serializer_class(data={"name": "Invalid type", "type_id": str(invalid_type.id)}, context=ctx.context)
    assert not serializer.is_valid()
    assert "Invalid" in str(serializer.errors) or "WORKFLOW_INVALID_TYPE" in str(serializer.errors)


def test_changing_draft_project_requires_a_type_bound_to_the_new_project(typed_ctx):
    ctx = typed_ctx
    other_project = Project.objects.create(workspace=ctx.workspace, name="Draft target", identifier="DRT")
    draft = DraftIssue.objects.create(
        workspace=ctx.workspace, project=ctx.project, type=ctx.default_type, name="Moved draft"
    )
    serializer = DraftIssueCreateSerializer(
        draft,
        data={"project_id": str(other_project.id)},
        partial=True,
        context={**ctx.context, "project_id": other_project.id},
    )
    assert not serializer.is_valid()
    assert "WORKFLOW_INVALID_TYPE" in str(serializer.errors)
    draft.refresh_from_db()
    assert draft.project_id == ctx.project.id


def test_nested_intake_update_preserves_omitted_type(typed_ctx):
    ctx = typed_ctx
    issue = Issue.objects.create(project=ctx.project, state=ctx.triage, type=ctx.other_type, name="Nested")
    bridge = IntakeIssue.objects.create(project=ctx.project, intake=ctx.intake, issue=issue)
    serializer = IntakeIssueUpdateSerializer(
        bridge, data={"issue": {"name": "Nested rename"}}, partial=True, context=ctx.context
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    issue.refresh_from_db()
    assert issue.name == "Nested rename"
    assert issue.type_id == ctx.other_type.id
    assert issue.state_id == ctx.triage.id


@pytest.mark.parametrize("use_api", [False, True])
def test_create_resolves_default_type_before_workflow_and_public_type_remains_compatible(request, typed_ctx, use_api):
    ctx = typed_ctx
    client = request.getfixturevalue("api_key_client" if use_api else "session_client")
    url = ctx.base.replace("/api/", "/api/v1/") + "work-items/" if use_api else ctx.base + "issues/"
    response = client.post(url, {"name": "Implicit typed"}, format="json")
    assert response.status_code == 201, response.data
    issue = Issue.objects.get(pk=response.data["id"])
    assert issue.type_id == ctx.default_type.id
    assert issue.state_id == ctx.todo.id
    assert str(response.data["type_id"]) == str(ctx.default_type.id)
    explicit = client.post(url, {"name": "Explicit null", "type_id": None}, format="json")
    assert explicit.status_code == 201, explicit.data
    issue = Issue.objects.get(pk=explicit.data["id"])
    assert issue.type_id is None
    assert issue.state_id == ctx.backlog.id
    if use_api:
        legacy = client.post(url, {"name": "Legacy type", "type": str(ctx.other_type.id)}, format="json")
        assert legacy.status_code == 201, legacy.data
        assert str(legacy.data["type"]) == str(ctx.other_type.id)
        assert str(legacy.data["type_id"]) == str(ctx.other_type.id)


def test_regular_issue_projections_include_type_id(session_client, typed_ctx):
    ctx = typed_ctx
    issue = Issue.objects.create(project=ctx.project, state=ctx.todo, name="Projected", type=ctx.default_type)
    for serializer_class in (IssueDetailSerializer, IssueIntakeSerializer):
        assert str(serializer_class(issue).data["type_id"]) == str(ctx.default_type.id)
    for path in ("issues/", "issues/list/", "v2/issues/", "issues-detail/", f"issues/{issue.id}/"):
        response = session_client.get(ctx.base + path, {"issues": str(issue.id)} if path == "issues/list/" else {})
        assert response.status_code == 200, (path, response.data)
        assert '"type_id"' in response.content.decode(), path
        assert str(ctx.default_type.id) in response.content.decode(), path


@pytest.mark.parametrize("override", [False, True])
def test_publishing_draft_preserves_type_and_uses_final_workflow(session_client, typed_ctx, override):
    ctx = typed_ctx
    draft = DraftIssue(workspace=ctx.workspace, project=ctx.project, name="Typed draft", type=ctx.default_type)
    draft.save(created_by_id=ctx.user.id)
    assert str(DraftIssueSerializer(draft).data["type_id"]) == str(ctx.default_type.id)
    payload = {"name": "Published typed"}
    if override:
        payload["type_id"] = None
    response = session_client.post(
        f"/api/workspaces/{ctx.workspace.slug}/draft-to-issue/{draft.id}/", payload, format="json"
    )
    assert response.status_code == 201, response.data
    issue = Issue.objects.get(pk=response.data["id"])
    assert issue.type_id == (None if override else ctx.default_type.id)
    assert issue.state_id == (ctx.backlog.id if override else ctx.todo.id)
    assert not DraftIssue.objects.filter(pk=draft.id).exists()


def test_template_children_use_project_default_type_and_workflow(session_client, typed_ctx):
    ctx = typed_ctx
    response = session_client.post(
        ctx.base + "issues/",
        {"name": "Parent", "type_id": str(ctx.other_type.id), "template_children": [{"name": "Typed child"}]},
        format="json",
    )
    assert response.status_code == 201, response.data
    parent = Issue.objects.get(pk=response.data["id"])
    child = Issue.objects.get(parent=parent)
    assert parent.type_id == ctx.other_type.id
    assert child.type_id == ctx.default_type.id
    assert child.state_id == ctx.todo.id


@pytest.mark.django_db(transaction=True)
def test_template_preparation_happens_before_writes_and_failure_rolls_back_parent(typed_ctx, monkeypatch):
    from plane.utils import workflow

    ctx = typed_ctx
    original = workflow.prepare_workflow_write
    seen = []

    def prepare(project_id, attrs, *args, **kwargs):
        assert not connection.in_atomic_block
        assert not Issue.objects.filter(name="Prepared parent").exists()
        seen.append(attrs["name"])
        if attrs["name"] == "Blocked child":
            raise ValidationError({"workflow": ["TEST_CHILD_BLOCKED"]})
        return original(project_id, attrs, *args, **kwargs)

    monkeypatch.setattr(workflow, "prepare_workflow_write", prepare)
    serializer = IssueCreateSerializer(
        data={"name": "Prepared parent", "template_children": [{"name": "Blocked child"}]}, context=ctx.context
    )
    assert serializer.is_valid(), serializer.errors
    with pytest.raises(ValidationError, match="TEST_CHILD_BLOCKED"):
        serializer.save()
    assert seen == ["Prepared parent", "Blocked child"]
    assert not Issue.objects.filter(name="Prepared parent").exists()


@pytest.mark.parametrize("use_api", [False, True])
def test_intake_type_and_acceptance_resolve_one_final_workflow(request, typed_ctx, use_api):
    ctx = typed_ctx
    issue = Issue.objects.create(project=ctx.project, state=ctx.triage, name="Incoming", type=ctx.other_type)
    bridge = IntakeIssue.objects.create(project=ctx.project, intake=ctx.intake, issue=issue)
    client = request.getfixturevalue("api_key_client" if use_api else "session_client")
    url = (ctx.base.replace("/api/", "/api/v1/") if use_api else ctx.base) + f"intake-issues/{issue.id}/"
    response = client.patch(
        url, {"status": 1, "issue": {"type_id": str(ctx.default_type.id), "name": "Accepted typed"}}, format="json"
    )
    assert response.status_code == 200, response.data
    issue.refresh_from_db()
    bridge.refresh_from_db()
    assert bridge.status == 1
    assert issue.type_id == ctx.default_type.id
    assert issue.state_id == ctx.todo.id
    assert issue.name == "Accepted typed"
    assert str(ctx.default_type.id) in response.content.decode()


@pytest.mark.parametrize("use_api", [False, True])
def test_blocked_intake_acceptance_does_not_persist_embedded_type_or_fields(request, typed_ctx, use_api):
    ctx = typed_ctx
    ctx.workflow.restricted_creation_states.add(ctx.todo, ctx.done, ctx.cancelled)
    issue = Issue.objects.create(project=ctx.project, state=ctx.triage, name="Unchanged", type=ctx.other_type)
    bridge = IntakeIssue.objects.create(project=ctx.project, intake=ctx.intake, issue=issue)
    client = request.getfixturevalue("api_key_client" if use_api else "session_client")
    url = (ctx.base.replace("/api/", "/api/v1/") if use_api else ctx.base) + f"intake-issues/{issue.id}/"
    response = client.patch(
        url, {"status": 1, "issue": {"type_id": str(ctx.default_type.id), "name": "Must roll back"}}, format="json"
    )
    assert response.status_code == 400, response.data
    issue.refresh_from_db()
    bridge.refresh_from_db()
    assert bridge.status != 1
    assert issue.type_id == ctx.other_type.id
    assert issue.state_id == ctx.triage.id
    assert issue.name == "Unchanged"


@pytest.mark.parametrize("entrypoint", ["app", "public", "space"])
def test_intake_creation_uses_shared_type_validation_and_projection(request, typed_ctx, entrypoint):
    ctx = typed_ctx
    client = request.getfixturevalue("api_key_client" if entrypoint == "public" else "session_client")
    url = (ctx.base.replace("/api/", "/api/v1/") if entrypoint == "public" else ctx.base) + "intake-issues/"
    if entrypoint == "space":
        board = DeployBoard.objects.create(
            workspace=ctx.workspace,
            project=ctx.project,
            entity_name="project",
            entity_identifier=ctx.project.id,
            intake=ctx.intake,
        )
        url = f"/api/public/anchor/{board.anchor}/intakes/{ctx.intake.id}/intake-issues/"
    response = client.post(url, {"issue": {"name": "Typed intake", "type_id": str(ctx.default_type.id)}}, format="json")
    assert response.status_code in (200, 201), response.data
    issue = Issue.objects.get(name="Typed intake")
    assert issue.type_id == ctx.default_type.id
    assert issue.state_id == ctx.triage.id
    assert str(ctx.default_type.id) in response.content.decode()
    bad = client.post(
        url,
        {"issue": {"name": "Conflicting intake", "type": str(ctx.other_type.id), "type_id": str(ctx.default_type.id)}},
        format="json",
    )
    assert bad.status_code == 400, bad.data
    assert not Issue.objects.filter(name="Conflicting intake").exists()


@pytest.mark.django_db(transaction=True)
def test_auto_close_prepares_outside_transaction_and_finishes_inside(typed_ctx, monkeypatch):
    from plane.bgtasks import issue_automation_task as tasks

    ctx = typed_ctx
    Project.objects.filter(pk=ctx.project.pk).update(close_in=7)
    issue = Issue.objects.create(project=ctx.project, state=ctx.todo, type=ctx.default_type, name="Old typed")
    Issue.objects.filter(pk=issue.pk).update(updated_at=timezone.now() - timedelta(days=8))
    WorkflowTransition.objects.create(
        project=ctx.project, workflow=ctx.workflow, source=ctx.todo, destination=ctx.cancelled
    )
    original_prepare = tasks.prepare_workflow_write
    original_finish = tasks.finish_workflow_write
    stages = []

    def prepare(*args, **kwargs):
        assert not connection.in_atomic_block
        stages.append("prepare")
        return original_prepare(*args, **kwargs)

    def finish(*args, **kwargs):
        assert connection.in_atomic_block
        stages.append("finish")
        return original_finish(*args, **kwargs)

    monkeypatch.setattr(tasks, "prepare_workflow_write", prepare)
    monkeypatch.setattr(tasks, "finish_workflow_write", finish)
    monkeypatch.setattr(tasks.issue_activity, "delay", Mock())
    tasks.close_project_issues(ctx.project.id)
    issue.refresh_from_db()
    assert issue.state_id == ctx.cancelled.id
    assert stages == ["prepare", "finish"]
    tasks.issue_activity.delay.assert_called_once()


@pytest.mark.parametrize("change", ["updated", "cycle_started", "archived"])
def test_auto_close_rechecks_eligibility_after_preparation(typed_ctx, monkeypatch, change):
    from plane.bgtasks import issue_automation_task as tasks
    from plane.db.models import Cycle, CycleIssue

    ctx = typed_ctx
    Project.objects.filter(pk=ctx.project.pk).update(close_in=7)
    issue = Issue.objects.create(
        project=ctx.project, state=ctx.todo, type=ctx.default_type, name="Changed while preparing"
    )
    Issue.objects.filter(pk=issue.pk).update(updated_at=timezone.now() - timedelta(days=8))
    original_prepare = tasks.prepare_workflow_write

    def prepare(*args, **kwargs):
        prepared = original_prepare(*args, **kwargs)
        if change == "updated":
            Issue.objects.filter(pk=issue.pk).update(updated_at=timezone.now())
        elif change == "archived":
            Issue.objects.filter(pk=issue.pk).update(archived_at=timezone.now().date())
        else:
            cycle = Cycle.objects.create(
                project=ctx.project,
                name="Active cycle",
                owned_by=ctx.user,
                start_date=timezone.now(),
                end_date=timezone.now() + timedelta(days=7),
            )
            CycleIssue.objects.create(project=ctx.project, cycle=cycle, issue=issue)
        return prepared

    monkeypatch.setattr(tasks, "prepare_workflow_write", prepare)
    monkeypatch.setattr(tasks.issue_activity, "delay", Mock())
    tasks.close_project_issues(ctx.project.id)
    issue.refresh_from_db()
    assert issue.state_id == ctx.todo.id
    tasks.issue_activity.delay.assert_not_called()
