from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import Mock

import pytest
from django.core import mail
from django.utils import timezone

from plane.bgtasks import issue_reminder_task as tasks
from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueDueReminder,
    Notification,
    Profile,
    Project,
    ProjectMember,
    State,
    UserNotificationPreference,
    WorkspaceMember,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db]
NOW = datetime(2026, 10, 16, 23, 30, tzinfo=dt_timezone.utc)


@pytest.fixture
def context(workspace, create_user, monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    monkeypatch.setattr(tasks.send_due_reminder_email, "delay", Mock())
    project = Project.objects.create(
        workspace=workspace, name="Reminder QA", identifier="REM", remind_in=2, timezone="Asia/Shanghai"
    )
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
    state = State.objects.create(project=project, workspace=workspace, group="started", name="In progress")
    issue = Issue.objects.create(
        project=project, workspace=workspace, state=state, name="Due work", target_date=NOW.date() + timedelta(days=3)
    )
    IssueAssignee.objects.create(project=project, workspace=workspace, issue=issue, assignee=create_user)
    return workspace, project, issue, create_user


@pytest.fixture
def scan(django_capture_on_commit_callbacks):
    def run():
        with django_capture_on_commit_callbacks(execute=True):
            return tasks.send_due_reminders.run()

    return run


def test_local_calendar_date_and_durable_dedup(context, scan):
    _, _, issue, receiver = context
    assert scan() == 1  # UTC is still Oct 16; the project is already on Oct 17.
    assert scan() == 0
    assert Notification.objects.filter(receiver=receiver, entity_identifier=issue.id).count() == 1
    assert IssueDueReminder.objects.count() == 1
    assert tasks.send_due_reminder_email.delay.call_count == 1
    notification = Notification.objects.get()
    assert notification.data["issue_activity"]["field"] == "due_reminder"
    assert notification.triggered_by_id is None


@pytest.mark.parametrize(
    "reason",
    [
        "disabled",
        "completed",
        "cancelled",
        "triage",
        "archived",
        "draft",
        "deleted",
        "project_archived",
        "inactive_project",
        "inactive_workspace",
        "inactive_user",
        "unassigned",
        "overdue",
        "outside_window",
    ],
)
def test_excludes_ineligible_work(context, scan, reason):
    workspace, project, issue, receiver = context
    if reason == "disabled":
        Project.objects.filter(pk=project.pk).update(remind_in=0)
    elif reason == "project_archived":
        Project.objects.filter(pk=project.pk).update(archived_at=NOW)
    elif reason in {"completed", "cancelled", "triage"}:
        State.objects.filter(pk=issue.state_id).update(group=reason)
    elif reason == "archived":
        Issue.objects.filter(pk=issue.pk).update(archived_at=NOW.date())
    elif reason == "draft":
        Issue.objects.filter(pk=issue.pk).update(is_draft=True)
    elif reason == "deleted":
        Issue.objects.filter(pk=issue.pk).update(deleted_at=NOW)
    elif reason == "inactive_project":
        ProjectMember.objects.filter(project=project, member=receiver).update(is_active=False)
    elif reason == "inactive_workspace":
        WorkspaceMember.objects.filter(workspace=workspace, member=receiver).update(is_active=False)
    elif reason == "inactive_user":
        type(receiver).objects.filter(pk=receiver.pk).update(is_active=False)
    elif reason == "unassigned":
        IssueAssignee.objects.filter(issue=issue).delete()
    elif reason == "overdue":
        Issue.objects.filter(pk=issue.pk).update(target_date=NOW.date())
    elif reason == "outside_window":
        Issue.objects.filter(pk=issue.pk).update(target_date=NOW.date() + timedelta(days=4))
    assert scan() == 0
    assert not Notification.objects.exists()
    assert not IssueDueReminder.objects.exists()


def test_new_deadline_can_be_reminded_and_email_pref_is_respected(context, scan):
    _, _, issue, receiver = context
    UserNotificationPreference.objects.update_or_create(user=receiver, defaults={"property_change": False})
    assert scan() == 1
    assert not tasks.send_due_reminder_email.delay.called
    Issue.objects.filter(pk=issue.pk).update(target_date=NOW.date() + timedelta(days=2))
    assert scan() == 1
    assert Notification.objects.count() == 2
    assert IssueDueReminder.objects.count() == 2


def test_admin_settings_validation_and_member_permissions(session_client, context):
    workspace, project, _, receiver = context
    url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
    for value in [1, 7, 0]:
        response = session_client.patch(url, {"remind_in": value}, format="json")
        assert response.status_code == 200, response.data
        project.refresh_from_db()
        assert project.remind_in == value
    for value in [-1, 8, 1.5]:
        assert session_client.patch(url, {"remind_in": value}, format="json").status_code == 400
    ProjectMember.objects.filter(project=project, member=receiver).update(role=15)
    WorkspaceMember.objects.filter(workspace=workspace, member=receiver).update(role=15)
    assert session_client.patch(url, {"remind_in": 1}, format="json").status_code == 403


@pytest.fixture
def email_setup(context, scan, monkeypatch, settings):
    scan()
    settings.WEB_URL = "http://localhost:3000"
    monkeypatch.setattr(
        tasks, "get_email_configuration", lambda: ("smtp.invalid", "", "", 25, "0", "0", "noreply@example.invalid")
    )
    monkeypatch.setattr(
        tasks,
        "get_connection",
        lambda **kwargs: mail.get_connection(backend="django.core.mail.backends.locmem.EmailBackend"),
    )
    return IssueDueReminder.objects.get()


def test_actual_email_content_localization_and_single_delivery(email_setup, context):
    receiver = context[3]
    Profile.objects.update_or_create(user=receiver, defaults={"language": "zh-CN"})
    tasks.send_due_reminder_email.run(str(email_setup.id))
    tasks.send_due_reminder_email.run(str(email_setup.id))
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert "工作项即将到期" in message.subject
    assert "2026-10-19" in message.body
    assert str(context[2].id) in message.body
    assert message.to == [receiver.email]
    assert message.alternatives[0].mimetype == "text/html"
    email_setup.refresh_from_db()
    assert email_setup.email_sent_at is not None


@pytest.mark.parametrize("change", ["disabled", "completed", "unassigned", "deadline", "preference", "project_email"])
def test_queued_email_rechecks_current_eligibility(email_setup, context, change):
    _, project, issue, receiver = context
    if change == "disabled":
        Project.objects.filter(pk=project.pk).update(remind_in=0)
    elif change == "completed":
        State.objects.filter(pk=issue.state_id).update(group="completed")
    elif change == "unassigned":
        IssueAssignee.objects.filter(issue=issue).delete()
    elif change == "deadline":
        Issue.objects.filter(pk=issue.pk).update(target_date=NOW.date() + timedelta(days=4))
    elif change == "project_email":
        Project.objects.filter(pk=project.pk).update(remind_email_enabled=False)
    else:
        UserNotificationPreference.objects.update_or_create(user=receiver, defaults={"property_change": False})
    tasks.send_due_reminder_email.run(str(email_setup.id))
    assert not getattr(mail, "outbox", [])
    email_setup.refresh_from_db()
    assert email_setup.email_sent_at is None


def test_failed_email_remains_retryable(email_setup, monkeypatch):
    monkeypatch.setattr(tasks.EmailMultiAlternatives, "send", Mock(side_effect=OSError("SMTP unavailable")))
    with pytest.raises(OSError):
        tasks.send_due_reminder_email.run(str(email_setup.id))
    email_setup.refresh_from_db()
    assert email_setup.email_sent_at is None


def test_project_email_disabled_does_not_suppress_in_app(context, scan):
    Project.objects.filter(pk=context[1].pk).update(remind_email_enabled=False)
    assert scan() == 1
    assert Notification.objects.count() == 1
    assert not tasks.send_due_reminder_email.delay.called
