from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import Mock

import pytest
from django.db import close_old_connections, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from plane.db.models import Issue, IssueActivity, Project, ProjectMember, User, WorkspaceMember
from plane.db.models.workflow import WorkflowApproval, WorkflowTransition
from plane.services.workflow_approval import (
    approval_representation,
    can_withdraw,
    decide_approval,
    sync_issue_approval,
    withdraw_approval,
)
from plane.tests.contract.app import test_workflow_core as workflow_fixtures
from plane.tests.contract.app.test_workflow_core import approval_rule
from plane.utils.workflow import WorkflowConflict, finish_workflow_write, prepare_workflow_write, verify_workflow_write

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def core(workspace, create_user, monkeypatch):
    return workflow_fixtures.core.__wrapped__(workspace, create_user, monkeypatch)


def enter(core):
    core.custom.states.add(core.backlog)
    rule = approval_rule(core)
    core.issue.state = core.backlog
    core.issue.save()
    attrs = {"state": core.todo}
    prepared = prepare_workflow_write(core.project.pk, attrs, core.issue, core.user)
    with transaction.atomic():
        Project.objects.select_for_update().get(pk=core.project.pk)
        issue = Issue.objects.select_for_update().get(pk=core.issue.pk)
        verify_workflow_write(prepared, issue, actor=core.user)
        issue.state = core.todo
        issue.save()
        finish_workflow_write(prepared, issue, core.user)
    return WorkflowApproval.objects.get(issue=core.issue, status="pending"), rule


def withdraw(core, approval, key="withdraw", version=1, actor=None):
    return withdraw_approval(core.project.pk, core.issue.pk, approval.pk, version, key, actor or core.user)


def test_actual_entry_snapshot_withdrawal_restores_state_and_activities(core, monkeypatch):
    approval, _ = enter(core)
    assert approval.previous_state_id == core.backlog.pk
    assert approval.requested_by_id == core.user.pk
    assert approval_representation(approval, core.user)["can_withdraw"] is True
    runner = Mock(side_effect=AssertionError("Withdrawal must not execute scripts"))
    monkeypatch.setattr("plane.utils.workflow_runner.prepare_runner_execution", runner)
    result = withdraw(core, approval)
    core.issue.refresh_from_db()
    assert core.issue.state_id == core.backlog.pk
    assert core.issue.state_changed_at is not None
    assert result.status == "cancelled" and result.version == 2
    assert result.invalidation_reason == "withdrawn" and result.decision == {}
    assert result.withdrawal["previous_state_id"] == str(core.backlog.pk)
    assert result.withdrawal["actor_id"] == str(core.user.pk)
    assert IssueActivity.objects.filter(issue=core.issue, field="approval", verb="withdrawn").count() == 1
    assert IssueActivity.objects.filter(issue=core.issue, field="state", new_identifier=core.backlog.pk).count() == 1
    assert not WorkflowApproval.objects.filter(issue=core.issue, status="pending").exists()
    assert withdraw(core, approval).withdrawal == result.withdrawal
    assert IssueActivity.objects.filter(issue=core.issue, verb="withdrawn").count() == 1
    runner.assert_not_called()


def test_snapshot_uses_locked_actual_state_and_api_representation(session_client, core):
    core.custom.states.add(core.backlog)
    approval_rule(core)
    core.issue.state = core.backlog
    core.issue.save()
    response = session_client.patch(core.base + f"issues/{core.issue.pk}/", {"state": str(core.todo.pk)}, format="json")
    assert response.status_code == 204, response.data
    approval = WorkflowApproval.objects.get(issue=core.issue, status="pending")
    assert approval.previous_state_id == core.backlog.pk
    assert approval.requested_by_id == core.user.pk
    url = core.base + f"issues/{core.issue.pk}/approvals/{approval.pk}/withdraw/"
    assert session_client.post(url, {"version": 0, "idempotency_key": "x"}, format="json").status_code == 400
    assert session_client.post(url, {"version": 1, "idempotency_key": "x" * 129}, format="json").status_code == 400
    response = session_client.post(url, {"version": 1, "idempotency_key": "x"}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["can_withdraw"] is False
    assert str(response.data["previous_state_id"]) == str(core.backlog.pk)


def test_sync_and_reapply_do_not_invent_snapshot(core):
    core.custom.states.add(core.backlog)
    approval_rule(core)
    approval = sync_issue_approval(core.issue, core.user)
    assert approval.previous_state_id is None and approval.requested_by_id is None
    assert not can_withdraw(approval, core.user)
    with pytest.raises(ValidationError, match="WITHDRAW_NOT_ALLOWED"):
        withdraw(core, approval)
    replacement = sync_issue_approval(core.issue, core.user, force=True)
    assert replacement.previous_state_id is None and replacement.requested_by_id is None


@pytest.mark.parametrize(
    "invalid", ["archived", "draft", "state", "mapping", "approval_source", "policy", "rule", "membership", "disabled"]
)
def test_withdraw_eligibility_rechecks_current_context(core, invalid):
    approval, rule = enter(core)
    if invalid == "archived":
        Issue.objects.filter(pk=core.issue.pk).update(archived_at=timezone.now())
    elif invalid == "draft":
        Issue.objects.filter(pk=core.issue.pk).update(is_draft=True)
    elif invalid == "state":
        Issue.objects.filter(pk=core.issue.pk).update(state=core.done)
    elif invalid == "mapping":
        core.custom.states.remove(core.backlog)
    elif invalid == "approval_source":
        WorkflowTransition.objects.create(
            project=core.project,
            workflow=core.custom,
            source=core.backlog,
            destination=core.done,
            kind="approval",
            reject_state=core.todo,
        )
    elif invalid == "policy":
        Project.objects.filter(pk=core.project.pk).update(workflow_version=99)
    elif invalid == "rule":
        WorkflowTransition.objects.filter(pk=rule.pk).update(version=2)
    elif invalid == "membership":
        ProjectMember.objects.filter(project=core.project, member=core.user).update(role=5)
    elif invalid == "disabled":
        Project.objects.filter(pk=core.project.pk).update(workflow_enabled=False)
    assert not can_withdraw(approval, core.user)
    with pytest.raises(ValidationError, match="WITHDRAW_NOT_ALLOWED"):
        withdraw(core, approval)
    approval.refresh_from_db()
    assert approval.status == "pending"


def test_wrong_actor_version_and_cross_operation_idempotency(core):
    approval, rule = enter(core)
    other = User.objects.create(email="withdraw-other@example.invalid", username="withdraw-other")
    WorkspaceMember.objects.create(workspace=core.workspace, member=other, role=15)
    ProjectMember.objects.create(project=core.project, member=other, role=15)
    assert not can_withdraw(approval, other)
    with pytest.raises(ValidationError, match="WITHDRAW_NOT_ALLOWED"):
        withdraw(core, approval, actor=other)
    with pytest.raises(WorkflowConflict):
        withdraw(core, approval, version=2)
    withdraw(core, approval)
    with pytest.raises(WorkflowConflict, match="IDEMPOTENCY_CONFLICT"):
        withdraw(core, approval, actor=other)
    with pytest.raises(WorkflowConflict):
        decide_approval(core.project.pk, core.issue.pk, approval.pk, rule.pk, "approve", 1, "withdraw", core.user)


def test_decided_approval_cannot_withdraw(core):
    approval, rule = enter(core)
    result = decide_approval(core.project.pk, core.issue.pk, approval.pk, rule.pk, "approve", 1, "decision", core.user)
    assert not can_withdraw(result, core.user)
    with pytest.raises(WorkflowConflict):
        withdraw(core, result, key="decision", version=2)
    with pytest.raises(WorkflowConflict, match="ALREADY_DECIDED"):
        withdraw(core, result, version=2)


@pytest.mark.parametrize("note", [None, "", "  审核通过\n保留说明  "])
def test_decision_note_api_optional_trimmed_and_idempotent(session_client, core, note):
    approval, rule = enter(core)
    url = core.base + f"issues/{core.issue.pk}/approvals/{approval.pk}/decide/"
    payload = {"version": 1, "idempotency_key": "decision", "transition_id": str(rule.pk), "outcome": "approve"}
    if note is not None:
        payload["note"] = note
    response = session_client.post(url, payload, format="json")
    assert response.status_code == 200, response.data
    assert response.data["decision"]["note"] == (note or "").strip()
    assert session_client.post(url, payload, format="json").status_code == 200
    assert session_client.post(url, {**payload, "note": "changed"}, format="json").status_code == 409


def test_decision_note_rejects_oversize_without_mutation(session_client, core):
    approval, rule = enter(core)
    response = session_client.post(
        core.base + f"issues/{core.issue.pk}/approvals/{approval.pk}/decide/",
        {
            "version": 1,
            "idempotency_key": "long",
            "transition_id": str(rule.pk),
            "outcome": "approve",
            "note": "n" * 2001,
        },
        format="json",
    )
    assert response.status_code == 400
    approval.refresh_from_db()
    assert approval.status == "pending"


@pytest.mark.django_db(transaction=True)
def test_withdraw_and_decide_serialize_one_winner(core, monkeypatch):
    monkeypatch.setattr("plane.bgtasks.workflow_runner_task.queue_approval_email", Mock())
    approval, rule = enter(core)
    barrier = Barrier(2, timeout=10)

    def race(action):
        close_old_connections()
        try:
            barrier.wait()
            if action == "withdraw":
                return withdraw(core, approval).status
            return decide_approval(
                core.project.pk, core.issue.pk, approval.pk, rule.pk, "approve", 1, "decide", core.user
            ).status
        except WorkflowConflict:
            return "conflict"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(race, ["withdraw", "decide"]))
    assert results.count("conflict") == 1
    approval.refresh_from_db()
    core.issue.refresh_from_db()
    assert core.issue.state_id == (core.backlog.pk if approval.status == "cancelled" else core.done.pk)
    assert approval.version == 2
    assert (
        IssueActivity.objects.filter(issue=core.issue, field="approval", verb__in=["withdrawn", "approved"]).count()
        == 1
    )


def test_entry_snapshot_is_captured_after_lock_not_prepare(core):
    core.custom.states.add(core.backlog)
    approval_rule(core)
    core.issue.state = core.backlog
    core.issue.save()
    prepared = prepare_workflow_write(core.project.pk, {"state": core.todo}, core.issue, core.user)
    Issue.objects.filter(pk=core.issue.pk).update(state=core.done)
    with transaction.atomic():
        Project.objects.select_for_update().get(pk=core.project.pk)
        issue = Issue.objects.select_for_update().get(pk=core.issue.pk)
        verify_workflow_write(prepared, issue, actor=core.user)
        issue.state = core.todo
        issue.save()
        finish_workflow_write(prepared, issue, core.user)
    approval = WorkflowApproval.objects.get(issue=core.issue, status="pending")
    assert approval.previous_state_id == core.done.pk


@pytest.mark.parametrize("kind", ["creation", "draft", "type_change", "intake"])
def test_non_normal_entry_does_not_receive_restore_snapshot(core, kind):
    from plane.db.models import State

    core.custom.states.add(core.backlog)
    approval_rule(core)
    core.issue.state = core.backlog
    if kind == "draft":
        core.issue.is_draft = True
    if kind == "intake":
        core.issue.state = State.objects.create(project=core.project, name="Intake", group="triage", is_triage=True)
    core.issue.save()
    attrs = {"state": core.todo}
    instance = core.issue
    if kind == "creation":
        instance = None
    elif kind == "draft":
        attrs["is_draft"] = False
    elif kind == "type_change":
        attrs["type"] = None
    prepared = prepare_workflow_write(core.project.pk, attrs, instance, core.user)
    with transaction.atomic():
        Project.objects.select_for_update().get(pk=core.project.pk)
        if instance:
            instance = Issue.objects.select_for_update().get(pk=core.issue.pk)
        verify_workflow_write(prepared, instance, actor=core.user)
    assert prepared["approval_entry"] is None
