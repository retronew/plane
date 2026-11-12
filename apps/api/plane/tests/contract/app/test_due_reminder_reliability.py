# ruff: noqa: F811 -- imported pytest fixtures are injected by name
import importlib
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import Mock

import pytest
from django.db import IntegrityError, close_old_connections, connection

from plane.bgtasks import issue_reminder_task as tasks
from plane.db.models import DueReminderScanRun, IssueAssignee, IssueDueReminder, Notification, Project
from plane.tests.contract.app.test_due_reminders import NOW, context, scan  # noqa: F401

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def test_invalid_timezone_does_not_abort_healthy_project(context, scan):
    workspace, project, _, _ = context
    broken = Project.objects.create(workspace=workspace, name="Bad timezone", identifier="BAD", remind_in=2)
    Project.objects.filter(pk=broken.pk).update(timezone="Invalid/Legacy")
    assert scan() == 1
    run = DueReminderScanRun.objects.get()
    assert run.status == "partial"
    assert run.projects_scanned == 2
    assert run.errors == [{"project_id": str(broken.pk), "channel": "timezone", "code": "invalid_timezone"}]
    assert not IssueDueReminder.objects.filter(issue__project=broken).exists()


def test_feishu_database_failure_isolated(context, scan, monkeypatch):
    Project.objects.filter(pk=context[1].pk).update(remind_feishu_enabled=True)
    original = tasks.should_notify
    monkeypatch.setattr(tasks, "should_notify", lambda *args: True if args[-1] == "feishu" else original(*args))

    def fail(**kwargs):
        # A real broken DB transaction requires a savepoint rollback.
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 / 0")

    monkeypatch.setattr(tasks, "enqueue_feishu_notification", fail)
    assert scan() == 1
    assert tasks.send_due_reminder_email.delay.call_count == 1
    run = DueReminderScanRun.objects.get()
    assert run.status == "partial"
    assert run.errors[0]["channel"] == "feishu"
    assert run.feishu_enqueued == 0
    assert run.email_queued == 1


def test_in_app_failure_retries_and_success_deduplicates(context, scan, monkeypatch):
    create = Notification.objects.create
    monkeypatch.setattr(Notification.objects, "create", Mock(side_effect=IntegrityError("secret title email")))
    assert scan() == 0
    delivery = IssueDueReminder.objects.get()
    assert delivery.in_app_processed_at is None
    assert tasks.send_due_reminder_email.delay.call_count == 1
    monkeypatch.setattr(Notification.objects, "create", create)
    assert scan() == 1
    assert scan() == 0
    delivery.refresh_from_db()
    assert delivery.in_app_processed_at == NOW
    assert Notification.objects.count() == 1
    assert "secret" not in str(list(DueReminderScanRun.objects.values("errors")))


def test_opt_out_then_enable_does_not_replay(context, scan, monkeypatch):
    original = tasks.should_notify
    monkeypatch.setattr(tasks, "should_notify", lambda *args: False if args[-1] == "in_app" else original(*args))
    assert scan() == 0
    assert IssueDueReminder.objects.get().in_app_processed_at == NOW
    monkeypatch.setattr(tasks, "should_notify", original)
    assert scan() == 0
    assert not Notification.objects.exists()


@pytest.mark.parametrize("legacy", ["absent_notice", "deleted_notice", "opted_out", "deleted_delivery"])
def test_old_delivery_baseline_never_replays(context, scan, legacy):
    workspace, project, issue, receiver = context
    delivery = IssueDueReminder.objects.create(issue=issue, receiver=receiver, target_date=issue.target_date)
    if legacy == "deleted_notice":
        notice = Notification.objects.create(
            workspace=workspace,
            project=project,
            receiver=receiver,
            entity_name="issue",
            entity_identifier=issue.id,
            title="Old reminder",
            sender="in_app:issue_reminder:due",
        )
        notice.delete()
    elif legacy == "opted_out":
        from plane.db.models import UserNotificationPreference

        UserNotificationPreference.objects.create(user=receiver, property_change=False)
    elif legacy == "deleted_delivery":
        IssueDueReminder.all_objects.filter(pk=delivery.pk).update(deleted_at=NOW)
    migration = importlib.import_module("plane.db.migrations.0173_due_reminder_reliability")
    from django.apps import apps
    from types import SimpleNamespace

    migration.baseline_existing_deliveries(apps, SimpleNamespace(connection=connection))
    delivery.refresh_from_db()
    assert delivery.in_app_processed_at == delivery.created_at
    assert scan() == 0
    assert not Notification.objects.exists()


def test_broker_failure_continues_other_recipients(context, scan, monkeypatch):
    workspace, project, issue, receiver = context
    from plane.db.models import ProjectMember, WorkspaceMember

    other = type(receiver).objects.create(email="other-reminder@example.invalid", username="other-reminder")
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=20)
    ProjectMember.objects.create(workspace=workspace, project=project, member=other, role=20)
    IssueAssignee.objects.create(workspace=workspace, project=project, issue=issue, assignee=other)
    monkeypatch.setattr(
        tasks.send_due_reminder_email, "delay", Mock(side_effect=[OSError("secret@example.invalid"), None])
    )
    assert scan() == 2
    run = DueReminderScanRun.objects.get()
    assert run.status == "partial"
    assert run.recipient_count == 2
    assert run.email_queued == 1
    assert run.errors == [{"project_id": str(project.pk), "channel": "email", "code": "broker_failed"}]


def test_scan_success_counters_and_task_id(context, scan):
    tasks.send_due_reminders.push_request(id="test-scan-id")
    try:
        assert scan() == 1
    finally:
        tasks.send_due_reminders.pop_request()
    run = DueReminderScanRun.objects.get()
    assert run.status == "succeeded"
    assert run.finished_at is not None
    assert run.task_id == "test-scan-id"
    assert (run.projects_scanned, run.issue_count, run.recipient_count, run.in_app_created, run.email_queued) == (
        1,
        1,
        1,
        1,
        1,
    )
    assert run.errors == []


def test_global_failure_recorded_and_reraised(context, monkeypatch):
    monkeypatch.setattr(Project.objects, "filter", Mock(side_effect=RuntimeError("secret")))
    with pytest.raises(RuntimeError):
        tasks.send_due_reminders.run()
    run = DueReminderScanRun.objects.get()
    assert run.status == "failed"
    assert run.finished_at is not None
    assert run.errors == [{"project_id": None, "channel": "scan", "code": "scan_failed"}]


def test_audit_error_cap_and_safe_schema(context, scan):
    for index in range(55):
        project = Project.objects.create(
            workspace=context[0],
            name=f"Invalid timezone {index}",
            identifier=f"BAD{index}",
            remind_in=2,
        )
        Project.objects.filter(pk=project.pk).update(timezone="Invalid/secret")
    assert scan() == 1
    run = DueReminderScanRun.objects.get()
    assert run.error_count == 55
    assert len(run.errors) == 50
    assert run.status == "partial"
    assert all(set(error) == {"project_id", "channel", "code"} for error in run.errors)
    assert "secret" not in str(run.errors)


@pytest.mark.parametrize("operation", ["create", "save"])
def test_audit_storage_failure_raises(context, monkeypatch, operation):
    target = DueReminderScanRun.objects if operation == "create" else DueReminderScanRun
    monkeypatch.setattr(target, operation, Mock(side_effect=RuntimeError("audit unavailable")))
    with pytest.raises(RuntimeError, match="audit unavailable"):
        tasks.send_due_reminders.run()


@pytest.mark.django_db(transaction=True)
def test_concurrent_scans_create_only_one_notification(context, monkeypatch):
    if not connection.features.has_select_for_update:
        pytest.skip("Requires database row locking")
    barrier = Barrier(2)
    original = tasks.process_recipient

    def synchronized(*args):
        barrier.wait(timeout=10)
        return original(*args)

    monkeypatch.setattr(tasks, "process_recipient", synchronized)

    def run():
        close_old_connections()
        try:
            return tasks.send_due_reminders.run()
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: run(), range(2)))
    assert sorted(results) == [0, 1]
    assert IssueDueReminder.objects.count() == 1
    assert Notification.objects.count() == 1
    assert sum(DueReminderScanRun.objects.values_list("email_queued", flat=True)) == 1


@pytest.mark.parametrize("result", ["none", "outbox"])
def test_feishu_audit_counts_only_new_outbox(context, scan, monkeypatch, result):
    from plane.db.models import FeishuBinding, FeishuDelivery

    Project.objects.filter(pk=context[1].pk).update(remind_feishu_enabled=True)
    original = tasks.should_notify
    monkeypatch.setattr(tasks, "should_notify", lambda *args: True if args[-1] == "feishu" else original(*args))
    binding = FeishuBinding.objects.create(user=context[3], app_id="app", tenant_key="tenant", open_id="open")

    def enqueue(**kwargs):
        if result == "none":
            return None
        delivery, _ = FeishuDelivery.objects.get_or_create(
            event_key=kwargs["event_key"],
            user_id=kwargs["user_id"],
            channel="feishu",
            defaults={"binding": binding, "kind": "due_reminder"},
        )
        return delivery

    monkeypatch.setattr(tasks, "enqueue_feishu_notification", enqueue)
    assert scan() == 1
    assert scan() == 0
    assert sorted(DueReminderScanRun.objects.values_list("feishu_enqueued", flat=True)) == (
        [0, 1] if result == "outbox" else [0, 0]
    )


def test_in_app_database_failure_keeps_email_transaction_usable(context, scan, monkeypatch):
    def fail(**kwargs):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 / 0")

    monkeypatch.setattr(Notification.objects, "create", fail)
    assert scan() == 0
    assert IssueDueReminder.objects.get().in_app_processed_at is None
    assert tasks.send_due_reminder_email.delay.call_count == 1
    assert DueReminderScanRun.objects.get().status == "partial"


def test_project_exception_does_not_abort_other_project(context, scan, monkeypatch):
    workspace, _, _, _ = context
    broken = Project.objects.create(workspace=workspace, name="Broken project", identifier="BRK", remind_in=2)
    original = tasks.active_recipients

    def recipients(project):
        if project.pk == broken.pk:
            raise RuntimeError("secret")
        return original(project)

    monkeypatch.setattr(tasks, "active_recipients", recipients)
    assert scan() == 1
    assert DueReminderScanRun.objects.get().errors == [
        {"project_id": str(broken.pk), "channel": "scan", "code": "project_failed"}
    ]
