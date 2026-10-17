"""Durable wakeups and at-most-once approval mail delivery contracts."""

from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from django.db import connection
from django.utils import timezone

from plane.bgtasks import workflow_runner_task as tasks
from plane.db.models import (
    Issue,
    Profile,
    Project,
    ProjectMember,
    State,
    User,
    UserNotificationPreference,
    WorkspaceMember,
)
from plane.db.models.workflow import ProjectWorkflow, WorkflowApproval
from plane.db.models.workflow_runner import WorkflowApprovalEmail, WorkflowExecution

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]


@pytest.fixture
def outbox_ctx(workspace, create_user, settings, monkeypatch):
    settings.WEB_URL = "https://plane.example.test"
    settings.APP_BASE_URL = "https://fallback.example.test"
    project = Project.objects.create(workspace=workspace, name="Approval emails", identifier="MAIL")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Review", group="started", default=True)
    issue = Issue.objects.create(project=project, state=state, name="Check before release")
    workflow = ProjectWorkflow.objects.create(project=project)
    approval = WorkflowApproval.objects.create(
        project=project,
        issue=issue,
        workflow=workflow,
        source=state,
        branches=[{"id": str(uuid4()), "approvers": [{"id": str(create_user.pk)}]}],
    )
    smtp_connection = Mock()
    connection_factory = Mock(return_value=smtp_connection)
    monkeypatch.setattr(tasks, "get_connection", connection_factory)
    configuration = Mock(
        return_value=(
            "smtp.example.test",
            "test-user",
            "private-smtp-password",
            "587",
            "1",
            "0",
            "plane@example.test",
        )
    )
    monkeypatch.setattr(tasks, "get_email_configuration", configuration)
    message = Mock()
    message.send.return_value = 1
    message_factory = Mock(return_value=message)
    monkeypatch.setattr(tasks, "EmailMultiAlternatives", message_factory)
    send_wakeup = Mock()
    monkeypatch.setattr(tasks.send_approval_email, "delay", send_wakeup)
    return SimpleNamespace(
        workspace=workspace,
        user=create_user,
        project=project,
        issue=issue,
        approval=approval,
        smtp_connection=smtp_connection,
        connection_factory=connection_factory,
        configuration=configuration,
        message=message,
        message_factory=message_factory,
        send_wakeup=send_wakeup,
    )


def delivery_for(ctx, **kwargs):
    return WorkflowApprovalEmail.objects.create(
        project=ctx.project,
        approval=ctx.approval,
        receiver=ctx.user,
        **kwargs,
    )


def test_approval_queue_deduplicates_recipients_across_branches(outbox_ctx):
    ctx = outbox_ctx
    second = User.objects.create(email="second-approver@example.test", username="second-approver")
    WorkspaceMember.objects.create(workspace=ctx.workspace, member=second, role=15)
    ProjectMember.objects.create(project=ctx.project, member=second, role=15)
    repeated = {"id": str(ctx.user.pk)}
    ctx.approval.branches = [
        {"id": str(uuid4()), "approvers": [repeated, repeated]},
        {"id": str(uuid4()), "approvers": [repeated, {"id": str(second.pk)}]},
    ]
    ctx.approval.save(update_fields=["branches"])
    tasks.queue_approval_email(str(ctx.approval.pk))
    tasks.queue_approval_email(str(ctx.approval.pk))
    deliveries = list(WorkflowApprovalEmail.objects.filter(approval=ctx.approval))
    assert len(deliveries) == 2
    assert {delivery.receiver_id for delivery in deliveries} == {ctx.user.pk, second.pk}
    assert all(
        delivery.project_id == ctx.project.pk and delivery.workspace_id == ctx.workspace.pk for delivery in deliveries
    )
    assert ctx.send_wakeup.call_count == 4
    assert {call.args[0] for call in ctx.send_wakeup.call_args_list} == {str(delivery.pk) for delivery in deliveries}


@pytest.mark.parametrize("delivery_status", ["sending", "sent", "failed", "unknown", "cancelled"])
def test_queue_never_reposts_delivery_that_may_have_been_sent(outbox_ctx, delivery_status):
    ctx = outbox_ctx
    delivery_for(ctx, status=delivery_status)
    tasks.queue_approval_email(str(ctx.approval.pk))
    tasks.queue_approval_email(str(ctx.approval.pk))
    ctx.send_wakeup.assert_not_called()
    assert WorkflowApprovalEmail.objects.filter(approval=ctx.approval).count() == 1


@pytest.mark.parametrize("approval_status", ["approved", "rejected", "cancelled", "deleted"])
def test_queue_ignores_approvals_that_are_no_longer_pending(outbox_ctx, approval_status):
    ctx = outbox_ctx
    if approval_status == "deleted":
        WorkflowApproval.objects.filter(pk=ctx.approval.pk).update(deleted_at=timezone.now())
    else:
        WorkflowApproval.objects.filter(pk=ctx.approval.pk).update(status=approval_status)
    tasks.queue_approval_email(str(ctx.approval.pk))
    tasks.queue_approval_email(str(uuid4()))
    ctx.send_wakeup.assert_not_called()
    assert not WorkflowApprovalEmail.objects.exists()


def test_send_claim_is_committed_before_smtp_and_duplicate_tasks_are_noops(outbox_ctx):
    ctx = outbox_ctx
    delivery = delivery_for(ctx)

    def send_once():
        assert not connection.in_atomic_block
        current = WorkflowApprovalEmail.objects.get(pk=delivery.pk)
        assert current.status == "sending"
        assert current.sent_at is None
        # A second worker entering after the claim cannot submit a second message.
        tasks.send_approval_email(str(delivery.pk))
        return 1

    ctx.message.send.side_effect = send_once
    tasks.send_approval_email(str(delivery.pk))
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "sent" and delivery.sent_at is not None
    ctx.message_factory.assert_called_once()
    ctx.message.send.assert_called_once()
    ctx.connection_factory.assert_called_once_with(
        host="smtp.example.test",
        port=587,
        username="test-user",
        password="private-smtp-password",
        use_tls=True,
        use_ssl=False,
        timeout=15,
    )
    assert ctx.message_factory.call_args.kwargs["to"] == [ctx.user.email]


@pytest.mark.parametrize("language,heading", [("en", "Work item awaiting approval"), ("zh-CN", "工作项等待审批")])
def test_approval_email_contains_localized_heading_and_real_issue_link(outbox_ctx, language, heading):
    ctx = outbox_ctx
    Profile.objects.update_or_create(user=ctx.user, defaults={"language": language})
    delivery = delivery_for(ctx)
    tasks.send_approval_email(str(delivery.pk))
    payload = ctx.message_factory.call_args.kwargs
    identifier = f"MAIL-{ctx.issue.sequence_id}"
    assert payload["subject"] == f"{heading}: {identifier}"
    assert ctx.issue.name in payload["body"]
    assert (
        f"https://plane.example.test/{ctx.workspace.slug}/projects/{ctx.project.pk}/issues/{ctx.issue.pk}/"
        in payload["body"]
    )
    assert "private-smtp-password" not in payload["body"]


@pytest.mark.parametrize(
    "invalid",
    [
        "project_inactive",
        "workspace_inactive",
        "project_removed",
        "workspace_removed",
        "project_guest",
        "user_inactive",
        "opted_out",
        "approval_approved",
        "approval_rejected",
        "approval_cancelled",
    ],
)
def test_delivery_rechecks_membership_preference_and_pending_approval(outbox_ctx, invalid):
    ctx = outbox_ctx
    delivery = delivery_for(ctx)
    if invalid == "project_inactive":
        ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(is_active=False)
    elif invalid == "workspace_inactive":
        WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(is_active=False)
    elif invalid == "project_removed":
        ProjectMember.objects.filter(project=ctx.project, member=ctx.user).delete()
    elif invalid == "workspace_removed":
        WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).delete()
    elif invalid == "project_guest":
        ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(role=5)
    elif invalid == "user_inactive":
        User.objects.filter(pk=ctx.user.pk).update(is_active=False)
    elif invalid == "opted_out":
        UserNotificationPreference.objects.filter(user=ctx.user).delete()
        UserNotificationPreference.objects.create(user=ctx.user, state_change=False)
    else:
        WorkflowApproval.objects.filter(pk=ctx.approval.pk).update(status=invalid.removeprefix("approval_"))
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "cancelled" and delivery.sent_at is None
    ctx.message_factory.assert_not_called()
    ctx.configuration.assert_not_called()


@pytest.mark.parametrize("state_change", [None, True])
def test_missing_or_enabled_notification_preference_allows_delivery(outbox_ctx, state_change):
    ctx = outbox_ctx
    UserNotificationPreference.objects.filter(user=ctx.user).delete()
    if state_change is not None:
        UserNotificationPreference.objects.create(user=ctx.user, state_change=state_change)
    delivery = delivery_for(ctx)
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "sent"
    ctx.message.send.assert_called_once()


def test_smtp_exception_records_unknown_and_never_automatically_resends(outbox_ctx, caplog):
    ctx = outbox_ctx
    delivery = delivery_for(ctx)
    ctx.message.send.side_effect = RuntimeError("smtp://test-user:private-smtp-password@smtp.example.test")
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "unknown" and delivery.sent_at is None
    tasks.send_approval_email(str(delivery.pk))
    tasks.queue_approval_email(str(ctx.approval.pk))
    tasks.dispatch_workflow_outbox()
    ctx.message.send.assert_called_once()
    ctx.send_wakeup.assert_not_called()
    assert "private-smtp-password" not in caplog.text


def test_smtp_zero_delivery_is_failed_without_a_sent_timestamp(outbox_ctx):
    ctx = outbox_ctx
    delivery = delivery_for(ctx)
    ctx.message.send.return_value = 0
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "failed" and delivery.sent_at is None
    tasks.send_approval_email(str(delivery.pk))
    tasks.queue_approval_email(str(ctx.approval.pk))
    ctx.message.send.assert_called_once()
    ctx.send_wakeup.assert_not_called()


@pytest.mark.parametrize("missing", ["smtp", "web_url"])
def test_missing_delivery_configuration_remains_queued_for_later_recovery(outbox_ctx, settings, missing):
    ctx = outbox_ctx
    delivery = delivery_for(ctx)
    if missing == "smtp":
        ctx.configuration.return_value = ("", "", "", "587", "1", "0", "")
    else:
        settings.WEB_URL = ""
        settings.APP_BASE_URL = ""
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "queued" and delivery.sent_at is None
    ctx.message_factory.assert_not_called()
    ctx.configuration.return_value = (
        "smtp.example.test",
        "test-user",
        "private-smtp-password",
        "587",
        "1",
        "0",
        "plane@example.test",
    )
    settings.WEB_URL = "https://plane.example.test"
    tasks.dispatch_workflow_outbox()
    ctx.send_wakeup.assert_called_once_with(str(delivery.pk))
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "sent"


def test_failed_broker_wakeup_keeps_one_durable_delivery_and_dispatch_recovers(outbox_ctx, caplog):
    ctx = outbox_ctx
    ctx.send_wakeup.side_effect = RuntimeError("broker unavailable private-broker-password")
    tasks.queue_approval_email(str(ctx.approval.pk))
    delivery = WorkflowApprovalEmail.objects.get(approval=ctx.approval)
    assert delivery.status == "queued"
    assert "private-broker-password" not in caplog.text
    ctx.send_wakeup.reset_mock(side_effect=True)
    tasks.dispatch_workflow_outbox()
    ctx.send_wakeup.assert_called_once_with(str(delivery.pk))
    assert WorkflowApprovalEmail.objects.filter(approval=ctx.approval).count() == 1
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "sent"


def test_dispatch_recreates_missing_approval_delivery_after_lost_initial_callback(outbox_ctx):
    ctx = outbox_ctx
    assert not WorkflowApprovalEmail.objects.filter(approval=ctx.approval).exists()
    tasks.dispatch_workflow_outbox()
    delivery = WorkflowApprovalEmail.objects.get(approval=ctx.approval)
    ctx.send_wakeup.assert_called_once_with(str(delivery.pk))
    assert delivery.receiver_id == ctx.user.pk and delivery.status == "queued"


def test_execution_wakeup_failure_is_recovered_from_committed_outbox(outbox_ctx, monkeypatch, caplog):
    ctx = outbox_ctx
    execution = WorkflowExecution.objects.create(
        project=ctx.project,
        issue=ctx.issue,
        actor=ctx.user,
        phase="post",
        dry_run=True,
    )
    wakeup = Mock(side_effect=RuntimeError("amqp://private-broker-password@broker"))
    monkeypatch.setattr(tasks.run_workflow_execution, "delay", wakeup)
    tasks.queue_workflow_execution(str(execution.pk))
    execution.refresh_from_db()
    assert execution.status == "queued"
    assert "private-broker-password" not in caplog.text
    wakeup.reset_mock(side_effect=True)
    tasks.dispatch_workflow_outbox()
    wakeup.assert_called_once_with(str(execution.pk))


@pytest.mark.parametrize("failure", ["message_constructor", "connection_constructor", "invalid_port"])
def test_mail_initialization_failure_is_unknown_without_automatic_replay(outbox_ctx, caplog, failure):
    ctx = outbox_ctx
    delivery = delivery_for(ctx)
    secret = "private-smtp-password"

    def construction_failed(*args, **kwargs):
        assert not connection.in_atomic_block
        assert WorkflowApprovalEmail.objects.get(pk=delivery.pk).status == "sending"
        raise RuntimeError(f"SMTP initialization failed with {secret}")

    if failure == "message_constructor":
        ctx.message_factory.side_effect = construction_failed
    elif failure == "connection_constructor":
        ctx.connection_factory.side_effect = construction_failed
    else:
        values = list(ctx.configuration.return_value)
        values[3] = f"invalid-port-{secret}"
        ctx.configuration.return_value = tuple(values)
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "unknown"
    assert delivery.sent_at is None
    ctx.message.send.assert_not_called()
    constructor_calls = ctx.message_factory.call_count
    connection_calls = ctx.connection_factory.call_count
    tasks.send_approval_email(str(delivery.pk))
    tasks.queue_approval_email(str(ctx.approval.pk))
    tasks.dispatch_workflow_outbox()
    assert ctx.message_factory.call_count == constructor_calls
    assert ctx.connection_factory.call_count == connection_calls
    ctx.send_wakeup.assert_not_called()
    assert secret not in caplog.text


@pytest.mark.parametrize(
    "invalid",
    [
        "approval_deleted",
        "issue_archived",
        "issue_deleted",
        "project_archived",
        "project_deleted",
        "workspace_deleted",
    ],
)
def test_mail_delivery_cancels_when_its_business_objects_become_unavailable(outbox_ctx, invalid):
    ctx = outbox_ctx
    delivery = delivery_for(ctx)
    now = timezone.now()
    if invalid == "approval_deleted":
        WorkflowApproval.objects.filter(pk=ctx.approval.pk).update(deleted_at=now)
    elif invalid == "issue_archived":
        Issue.objects.filter(pk=ctx.issue.pk).update(archived_at=now)
    elif invalid == "issue_deleted":
        Issue.objects.filter(pk=ctx.issue.pk).update(deleted_at=now)
    elif invalid == "project_archived":
        Project.objects.filter(pk=ctx.project.pk).update(archived_at=now)
    elif invalid == "project_deleted":
        Project.objects.filter(pk=ctx.project.pk).update(deleted_at=now)
    else:
        type(ctx.workspace).objects.filter(pk=ctx.workspace.pk).update(deleted_at=now)
    tasks.send_approval_email(str(delivery.pk))
    delivery.refresh_from_db()
    assert delivery.status == "cancelled"
    assert delivery.sent_at is None
    ctx.configuration.assert_not_called()
    ctx.connection_factory.assert_not_called()
    ctx.message_factory.assert_not_called()
    ctx.message.send.assert_not_called()


def test_missing_delivery_task_is_a_noop(outbox_ctx):
    tasks.send_approval_email(str(uuid4()))
    outbox_ctx.message_factory.assert_not_called()
    outbox_ctx.configuration.assert_not_called()
