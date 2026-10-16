from types import SimpleNamespace
from unittest.mock import Mock
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from plane.app.serializers.issue import IssueCreateSerializer
from plane.db.models import Issue, Project, ProjectMember, State, User, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowActivity, WorkflowTransition

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def ctx(workspace, create_user, monkeypatch):
    from plane.app.views.issue import base

    monkeypatch.setattr(base.issue_activity, "delay", Mock())
    monkeypatch.setattr(base.model_activity, "delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Workflow", identifier="FLOW")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    backlog = State.objects.create(project=project, name="Backlog", color="#60646c", default=True, group="backlog")
    todo = State.objects.create(project=project, name="Todo", color="#60646c", group="unstarted")
    done = State.objects.create(project=project, name="Done", color="#46a758", group="completed")
    workflow = ProjectWorkflow.objects.create(project=project, enabled=True)
    rule = WorkflowTransition.objects.create(project=project, workflow=workflow, source=backlog, destination=todo)
    issue = Issue.objects.create(project=project, state=backlog, name="Existing")
    base_url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
    return SimpleNamespace(
        project=project,
        backlog=backlog,
        todo=todo,
        done=done,
        workflow=workflow,
        rule=rule,
        issue=issue,
        base=base_url,
        config=base_url + "workflows/default/",
        user=create_user,
        workspace=workspace,
    )


def test_unconfigured_read_is_side_effect_free(session_client, ctx):
    ctx.workflow.delete(soft=False)
    response = session_client.get(ctx.config)
    assert response.status_code == 200
    assert response.data["enabled"] is False
    assert ProjectWorkflow.objects.count() == 0


def test_automatic_close_obeys_paths_and_cannot_impersonate_allowed_members(
    ctx, monkeypatch, django_capture_on_commit_callbacks
):
    from plane.bgtasks import issue_automation_task as tasks

    monkeypatch.setattr(tasks.issue_activity, "delay", Mock())
    cancelled = State.objects.create(project=ctx.project, name="Cancelled", group="cancelled")
    Project.objects.filter(pk=ctx.project.pk).update(close_in=7)
    Issue.objects.filter(pk=ctx.issue.pk).update(updated_at=timezone.now() - timedelta(days=8))

    tasks.close_old_issues()
    ctx.issue.refresh_from_db()
    assert ctx.issue.state_id == ctx.backlog.id
    tasks.issue_activity.delay.assert_not_called()

    rule = WorkflowTransition.objects.create(
        project=ctx.project, workflow=ctx.workflow, source=ctx.backlog, destination=cancelled
    )
    rule.members.add(ctx.user)
    tasks.close_old_issues()
    ctx.issue.refresh_from_db()
    assert ctx.issue.state_id == ctx.backlog.id
    tasks.issue_activity.delay.assert_not_called()

    rule.members.clear()
    with django_capture_on_commit_callbacks(execute=True):
        tasks.close_old_issues()
        tasks.issue_activity.delay.assert_not_called()
    ctx.issue.refresh_from_db()
    assert ctx.issue.state_id == cancelled.id
    tasks.issue_activity.delay.assert_called_once()


def test_create_uses_workflow_initial_state_and_restricts_creation(session_client, ctx):
    assert session_client.patch(ctx.config, {"initial_state_id": str(ctx.todo.id)}, format="json").status_code == 200
    assert (
        session_client.patch(
            ctx.config + "states/", {"state_id": str(ctx.done.id), "allow_creation": False}, format="json"
        ).status_code
        == 200
    )
    response = session_client.post(ctx.base + "issues/", {"name": "New"}, format="json")
    assert response.status_code == 201, response.data
    assert Issue.objects.get(pk=response.data["id"]).state_id == ctx.todo.id
    response = session_client.post(ctx.base + "issues/", {"name": "No", "state_id": str(ctx.done.id)}, format="json")
    assert response.status_code == 400
    assert "WORKFLOW_CREATION_NOT_ALLOWED" in str(response.data)
    assert not Issue.objects.filter(name="No").exists()


def test_transitions_are_whitelisted_only_for_states_with_rules(session_client, ctx):
    url = ctx.base + f"issues/{ctx.issue.id}/"
    response = session_client.patch(url, {"state_id": str(ctx.done.id)}, format="json")
    assert response.status_code == 400
    ctx.issue.refresh_from_db()
    assert ctx.issue.state_id == ctx.backlog.id
    assert session_client.patch(url, {"state_id": str(ctx.todo.id)}, format="json").status_code == 204
    assert session_client.patch(url, {"state_id": str(ctx.done.id)}, format="json").status_code == 204
    ctx.issue.refresh_from_db()
    assert ctx.issue.completed_at is not None


@pytest.mark.parametrize("field", ["enabled", "is_active"])
def test_disabling_keeps_configuration_and_stops_enforcement(session_client, ctx, field):
    response = session_client.patch(ctx.config, {field: False}, format="json")
    assert response.status_code == 200
    assert WorkflowTransition.objects.filter(pk=ctx.rule.pk).exists()
    assert (
        session_client.patch(
            ctx.base + f"issues/{ctx.issue.id}/", {"state_id": str(ctx.done.id)}, format="json"
        ).status_code
        == 204
    )


@pytest.mark.parametrize("client_name", ["session_client", "api_key_client"])
def test_member_restrictions_cannot_be_bypassed_even_by_admin(request, client_name, ctx):
    client = request.getfixturevalue(client_name)
    other = User.objects.create(email="workflow-other@example.invalid", username="workflow-other", first_name="Other")
    WorkspaceMember.objects.create(workspace=ctx.workspace, member=other, role=15)
    ProjectMember.objects.create(project=ctx.project, member=other, role=15)
    ctx.rule.members.add(other)
    url = (
        ctx.base + f"issues/{ctx.issue.id}/"
        if client_name == "session_client"
        else ctx.base.replace("/api/", "/api/v1/") + f"work-items/{ctx.issue.id}/"
    )
    payload = {"state_id" if client_name == "session_client" else "state": str(ctx.todo.id)}
    response = client.patch(url, payload, format="json")
    assert response.status_code == 400, response.data
    assert "WORKFLOW_MEMBER_NOT_ALLOWED" in str(response.data)
    ctx.rule.members.add(ctx.user)
    response = client.patch(url, payload, format="json")
    assert response.status_code in [200, 204], response.data
    ctx.issue.refresh_from_db()
    assert ctx.issue.state_id == ctx.todo.id


def test_api_key_create_and_update_use_the_same_policy(api_key_client, ctx):
    ctx.workflow.initial_state = ctx.todo
    ctx.workflow.save()
    ctx.workflow.restricted_creation_states.add(ctx.done)
    url = ctx.base.replace("/api/", "/api/v1/") + "work-items/"
    response = api_key_client.post(url, {"name": "API default"}, format="json")
    assert response.status_code == 201, response.data
    assert Issue.objects.get(pk=response.data["id"]).state_id == ctx.todo.id
    assert (
        api_key_client.post(url, {"name": "API blocked", "state": str(ctx.done.id)}, format="json").status_code == 400
    )
    assert api_key_client.patch(url + f"{ctx.issue.id}/", {"state": str(ctx.done.id)}, format="json").status_code == 400


def test_initial_state_must_allow_creation_and_last_creation_state_is_protected(session_client, ctx):
    assert session_client.patch(ctx.config, {"initial_state_id": str(ctx.todo.id)}, format="json").status_code == 200
    assert (
        session_client.patch(
            ctx.config + "states/", {"state_id": str(ctx.todo.id), "allow_creation": False}, format="json"
        ).status_code
        == 400
    )
    session_client.patch(ctx.config, {"initial_state_id": None}, format="json")
    for state in [ctx.backlog, ctx.done]:
        assert (
            session_client.patch(
                ctx.config + "states/", {"state_id": str(state.id), "allow_creation": False}, format="json"
            ).status_code
            == 200
        )
    assert (
        session_client.patch(
            ctx.config + "states/", {"state_id": str(ctx.todo.id), "allow_creation": False}, format="json"
        ).status_code
        == 400
    )


def test_cannot_use_foreign_or_triage_states(session_client, ctx):
    other = Project.objects.create(workspace=ctx.workspace, name="Other", identifier="OTHER")
    foreign = State.objects.create(project=other, name="Foreign")
    triage = State.objects.create(project=ctx.project, name="Triage", group="triage", is_triage=True)
    for state in [foreign, triage]:
        assert session_client.patch(ctx.config, {"initial_state_id": str(state.id)}, format="json").status_code == 400
        assert (
            session_client.post(
                ctx.config + "transitions/",
                {"source_id": str(ctx.backlog.id), "destination_id": str(state.id), "member_ids": []},
                format="json",
            ).status_code
            == 400
        )


def test_transition_crud_validation_and_history(session_client, ctx):
    payload = {"source_id": str(ctx.backlog.id), "destination_id": str(ctx.todo.id), "member_ids": []}
    assert session_client.post(ctx.config + "transitions/", payload, format="json").status_code == 400
    payload["destination_id"] = str(ctx.backlog.id)
    assert session_client.post(ctx.config + "transitions/", payload, format="json").status_code == 400
    payload["destination_id"] = str(ctx.done.id)
    response = session_client.post(ctx.config + "transitions/", payload, format="json")
    assert response.status_code == 200, response.data
    rule_id = next(r["id"] for r in response.data["transitions"] if r["destination_id"] == ctx.done.id)
    payload["member_ids"] = [str(ctx.user.id)]
    assert session_client.patch(ctx.config + f"transitions/{rule_id}/", payload, format="json").status_code == 200
    assert session_client.delete(ctx.config + f"transitions/{rule_id}/").status_code == 200
    response = session_client.get(ctx.config + "activities/")
    assert [a["action"] for a in response.data["results"]] == [
        "transition_deleted",
        "transition_updated",
        "transition_added",
    ]
    assert all(a.created_by_id == ctx.user.id for a in WorkflowActivity.objects.all())


def test_inactive_or_outside_members_are_rejected(session_client, ctx):
    other = User.objects.create(email="outside@example.invalid", username="workflow-outside")
    response = session_client.post(
        ctx.config + "transitions/",
        {"source_id": str(ctx.todo.id), "destination_id": str(ctx.done.id), "member_ids": [str(other.id)]},
        format="json",
    )
    assert response.status_code == 400


def test_only_project_or_workspace_admins_can_manage(session_client, ctx):
    ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(role=15)
    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(role=15)
    assert session_client.get(ctx.config).status_code == 200
    assert session_client.patch(ctx.config, {"enabled": False}, format="json").status_code == 403
    assert session_client.post(ctx.config + "transitions/", {}, format="json").status_code == 403
    assert session_client.delete(ctx.config + f"transitions/{ctx.rule.id}/").status_code == 403
    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(is_active=False)
    assert session_client.get(ctx.config).status_code == 403


def test_state_change_rechecked_after_validation_and_uses_fresh_source(ctx):
    serializer = IssueCreateSerializer(
        ctx.issue,
        data={"state_id": str(ctx.done.id)},
        partial=True,
        context={"project_id": ctx.project.id, "request": SimpleNamespace(user=ctx.user)},
    )
    assert serializer.is_valid(), serializer.errors
    with pytest.raises(ValidationError):
        serializer.save()
    Issue.objects.filter(pk=ctx.issue.id).update(state=ctx.todo)
    serializer.save()
    ctx.issue.refresh_from_db()
    assert ctx.issue.state_id == ctx.done.id


def test_other_property_updates_and_same_state_remain_possible(session_client, ctx):
    response = session_client.patch(
        ctx.base + f"issues/{ctx.issue.id}/", {"name": "Renamed", "state_id": str(ctx.backlog.id)}, format="json"
    )
    assert response.status_code == 204


def test_template_children_use_workflow_default(session_client, ctx):
    ctx.workflow.initial_state = ctx.todo
    ctx.workflow.save()
    response = session_client.post(
        ctx.base + "issues/", {"name": "Parent", "template_children": [{"name": "Child"}]}, format="json"
    )
    assert response.status_code == 201, response.data
    assert Issue.objects.get(name="Child").state_id == ctx.todo.id


@pytest.mark.parametrize("use_api", [False, True])
def test_accepting_intake_uses_workflow_initial_state(request, ctx, use_api):
    from plane.db.models import Intake, IntakeIssue

    ctx.workflow.initial_state = ctx.todo
    ctx.workflow.save()
    triage = State.objects.create(project=ctx.project, name="Triage", group="triage", is_triage=True)
    issue = Issue.objects.create(project=ctx.project, name="Intake", state=triage)
    intake = Intake.objects.create(project=ctx.project, name="Intake")
    IntakeIssue.objects.create(project=ctx.project, issue=issue, intake=intake)
    client = request.getfixturevalue("api_key_client" if use_api else "session_client")
    url = ctx.base.replace("/api/", "/api/v1/") if use_api else ctx.base
    # Both endpoints address the work item.
    response = client.patch(url + f"intake-issues/{issue.id}/", {"status": 1}, format="json")
    assert response.status_code == 200, response.data
    issue.refresh_from_db()
    assert issue.state_id == ctx.todo.id


def test_draft_publication_cannot_skip_creation_policy(session_client, ctx):
    from plane.db.models import DraftIssue

    draft = DraftIssue(workspace=ctx.workspace, project=ctx.project, name="Draft", created_by_id=ctx.user.id)
    draft.save(disable_auto_set_user=True)
    ctx.workflow.restricted_creation_states.add(ctx.done)
    url = f"/api/workspaces/{ctx.workspace.slug}/draft-to-issue/{draft.id}/"
    response = session_client.post(url, {"name": "Published", "state_id": str(ctx.done.id)}, format="json")
    assert response.status_code == 400
    assert DraftIssue.objects.filter(pk=draft.id).exists()
    assert not Issue.objects.filter(name="Published").exists()
    response = session_client.post(url, {"name": "Published", "state_id": str(ctx.todo.id)}, format="json")
    assert response.status_code == 201, response.data


@pytest.mark.parametrize("use_api", [False, True])
def test_workflow_referenced_states_cannot_be_deleted(request, ctx, use_api):
    client = request.getfixturevalue("api_key_client" if use_api else "session_client")
    url = ctx.base.replace("/api/", "/api/v1/") if use_api else ctx.base
    assert client.delete(url + f"states/{ctx.todo.id}/").status_code == 400
    assert State.objects.filter(pk=ctx.todo.id).exists()


def test_history_has_bounded_pages_and_project_isolation(session_client, ctx):
    for _ in range(30):
        WorkflowActivity.objects.create(project=ctx.project, action="enabled", data={"value": True})
    response = session_client.get(ctx.config + "activities/")
    assert len(response.data["results"]) == 25
    assert response.data["next_offset"] == 25
    second = session_client.get(ctx.config + "activities/", {"offset": 25})
    assert len(second.data["results"]) == 5
    assert second.data["next_offset"] is None
    other = Project.objects.create(workspace=ctx.workspace, name="Other", identifier="HISTORY")
    response = session_client.get(ctx.config.replace(str(ctx.project.id), str(other.id)))
    assert response.status_code == 403


def test_publishing_existing_draft_issue_checks_creation_policy(session_client, ctx):
    draft = Issue.objects.create(project=ctx.project, state=ctx.done, name="Legacy draft", is_draft=True)
    ctx.workflow.restricted_creation_states.add(ctx.done)
    serializer = IssueCreateSerializer(
        draft,
        data={"is_draft": False, "state_id": str(ctx.done.id)},
        partial=True,
        context={"project_id": ctx.project.id},
    )
    assert serializer.is_valid(), serializer.errors
    with pytest.raises(ValidationError):
        serializer.save()
    draft.refresh_from_db()
    assert draft.is_draft


def test_enabling_without_any_valid_creation_state_is_rejected(session_client, ctx):
    ctx.workflow.enabled = False
    ctx.workflow.save()
    ctx.workflow.restricted_creation_states.add(ctx.backlog, ctx.todo, ctx.done)
    response = session_client.patch(ctx.config, {"enabled": True}, format="json")
    assert response.status_code == 400
    ctx.workflow.refresh_from_db()
    assert not ctx.workflow.enabled
