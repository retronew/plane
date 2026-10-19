from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from django.db import transaction
from rest_framework.exceptions import ValidationError

from plane.db.models import Issue, IssueType, Project, ProjectIssueType, ProjectMember, State, User, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowActivity, WorkflowTransition
from plane.services.workflow_approval import decide_approval, sync_issue_approval
from plane.utils.workflow import WorkflowConflict, normalize_issue_type, validate_workflow_write

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def core(workspace, create_user, monkeypatch):
    from plane.app.views.issue import base

    monkeypatch.setattr(base.issue_activity, "delay", Mock())
    monkeypatch.setattr(base.model_activity, "delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Typed workflows", identifier="TYPED")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    backlog = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    todo = State.objects.create(project=project, name="Todo", group="unstarted")
    done = State.objects.create(project=project, name="Done", group="completed")
    default = ProjectWorkflow.objects.create(project=project, enabled=True)
    custom = ProjectWorkflow.objects.create(project=project, name="Bug workflow", is_default=False, initial_state=todo)
    custom.states.set([todo, done])
    bug = IssueType.objects.create(workspace=workspace, name="Bug")
    binding = ProjectIssueType.objects.create(project=project, issue_type=bug, workflow=custom, is_default=True)
    issue = Issue.objects.create(project=project, name="Existing bug", type=bug, state=todo)
    base_url = f"/api/workspaces/{workspace.slug}/projects/{project.pk}/"
    return SimpleNamespace(
        project=project,
        default=default,
        custom=custom,
        bug=bug,
        binding=binding,
        backlog=backlog,
        todo=todo,
        done=done,
        issue=issue,
        user=create_user,
        workspace=workspace,
        base=base_url,
    )


def test_type_normalization_default_omission_null_and_cross_project(core):
    attrs = normalize_issue_type(core.project.pk, {})
    assert attrs["type"] == core.bug
    assert normalize_issue_type(core.project.pk, {}, core.issue) == {}
    assert normalize_issue_type(core.project.pk, {"type_id": None}, core.issue) == {"type": None}
    foreign = IssueType.objects.create(workspace=core.workspace, name="Foreign")
    with pytest.raises(ValidationError, match="WORKFLOW_INVALID_TYPE"):
        normalize_issue_type(core.project.pk, {"type": foreign})
    with pytest.raises(ValidationError, match="WORKFLOW_CONFLICTING_TYPE"):
        normalize_issue_type(core.project.pk, {}, raw_data={"type": str(foreign.pk), "type_id": str(core.bug.pk)})


def test_type_workflow_state_set_and_inactive_does_not_fall_back(core):
    attrs = validate_workflow_write(core.project.pk, {"name": "Created"})
    assert attrs["type"] == core.bug
    assert attrs["state"] == core.todo
    with pytest.raises(ValidationError, match="WORKFLOW_INVALID_STATE"):
        validate_workflow_write(core.project.pk, {"type": core.bug, "state": core.backlog})
    WorkflowTransition.objects.create(
        project=core.project, workflow=core.default, source=core.todo, destination=core.backlog
    )
    core.custom.is_active = False
    core.custom.save()
    # Bound inactive rules pause independently, so the default edge does not restrict it.
    validate_workflow_write(core.project.pk, {"state": core.done}, core.issue, core.user)


def test_only_type_change_requires_mapping_and_source_path_still_applies(core):
    plain = Issue.objects.create(project=core.project, name="Plain", state=core.backlog)
    with pytest.raises(ValidationError, match="WORKFLOW_STATE_MAPPING_REQUIRED"):
        validate_workflow_write(core.project.pk, {"type": core.bug}, plain, core.user)
    WorkflowTransition.objects.create(
        project=core.project, workflow=core.default, source=core.backlog, destination=core.done
    )
    with pytest.raises(ValidationError, match="WORKFLOW_TRANSITION_NOT_ALLOWED"):
        validate_workflow_write(core.project.pk, {"type": core.bug, "state": core.todo}, plain, core.user)


def test_runtime_reads_project_switch_only(core):
    Project.objects.filter(pk=core.project.pk).update(workflow_enabled=False)
    ProjectWorkflow.objects.filter(pk=core.default.pk).update(enabled=True)
    validate_workflow_write(core.project.pk, {"type": core.bug, "state": core.backlog})


def test_workflow_crud_versions_and_get_is_side_effect_free(session_client, core):
    url = core.base + "workflows/"
    response = session_client.get(url)
    assert response.status_code == 200
    assert len(response.data["results"]) == 2
    response = session_client.post(
        url, {"name": "Release", "state_ids": [str(core.todo.pk), str(core.done.pk)]}, format="json"
    )
    assert response.status_code == 201, response.data
    detail = url + str(response.data["id"]) + "/"
    assert session_client.patch(detail, {"name": "Renamed"}, format="json").status_code == 409
    version = response.data["version"]
    response = session_client.patch(detail, {"name": "Renamed", "version": version}, format="json")
    assert response.status_code == 200, response.data
    assert session_client.patch(detail, {"name": "Lost update", "version": version}, format="json").status_code == 409
    assert session_client.delete(core.base + "workflows/default/").status_code == 400


def test_preview_apply_rechecks_issue_set_and_maps_state(session_client, core):
    other = ProjectWorkflow.objects.create(project=core.project, name="Only done", is_default=False)
    other.states.add(core.done)
    payload = {
        "operation": "bind_type",
        "type_id": str(core.bug.pk),
        "workflow_id": str(other.pk),
        "state_mapping": {str(core.todo.pk): str(core.done.pk)},
    }
    preview_url, apply_url = core.base + "workflows/preview/", core.base + "workflows/apply/"
    preview = session_client.post(preview_url, payload, format="json")
    assert preview.status_code == 200, preview.data
    assert preview.data["affected_count"] == 1
    Issue.objects.filter(pk=core.issue.pk).update(name="Changed after preview")
    stale = session_client.post(apply_url, {**payload, "token": preview.data["token"]}, format="json")
    assert stale.status_code == 409, stale.data
    preview = session_client.post(preview_url, payload, format="json")
    applied = session_client.post(apply_url, {**payload, "token": preview.data["token"]}, format="json")
    assert applied.status_code == 200, applied.data
    core.issue.refresh_from_db()
    core.binding.refresh_from_db()
    assert core.issue.state_id == core.done.pk
    assert core.binding.workflow_id == other.pk


def test_state_removal_and_deletion_keep_last_creatable_state_even_when_paused(session_client, core):
    from plane.utils.workflow import validate_workflow_state_deletion

    core.custom.initial_state = None
    core.custom.is_active = False
    core.custom.save()
    core.custom.restricted_creation_states.add(core.done)
    with pytest.raises(ValidationError, match="WORKFLOW_NO_CREATION_STATE"):
        validate_workflow_state_deletion(core.todo)
    core.default.initial_state = core.backlog
    core.default.save()
    with pytest.raises(ValidationError, match="WORKFLOW_STATE_IN_USE"):
        validate_workflow_state_deletion(core.backlog)


def test_history_snapshots_direction_watermark_and_cursor_scope(session_client, core):
    url = core.base + "workflows/default/"
    response = session_client.post(
        url + "transitions/",
        {"source_id": str(core.backlog.pk), "destination_id": str(core.done.pk), "member_ids": [str(core.user.pk)]},
        format="json",
    )
    assert response.status_code == 200, response.data
    rule_id = response.data["transitions"][0]["id"]
    response = session_client.patch(
        url + f"transitions/{rule_id}/",
        {"source_id": str(core.backlog.pk), "destination_id": str(core.done.pk), "member_ids": []},
        format="json",
    )
    assert response.status_code == 200
    event = WorkflowActivity.objects.filter(action="transition_updated").get()
    assert event.data["before"]["member_mode"] == "explicit"
    assert event.data["before"]["members"][0]["id"] == str(core.user.pk)
    assert event.data["after"]["member_mode"] == "all"
    for i in range(30):
        WorkflowActivity.objects.create(project=core.project, workflow=core.default, action="history", data={"n": i})
    first = session_client.get(url + "activities/", {"direction": "asc"})
    assert len(first.data["results"]) == 25
    WorkflowActivity.objects.create(project=core.project, workflow=core.default, action="new_after_watermark")
    second = session_client.get(
        url + "activities/",
        {"direction": "asc", "watermark": first.data["watermark"], "cursor": first.data["next_cursor"]},
    )
    assert second.status_code == 200, second.data
    assert len(second.data["results"]) == 7
    assert all(a["action"] != "new_after_watermark" for a in second.data["results"])
    invalid = session_client.get(
        url + "activities/",
        {"direction": "desc", "watermark": first.data["watermark"], "cursor": first.data["next_cursor"]},
    )
    assert invalid.status_code == 400


def approval_rule(core, mode="all"):
    return WorkflowTransition.objects.create(
        project=core.project,
        workflow=core.custom,
        source=core.todo,
        destination=core.done,
        kind="approval",
        reject_state=core.backlog,
        approver_mode=mode,
    )


def test_approval_all_snapshot_direct_write_restriction_and_idempotent_decision(core):
    # Reject targets, like approve targets, belong to the explicit state set.
    core.custom.states.add(core.backlog)
    rule = approval_rule(core)
    with transaction.atomic():
        approval = sync_issue_approval(core.issue, core.user)
    assert approval.branches[0]["approver_mode"] == "all"
    assert str(core.user.pk) in {m["id"] for m in approval.branches[0]["approvers"]}
    with pytest.raises(ValidationError, match="WORKFLOW_APPROVAL_REQUIRED"):
        validate_workflow_write(core.project.pk, {"state": core.done}, core.issue, core.user)
    with pytest.raises(ValidationError, match="WORKFLOW_APPROVAL_REQUIRED"):
        validate_workflow_write(core.project.pk, {"type": None}, core.issue, core.user)
    decided = decide_approval(
        core.project.pk, core.issue.pk, approval.pk, rule.pk, "approve", 1, "approval-once", core.user
    )
    core.issue.refresh_from_db()
    assert core.issue.state_id == core.done.pk
    assert decided.status == "approved"
    replay = decide_approval(
        core.project.pk, core.issue.pk, approval.pk, rule.pk, "approve", 1, "approval-once", core.user
    )
    assert replay.pk == decided.pk
    with pytest.raises(WorkflowConflict):
        decide_approval(core.project.pk, core.issue.pk, approval.pk, rule.pk, "reject", 1, "other", core.user)


def test_new_all_member_does_not_join_existing_snapshot_and_permission_is_rechecked(core):
    core.custom.states.add(core.backlog)
    rule = approval_rule(core)
    approval = sync_issue_approval(core.issue, core.user)
    other = User.objects.create(email="late-approver@example.invalid", username="late-approver")
    WorkspaceMember.objects.create(workspace=core.workspace, member=other, role=15)
    ProjectMember.objects.create(project=core.project, member=other, role=15)
    with pytest.raises(ValidationError, match="WORKFLOW_APPROVER_NOT_ALLOWED"):
        decide_approval(core.project.pk, core.issue.pk, approval.pk, rule.pk, "approve", 1, "late", other)
    ProjectMember.objects.filter(project=core.project, member=core.user).update(role=5)
    with pytest.raises(ValidationError, match="WORKFLOW_APPROVER_NOT_ALLOWED"):
        decide_approval(core.project.pk, core.issue.pk, approval.pk, rule.pk, "approve", 1, "demoted", core.user)


def test_multibranch_reject_then_reentry_creates_fresh_snapshot(core):
    core.custom.states.add(core.backlog)
    rule = approval_rule(core, "explicit")
    rule.approvers.add(core.user)
    other = WorkflowTransition.objects.create(
        project=core.project,
        workflow=core.custom,
        source=core.todo,
        destination=core.backlog,
        kind="approval",
        reject_state=core.done,
    )
    approval = sync_issue_approval(core.issue, core.user)
    assert len(approval.branches) == 2
    decide_approval(core.project.pk, core.issue.pk, approval.pk, rule.pk, "reject", 1, "reject", core.user)
    core.issue.refresh_from_db()
    assert core.issue.state_id == core.backlog.pk
    core.issue.state = core.todo
    core.issue.save()
    new = sync_issue_approval(core.issue, core.user)
    assert new.pk != approval.pk and new.entry_sequence == 2
    other.version += 1
    other.save()
    with pytest.raises(WorkflowConflict, match="WORKFLOW_APPROVAL_STALE"):
        decide_approval(core.project.pk, core.issue.pk, new.pk, other.pk, "approve", 1, "old-rule", core.user)


def test_outgoing_rules_cannot_mix_approval_and_direct_and_invalid_targets(session_client, core):
    url = core.base + f"workflows/{core.custom.pk}/transitions/"
    payload = {
        "source_id": str(core.todo.pk),
        "destination_id": str(core.done.pk),
        "kind": "approval",
        "reject_state_id": str(core.backlog.pk),
        "approver_mode": "all",
        "version": 1,
    }
    assert session_client.post(url, payload, format="json").status_code == 400
    core.custom.states.add(core.backlog)
    response = session_client.post(url, payload, format="json")
    assert response.status_code == 200, response.data
    payload = {
        "source_id": str(core.todo.pk),
        "destination_id": str(core.backlog.pk),
        "member_ids": [],
        "version": response.data["version"],
    }
    assert session_client.post(url, payload, format="json").status_code == 400


def test_configuration_mutation_invalidates_pending_and_restart_takes_new_snapshot(session_client, core):
    from plane.db.models.workflow import WorkflowApproval

    core.custom.states.add(core.backlog)
    rule = approval_rule(core)
    pending = sync_issue_approval(core.issue, core.user)
    detail = core.base + f"workflows/{core.custom.pk}/"
    response = session_client.patch(
        detail + "states/", {"state_id": str(core.done.pk), "allow_creation": False, "version": 1}, format="json"
    )
    assert response.status_code == 200, response.data
    pending.refresh_from_db()
    assert pending.status == "cancelled" and pending.version == 2
    assert response.data["version"] == 2
    reapply = core.base + f"issues/{core.issue.pk}/approvals/reapply/"
    response = session_client.post(reapply, {}, format="json")
    assert response.status_code == 201, response.data
    assert response.data["entry_sequence"] == 2
    assert response.data["branches"][0]["id"] == str(rule.pk)
    assert session_client.patch(core.base + "workflows/default/", {"enabled": False}, format="json").status_code == 200
    assert not WorkflowApproval.objects.filter(issue=core.issue, status="pending").exists()
    response = session_client.patch(core.base + "workflows/default/", {"enabled": True}, format="json")
    assert response.status_code == 200, response.data
    assert WorkflowApproval.objects.get(issue=core.issue, status="pending").entry_sequence == 3


def test_delete_workflow_preview_falls_back_and_keeps_issue_type(session_client, core):
    payload = {"operation": "delete", "workflow_id": str(core.custom.pk)}
    preview = session_client.post(core.base + "workflows/preview/", payload, format="json")
    assert preview.status_code == 200, preview.data
    response = session_client.post(
        core.base + "workflows/apply/", {**payload, "token": preview.data["token"]}, format="json"
    )
    assert response.status_code == 200, response.data
    core.binding.refresh_from_db()
    assert core.binding.workflow_id is None
    assert IssueType.objects.filter(pk=core.bug.pk).exists()
    assert not ProjectWorkflow.objects.filter(pk=core.custom.pk).exists()
    from plane.utils.workflow import resolve_issue_workflow

    assert resolve_issue_workflow(core.project.pk, core.bug.pk).pk == core.default.pk


@pytest.mark.parametrize("level", [0, 1, 2])
def test_type_creation_persists_hierarchy_level(session_client, core, level):
    response = session_client.post(
        core.base + "issue-types/", {"name": "Hierarchy type", "level": level}, format="json"
    )
    assert response.status_code == 201, response.data
    assert response.data["level"] == level
    # Level now lives on its own field; `is_epic` is no longer derived from it.
    assert response.data["is_epic"] is False
    binding = ProjectIssueType.objects.get(project=core.project, issue_type_id=response.data["id"])
    assert binding.level == level
    assert binding.issue_type.level == level
    listing = session_client.get(core.base + "issue-types/")
    assert (
        next(item for item in listing.data["results"] if str(item["id"]) == str(response.data["id"]))["level"] == level
    )


@pytest.mark.parametrize("level", [-1, 1.5, "invalid", None, 2147483648])
def test_type_creation_rejects_invalid_hierarchy_without_writing(session_client, core, level):
    count = IssueType.objects.count()
    response = session_client.post(
        core.base + "issue-types/", {"name": "Invalid hierarchy", "level": level}, format="json"
    )
    assert response.status_code == 400
    assert IssueType.objects.count() == count


def test_type_default_is_project_unique_and_metadata_requires_version(session_client, core):
    response = session_client.post(core.base + "issue-types/", {"name": "Task", "is_default": True}, format="json")
    assert response.status_code == 201, response.data
    assert ProjectIssueType.objects.filter(project=core.project, is_default=True).count() == 1
    core.binding.refresh_from_db()
    assert not core.binding.is_default
    url = core.base + f"issue-types/{response.data['id']}/"
    assert session_client.patch(url, {"name": "New name"}, format="json").status_code == 409
    core.project.refresh_from_db()
    response = session_client.patch(url, {"name": "New name", "version": core.project.workflow_version}, format="json")
    assert response.status_code == 200, response.data


def test_approval_outcome_without_steps_does_not_run_other_outcome_scripts(core, monkeypatch):
    from plane.utils import workflow_runner

    core.custom.states.add(core.backlog)
    rule = approval_rule(core)
    rule.steps = [{"phase": "pre", "outcome": "reject", "script_version_id": "other-outcome-only"}]
    rule.save()
    approval = sync_issue_approval(core.issue, core.user)
    prepare = Mock(side_effect=AssertionError("Unselected outcome must not execute"))
    monkeypatch.setattr(workflow_runner, "prepare_runner_execution", prepare)
    result = decide_approval(
        core.project.pk, core.issue.pk, approval.pk, rule.pk, "approve", 1, "approve-no-script", core.user
    )
    assert result.status == "approved"
    prepare.assert_not_called()


@pytest.mark.parametrize("public_api", [False, True])
def test_project_metadata_patch_cannot_change_workflow_switch_version_or_lifecycle(
    request, core, public_api, monkeypatch
):
    from plane.api.views import project as public_views
    from plane.app.views.project import base as app_views

    monkeypatch.setattr(public_views.model_activity, "delay", Mock())
    monkeypatch.setattr(app_views.model_activity, "delay", Mock())
    core.project.refresh_from_db()
    original_version = core.project.workflow_version
    client = request.getfixturevalue("api_key_client" if public_api else "session_client")
    url = f"/api/{'v1/' if public_api else ''}workspaces/{core.workspace.slug}/projects/{core.project.pk}/"
    response = client.patch(
        url,
        {
            "workflow_enabled": False,
            "workflow_version": 99999,
            "is_issue_type_enabled": True,
            "archived_at": "2026-10-16T00:00:00Z",
            "deleted_at": "2026-10-16T00:00:00Z",
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    core.project.refresh_from_db()
    assert core.project.workflow_enabled is True
    assert core.project.workflow_version == original_version
    assert core.project.is_issue_type_enabled is False
    assert core.project.archived_at is None
    assert core.project.deleted_at is None


def test_disable_preview_keeps_illegal_current_state_and_cancels_approval(session_client, core):
    from plane.db.models.workflow import WorkflowApproval

    core.custom.states.add(core.backlog)
    approval_rule(core)
    pending = sync_issue_approval(core.issue, core.user)
    # Existing data can be outside a paused/edited set. Disabling must remain possible.
    core.custom.states.remove(core.todo)
    payload = {"operation": "enable", "workflow_id": str(core.custom.pk), "is_active": False}
    response = session_client.post(core.base + "workflows/preview/", payload, format="json")
    assert response.status_code == 200, response.data
    assert response.data["required_state_ids"] == []
    response = session_client.post(
        core.base + "workflows/apply/", {**payload, "token": response.data["token"]}, format="json"
    )
    assert response.status_code == 200, response.data
    core.issue.refresh_from_db()
    core.custom.refresh_from_db()
    pending.refresh_from_db()
    assert core.issue.state_id == core.todo.pk
    assert not core.custom.is_active
    assert pending.status == "cancelled"
    assert not WorkflowApproval.objects.filter(issue=core.issue, status="pending").exists()


@pytest.mark.parametrize("public_api", [False, True])
def test_issue_project_fields_cannot_move_pending_work_item(request, core, public_api):
    core.custom.states.add(core.backlog)
    approval_rule(core)
    approval = sync_issue_approval(core.issue, core.user)
    other = Project.objects.create(workspace=core.workspace, name="Move target", identifier="MOVETO")
    ProjectMember.objects.create(project=other, member=core.user, role=20)
    client = request.getfixturevalue("api_key_client" if public_api else "session_client")
    url = (
        core.base.replace("/api/", "/api/v1/") + f"work-items/{core.issue.pk}/"
        if public_api
        else core.base + f"issues/{core.issue.pk}/"
    )
    response = client.patch(url, {"project": str(other.pk), "project_id": str(other.pk)}, format="json")
    assert response.status_code in (200, 204), response.data
    core.issue.refresh_from_db()
    approval.refresh_from_db()
    assert core.issue.project_id == core.project.pk
    assert core.issue.type_id == core.bug.pk
    assert core.issue.state_id == core.todo.pk
    assert approval.status == "pending"
