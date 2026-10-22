from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from plane.db.models import Issue, Project, ProjectMember, State, WorkspaceMember
from plane.db.models.feishu import FeishuBinding, FeishuCardAction, FeishuDelivery
from plane.db.models.workflow import ProjectWorkflow, WorkflowTransition
from plane.services import feishu_actions
from plane.services.workflow_approval import decide_approval, sync_issue_approval
from plane.utils import workflow

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def card(workspace, create_user, monkeypatch):
    monkeypatch.setattr(feishu_actions, "get_feishu_config", lambda: SimpleNamespace(enabled=True, app_id="app"))
    monkeypatch.setattr(feishu_actions.issue_activity, "delay", Mock())
    monkeypatch.setattr(feishu_actions.model_activity, "delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Cards", identifier="CARD", workflow_enabled=True)
    membership = ProjectMember.objects.create(project=project, member=create_user, role=20)
    todo = State.objects.create(project=project, name="Todo", group="unstarted", default=True)
    done = State.objects.create(project=project, name="Done", group="completed")
    rejected = State.objects.create(project=project, name="Rejected", group="cancelled")
    issue = Issue.objects.create(project=project, name="Card issue", state=todo)
    binding = FeishuBinding.objects.create(user=create_user, app_id="app", tenant_key="tenant", open_id="person")
    delivery = FeishuDelivery.objects.create(
        user=create_user,
        binding=binding,
        workspace=workspace,
        project=project,
        issue=issue,
        event_key="card-event",
        kind="issue_updated",
        title="Test",
        status="sent",
    )
    action = FeishuCardAction.objects.create(
        delivery=delivery,
        binding=binding,
        key="state",
        operation="state",
        payload={
            "state_id": str(done.pk),
            "expected_state_id": str(todo.pk),
            "expected_updated_at": issue.updated_at.isoformat(),
        },
        status="processing",
        expires_at=timezone.now() + timedelta(hours=1),
    )
    return SimpleNamespace(
        action=action,
        delivery=delivery,
        binding=binding,
        user=create_user,
        project=project,
        workspace=workspace,
        membership=membership,
        issue=issue,
        todo=todo,
        done=done,
        rejected=rejected,
    )


def approval_action(card, outcome):
    graph = ProjectWorkflow.objects.create(project=card.project, enabled=True)
    rule = WorkflowTransition.objects.create(
        project=card.project,
        workflow=graph,
        source=card.todo,
        destination=card.done,
        kind="approval",
        reject_state=card.rejected,
        approver_mode="all",
    )
    approval = sync_issue_approval(card.issue, card.user)
    card.action.operation = outcome
    card.action.payload = {"approval_id": str(approval.pk), "transition_id": str(rule.pk), "version": approval.version}
    card.action.save()
    return approval, rule


def test_state_write_is_atomic_and_emits_normal_activity_once(card, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        result = feishu_actions.execute_card_action(card.action)
    card.issue.refresh_from_db()
    card.action.refresh_from_db()
    assert result == {"code": "state_updated"}
    assert card.issue.state_id == card.done.pk
    assert card.issue.updated_by_id == card.user.pk
    assert card.issue.completed_at is not None
    assert card.action.status == "succeeded"
    assert card.action.completed_at is not None
    activity = feishu_actions.issue_activity.delay.call_args.kwargs
    assert activity["notification"] is True
    assert activity["actor_id"] == str(card.user.pk)
    assert str(card.todo.pk) in activity["current_instance"]
    assert feishu_actions.model_activity.delay.call_args.kwargs["requested_data"] == {"state_id": str(card.done.pk)}
    with django_capture_on_commit_callbacks(execute=True):
        assert feishu_actions.execute_card_action(card.action) == result
    feishu_actions.issue_activity.delay.assert_called_once()
    feishu_actions.model_activity.delay.assert_called_once()


@pytest.mark.parametrize(
    "change",
    [
        "source",
        "timestamp",
        "expired",
        "unbound",
        "rebound",
        "inactive",
        "member",
        "workspace_member",
        "guest",
        "archived",
        "scope",
        "pending",
        "failed",
    ],
)
def test_invalid_actions_never_change_issue(card, change):
    if change == "source":
        card.action.payload["expected_state_id"] = str(card.done.pk)
    elif change == "timestamp":
        card.action.payload["expected_updated_at"] = (card.issue.updated_at - timedelta(seconds=1)).isoformat()
    elif change == "expired":
        card.action.expires_at = timezone.now() - timedelta(seconds=1)
    elif change == "unbound":
        card.binding.delete()
        card.action.refresh_from_db()
    elif change == "rebound":
        card.delivery.binding = None
        card.delivery.save()
    elif change == "inactive":
        card.user.is_active = False
        card.user.save()
    elif change == "member":
        card.membership.is_active = False
        card.membership.save()
    elif change == "workspace_member":
        WorkspaceMember.objects.filter(workspace=card.workspace, member=card.user).update(is_active=False)
    elif change == "guest":
        card.membership.role = 5
        card.membership.save()
        WorkspaceMember.objects.filter(workspace=card.workspace, member=card.user).update(role=5)
    elif change == "archived":
        card.project.archived_at = timezone.now()
        card.project.save()
    elif change == "scope":
        card.delivery.project = Project.objects.create(workspace=card.workspace, name="Other", identifier="OTHER")
        card.delivery.save()
    else:
        card.action.status = change
    card.action.save()
    with pytest.raises(APIException):
        feishu_actions.execute_card_action(card.action)
    card.issue.refresh_from_db()
    assert card.issue.state_id == card.todo.pk
    feishu_actions.issue_activity.delay.assert_not_called()


@pytest.mark.parametrize("change", ["timestamp", "unbind", "expiry", "membership", "disabled", "app_changed"])
def test_final_checks_run_after_workflow_preparation(card, monkeypatch, change):
    prepare = workflow.prepare_workflow_write

    def race(*args, **kwargs):
        prepared = prepare(*args, **kwargs)
        if change == "timestamp":
            Issue.objects.filter(pk=card.issue.pk).update(updated_at=timezone.now() + timedelta(seconds=1))
        elif change == "unbind":
            card.binding.delete()
        elif change == "expiry":
            FeishuCardAction.objects.filter(pk=card.action.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        elif change in ("disabled", "app_changed"):
            monkeypatch.setattr(
                feishu_actions,
                "get_feishu_config",
                lambda: SimpleNamespace(enabled=change != "disabled", app_id="different"),
            )
        else:
            ProjectMember.objects.filter(pk=card.membership.pk).update(is_active=False)
        return prepared

    monkeypatch.setattr(workflow, "prepare_workflow_write", race)
    with pytest.raises(APIException):
        feishu_actions.execute_card_action(card.action)
    card.issue.refresh_from_db()
    card.action.refresh_from_db()
    assert card.issue.state_id == card.todo.pk
    assert card.action.status == "processing"


def test_failed_action_bookkeeping_rolls_back_state_and_notifications(
    card, monkeypatch, django_capture_on_commit_callbacks
):
    monkeypatch.setattr(feishu_actions, "_succeed", Mock(side_effect=RuntimeError("database failure")))
    with django_capture_on_commit_callbacks(execute=True), pytest.raises(RuntimeError):
        feishu_actions.execute_card_action(card.action)
    card.issue.refresh_from_db()
    assert card.issue.state_id == card.todo.pk
    feishu_actions.issue_activity.delay.assert_not_called()
    feishu_actions.model_activity.delay.assert_not_called()


@pytest.mark.parametrize("outcome", ["approve", "reject"])
def test_approval_uses_service_and_replay_is_idempotent(card, outcome):
    approval, _ = approval_action(card, outcome)
    result = feishu_actions.execute_card_action(card.action)
    card.issue.refresh_from_db()
    approval.refresh_from_db()
    card.action.refresh_from_db()
    assert card.issue.state_id == (card.done.pk if outcome == "approve" else card.rejected.pk)
    assert approval.idempotency_key == str(card.action.pk)
    assert card.action.status == "succeeded"
    assert feishu_actions.execute_card_action(card.action) == result
    approval.refresh_from_db()
    assert approval.version == 2


def test_approval_recovers_previously_committed_idempotent_decision(card):
    approval, rule = approval_action(card, "approve")
    decide_approval(card.project.pk, card.issue.pk, approval.pk, rule.pk, "approve", 1, str(card.action.pk), card.user)
    assert feishu_actions.execute_card_action(card.action) == {"code": "approved"}
    card.action.refresh_from_db()
    assert card.action.status == "succeeded"


def test_approval_and_action_bookkeeping_rollback_together(card, monkeypatch):
    approval, _ = approval_action(card, "approve")
    monkeypatch.setattr(feishu_actions, "_succeed", Mock(side_effect=RuntimeError("database failure")))
    with pytest.raises(RuntimeError):
        feishu_actions.execute_card_action(card.action)
    card.issue.refresh_from_db()
    approval.refresh_from_db()
    assert card.issue.state_id == card.todo.pk
    assert approval.status == "pending"


def test_approval_rechecks_binding_inside_decision_transaction(card, monkeypatch):
    approval_action(card, "approve")
    original = feishu_actions.decide_approval

    def revoke_before_decision(*args, **kwargs):
        card.binding.delete()
        return original(*args, **kwargs)

    monkeypatch.setattr(feishu_actions, "decide_approval", revoke_before_decision)
    with pytest.raises(APIException):
        feishu_actions.execute_card_action(card.action)
    card.issue.refresh_from_db()
    assert card.issue.state_id == card.todo.pk


def test_state_action_cannot_bypass_workflow_approval(card):
    approval_action(card, "approve")
    card.action.operation = "state"
    card.action.payload = {
        "state_id": str(card.done.pk),
        "expected_state_id": str(card.todo.pk),
        "expected_updated_at": card.issue.updated_at.isoformat(),
    }
    card.action.save()
    with pytest.raises(APIException, match="WORKFLOW_APPROVAL_REQUIRED"):
        feishu_actions.execute_card_action(card.action)


def test_approval_prepare_is_outside_action_transaction(card, monkeypatch):
    approval_action(card, "approve")
    original = feishu_actions.decide_approval
    baseline = len(transaction.get_connection().atomic_blocks)

    def assert_not_wrapped(*args, **kwargs):
        assert len(transaction.get_connection().atomic_blocks) == baseline
        return original(*args, **kwargs)

    monkeypatch.setattr(feishu_actions, "decide_approval", assert_not_wrapped)
    feishu_actions.execute_card_action(card.action)
