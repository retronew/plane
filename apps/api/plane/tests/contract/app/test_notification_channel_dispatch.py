# Fixtures are intentionally imported from the existing contract scenarios.
# ruff: noqa: F811
import json
from unittest.mock import Mock

import pytest

from plane.bgtasks import notification_task as tasks
from plane.db.models import EmailNotificationLog, IssueActivity, IssueDueReminder, Notification
from plane.tests.contract.app.test_due_reminders import context, scan  # noqa: F401, F811
from plane.tests.contract.app.test_intake_notification_owner import context as intake_context  # noqa: F401, F811
from plane.tests.contract.app.test_intake_notification_owner import deliver, new_request

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def test_intake_feishu_is_independent_of_existing_in_app(intake_context, monkeypatch):
    issue = new_request(intake_context)
    deliver(intake_context, issue)
    enqueue = Mock()
    monkeypatch.setattr(tasks, "enqueue_feishu_notification", enqueue)
    monkeypatch.setattr(
        tasks.NotificationPreferenceResolver, "should_notify", lambda self, event, channel: channel == "feishu"
    )
    deliver(intake_context, issue)
    assert enqueue.call_args.kwargs["kind"] == "intake_created"
    assert Notification.objects.filter(receiver=intake_context[3], entity_identifier=issue.id).count() == 1


def test_description_mention_emails_mentioned_user_without_subscribers(intake_context, monkeypatch):
    workspace, project, _, recipient, actor = intake_context
    issue = new_request(intake_context)
    activity = IssueActivity.objects.create(
        workspace=workspace,
        project=project,
        issue=issue,
        actor=actor,
        verb="updated",
        field="description",
        comment="updated the description",
    )
    html = f'<mention-component entity_name="user_mention" entity_identifier="{recipient.id}"></mention-component>'
    monkeypatch.setattr(
        tasks.NotificationPreferenceResolver, "should_notify", lambda self, event, channel: channel == "email"
    )
    tasks.notifications.run(
        type="issue.activity.updated",
        issue_id=str(issue.id),
        project_id=str(project.id),
        actor_id=str(actor.id),
        subscriber=False,
        issue_activities_created="[]",
        requested_data=json.dumps({"description_html": html}),
        current_instance=json.dumps({"description_html": ""}),
    )
    log = EmailNotificationLog.objects.get(entity_identifier=issue.id)
    assert log.receiver_id == recipient.id
    assert log.data["issue_activity"]["id"] == str(activity.id)
    assert log.data["issue_activity"]["field"] == "mention"
    assert not Notification.objects.filter(entity_identifier=issue.id).exists()


def test_due_feishu_independent_of_email_sent_and_in_app_disabled(context, scan, monkeypatch):
    from plane.bgtasks import issue_reminder_task as reminders
    from django.utils import timezone

    _, project, issue, receiver = context
    project.remind_feishu_enabled = True
    project.remind_email_enabled = False
    project.save(update_fields=["remind_feishu_enabled", "remind_email_enabled"])
    delivery = IssueDueReminder.objects.create(
        issue=issue,
        receiver=receiver,
        target_date=issue.target_date,
        email_sent_at=timezone.now(),
    )
    enqueue = Mock()
    monkeypatch.setattr(reminders, "enqueue_feishu_notification", enqueue)
    monkeypatch.setattr(
        reminders, "should_notify", lambda user, workspace, project, event, channel: channel == "feishu"
    )
    scan()
    scan()
    assert enqueue.call_count == 2
    assert {call.kwargs["event_key"] for call in enqueue.call_args_list} == {f"due-reminder:{delivery.id}"}
    assert not Notification.objects.filter(entity_identifier=issue.id).exists()
    reminders.send_due_reminder_email.delay.assert_not_called()
