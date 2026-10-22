# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from urllib.parse import urlsplit
from uuid import UUID

from django.utils import timezone

from django.conf import settings
from django.db import transaction

from plane.db.models import Issue, IssueDueReminder, ProjectMember, User, WorkspaceMember, WorkflowApproval
from plane.db.models.feishu import FeishuBinding, FeishuDelivery
from plane.utils.feishu_client import FeishuError, get_feishu_config


def web_url(path="", *, is_app=False):
    base = ((settings.APP_BASE_URL if is_app else None) or settings.WEB_URL or "").rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme not in ("https", "http") or not parsed.netloc or parsed.query or parsed.fragment:
        raise FeishuError("invalid_web_url")
    return base + "/" + path.lstrip("/")


def cancel_pending_feishu_deliveries(user_id=None):
    rows = FeishuDelivery.objects.filter(status__in=["pending", "retry"])
    if user_id is not None:
        rows = rows.filter(user_id=user_id)
    return rows.update(status="cancelled", last_error="disabled_or_unbound")


def delivery_allowed(delivery, config):
    if not config.enabled or not delivery.binding or delivery.binding.app_id != config.app_id:
        return False
    if not User.objects.filter(pk=delivery.user_id, is_active=True).exists():
        return False
    if delivery.is_test:
        return True
    if not delivery.workspace_id:
        return False
    if not WorkspaceMember.objects.filter(
        member_id=delivery.user_id,
        workspace_id=delivery.workspace_id,
        is_active=True,
        workspace__deleted_at__isnull=True,
    ).exists():
        return False
    if (
        delivery.project_id
        and not ProjectMember.objects.filter(
            member_id=delivery.user_id,
            workspace_id=delivery.workspace_id,
            project_id=delivery.project_id,
            project__deleted_at__isnull=True,
            project__archived_at__isnull=True,
            is_active=True,
        ).exists()
    ):
        return False
    if (
        delivery.issue_id
        and not Issue.objects.filter(
            pk=delivery.issue_id,
            workspace_id=delivery.workspace_id,
            project_id=delivery.project_id,
            archived_at__isnull=True,
            is_draft=False,
        ).exists()
    ):
        return False
    if delivery.kind == "approval_requested" and (
        not WorkspaceMember.objects.filter(
            member_id=delivery.user_id, workspace_id=delivery.workspace_id, is_active=True, role__gte=15
        ).exists()
        or not ProjectMember.objects.filter(
            member_id=delivery.user_id,
            project_id=delivery.project_id,
            workspace_id=delivery.workspace_id,
            is_active=True,
            role__gte=15,
        ).exists()
    ):
        return False
    if not event_still_relevant(delivery):
        return False
    from plane.utils.notification_preferences import should_notify

    try:
        return should_notify(delivery.user_id, delivery.workspace_id, delivery.project_id, delivery.kind, "feishu")
    except ValueError:
        return False


def event_still_relevant(delivery):
    if delivery.kind not in ("due_reminder", "approval_requested"):
        return True
    prefix = "due-reminder:" if delivery.kind == "due_reminder" else "approval-requested:"
    if not delivery.event_key.startswith(prefix):
        return False
    try:
        event_id = UUID(delivery.event_key[len(prefix) :])
    except ValueError:
        return False
    if delivery.kind == "due_reminder":
        reminder = (
            IssueDueReminder.objects.filter(pk=event_id, issue_id=delivery.issue_id, receiver_id=delivery.user_id)
            .select_related("issue__project", "issue__state")
            .first()
        )
        if not reminder or reminder.target_date != reminder.issue.target_date:
            return False
        from plane.bgtasks.issue_reminder_task import eligible

        return reminder.issue.project.remind_feishu_enabled and eligible(
            reminder.issue, reminder.receiver_id, timezone.now()
        )
    approval = WorkflowApproval.objects.filter(
        pk=event_id,
        issue_id=delivery.issue_id,
        project_id=delivery.project_id,
        workspace_id=delivery.workspace_id,
        status="pending",
    ).first()
    if not approval:
        return False
    return any(
        str(person.get("id")) == str(delivery.user_id)
        for branch in approval.branches
        for person in branch.get("approvers", [])
    )


def enqueue_feishu_notification(
    *, event_key, user_id, kind, title, body="", workspace_id=None, project_id=None, issue_id=None, is_test=False
):
    config = get_feishu_config()
    if not config.enabled:
        return None
    with transaction.atomic():
        binding = FeishuBinding.objects.select_for_update().filter(user_id=user_id, app_id=config.app_id).first()
        if not binding:
            return None
        candidate = FeishuDelivery(
            user_id=user_id,
            binding=binding,
            event_key=event_key,
            kind=kind,
            workspace_id=workspace_id,
            project_id=project_id,
            issue_id=issue_id,
            is_test=is_test,
        )
        if not delivery_allowed(candidate, config):
            return None
        delivery, _ = FeishuDelivery.objects.get_or_create(
            event_key=event_key,
            user_id=user_id,
            channel="feishu",
            defaults={
                "binding": binding,
                "kind": kind,
                "title": title[:255],
                "body": body[:2000],
                "workspace_id": workspace_id,
                "project_id": project_id,
                "issue_id": issue_id,
                "is_test": is_test,
            },
        )
        # The periodic outbox dispatcher is the reliable delivery mechanism. A broker outage
        # must not roll back the originating business transaction.
        return delivery


def delivery_card(delivery):
    from plane.utils.feishu_cards import delivery_card as build_card

    return build_card(delivery)


def unbind_feishu(user_id):
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user_id)
        binding = FeishuBinding.objects.select_for_update().filter(user_id=user_id).first()
        cancel_pending_feishu_deliveries(user_id)
        if binding:
            binding.delete()
        from plane.db.models.feishu import FeishuOAuthState

        FeishuOAuthState.objects.filter(user_id=user_id).delete()
