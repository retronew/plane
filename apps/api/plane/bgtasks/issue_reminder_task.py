# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
from datetime import timedelta
from zoneinfo import ZoneInfo

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.db import transaction
from django.db.models import Prefetch
from django.template.loader import render_to_string
from django.utils import timezone

from plane.bgtasks.email_notification_task import remove_unwanted_characters
from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueDueReminder,
    Notification,
    Project,
    ProjectMember,
    WorkspaceMember,
)
from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html, get_email_language
from plane.utils.exception_logger import log_exception
from plane.utils.feishu import enqueue_feishu_notification
from plane.utils.notification_preferences import should_notify


def active_recipients(project):
    return ProjectMember.objects.filter(
        project=project,
        is_active=True,
        member__is_active=True,
        member__is_bot=False,
        member_id__in=WorkspaceMember.objects.filter(workspace_id=project.workspace_id, is_active=True).values(
            "member_id"
        ),
    ).values_list("member_id", flat=True)


def eligible(issue, receiver_id, now):
    project = issue.project
    today = now.astimezone(ZoneInfo(project.timezone)).date()
    return (
        project.remind_in > 0
        and project.archived_at is None
        and project.deleted_at is None
        and issue.deleted_at is None
        and not issue.is_draft
        and issue.archived_at is None
        and issue.state is not None
        and issue.state.group in {"backlog", "unstarted", "started"}
        and issue.target_date is not None
        and today <= issue.target_date <= today + timedelta(days=project.remind_in)
        and receiver_id in active_recipients(project)
        and IssueAssignee.objects.filter(issue=issue, assignee_id=receiver_id).exists()
    )


def email_enabled(receiver_id, project):
    return should_notify(receiver_id, project.workspace_id, project.pk, "due_reminder", "email")


@shared_task
def send_due_reminders():
    """Hourly catch-up scan, measured in each project's local calendar dates."""
    now = timezone.now()
    created_count = 0
    for project in Project.objects.filter(remind_in__gt=0, archived_at__isnull=True).select_related("workspace"):
        today = now.astimezone(ZoneInfo(project.timezone)).date()
        issues = (
            Issue.issue_objects.filter(
                project=project,
                target_date__gte=today,
                target_date__lte=today + timedelta(days=project.remind_in),
                state__group__in=["backlog", "unstarted", "started"],
            )
            .select_related("state")
            .prefetch_related(
                Prefetch(
                    "issue_assignee",
                    queryset=IssueAssignee.objects.filter(assignee_id__in=active_recipients(project)),
                    to_attr="reminder_assignees",
                )
            )
        )
        for issue in issues.iterator(chunk_size=100):
            for assignee in issue.reminder_assignees:
                try:
                    with transaction.atomic():
                        delivery, created = IssueDueReminder.all_objects.select_for_update().get_or_create(
                            issue=issue,
                            receiver_id=assignee.assignee_id,
                            target_date=issue.target_date,
                        )
                        if project.remind_feishu_enabled and should_notify(
                            assignee.assignee_id, project.workspace_id, project.pk, "due_reminder", "feishu"
                        ):
                            enqueue_feishu_notification(
                                event_key=f"due-reminder:{delivery.id}",
                                user_id=assignee.assignee_id,
                                kind="due_reminder",
                                title=f"Work item due soon: {issue.name}",
                                body=issue.target_date.isoformat(),
                                workspace_id=project.workspace_id,
                                project_id=project.pk,
                                issue_id=issue.pk,
                            )
                        if created and should_notify(
                            assignee.assignee_id, project.workspace_id, project.pk, "due_reminder", "in_app"
                        ):
                            try:
                                with transaction.atomic():
                                    Notification.objects.create(
                                        workspace=project.workspace,
                                        project=project,
                                        receiver_id=assignee.assignee_id,
                                        triggered_by=None,
                                        entity_name="issue",
                                        entity_identifier=issue.id,
                                        sender="in_app:issue_reminder:due",
                                        title=issue.name,
                                        data={
                                            "issue": {
                                                "id": str(issue.id),
                                                "name": issue.name,
                                                "identifier": project.identifier,
                                                "sequence_id": issue.sequence_id,
                                                "state_name": issue.state.name,
                                                "state_group": issue.state.group,
                                            },
                                            "issue_activity": {
                                                "id": str(delivery.id),
                                                "field": "due_reminder",
                                                "verb": "reminded",
                                                "new_value": issue.target_date.isoformat(),
                                                "old_value": None,
                                            },
                                        },
                                    )
                                    created_count += 1
                            except Exception as error:
                                log_exception(error)
                        # Durable outbox: broker/SMTP failures can be retried on the next scan.
                        if (
                            project.remind_email_enabled
                            and delivery.email_sent_at is None
                            and email_enabled(assignee.assignee_id, project)
                            and (
                                delivery.email_queued_at is None
                                or delivery.email_queued_at < now - timedelta(minutes=30)
                            )
                        ):
                            delivery.email_queued_at = now
                            delivery.save(update_fields=["email_queued_at"])
                            transaction.on_commit(lambda key=str(delivery.id): send_due_reminder_email.delay(key))
                except Exception as error:
                    log_exception(error)
    return created_count


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_due_reminder_email(delivery_id):
    with transaction.atomic():
        delivery = (
            IssueDueReminder.objects.select_for_update(of=("self",))
            .select_related(
                "issue__project__workspace",
                "issue__state",
                "receiver__profile",
            )
            .filter(pk=delivery_id)
            .first()
        )
        if not delivery or delivery.email_sent_at:
            return
        issue, receiver = delivery.issue, delivery.receiver
        if (
            issue.target_date != delivery.target_date
            or not eligible(issue, receiver.id, timezone.now())
            or not issue.project.remind_email_enabled
            or not email_enabled(receiver.id, issue.project)
        ):
            return
        host, user, password, port, use_tls, use_ssl, from_email = get_email_configuration()
        if not host:
            return
        base_url = (settings.WEB_URL or settings.APP_BASE_URL or "").rstrip("/")
        if not base_url:
            return
        chinese = get_email_language(receiver) == "zh-CN"
        identifier = f"{issue.project.identifier}-{issue.sequence_id}"
        heading = "工作项即将到期" if chinese else "Work item due soon"
        context = {
            "heading": heading,
            "identifier": identifier,
            "name": issue.name,
            "date_label": "到期日" if chinese else "Due date",
            "target_date": issue.target_date.isoformat(),
            "link_label": "查看工作项" if chinese else "View work item",
            "url": f"{base_url}/{issue.project.workspace.slug}/projects/{issue.project_id}/issues/{issue.id}/",
        }
        html = render_to_string("emails/notifications/issue-reminder.html", context)
        message = EmailMultiAlternatives(
            subject=f"{heading}: {identifier} {remove_unwanted_characters(issue.name)}",
            body=f"{generate_plain_text_from_html(html)}\n{context['url']}",
            from_email=from_email,
            to=[receiver.email],
            connection=get_connection(
                host=host,
                port=int(port),
                username=user,
                password=password,
                use_tls=use_tls == "1",
                use_ssl=use_ssl == "1",
                timeout=15,
            ),
        )
        message.attach_alternative(html, "text/html")
        if message.send() != 1:
            raise RuntimeError("Reminder email was not accepted for delivery")
        delivery.email_sent_at = timezone.now()
        delivery.save(update_fields=["email_sent_at"])
