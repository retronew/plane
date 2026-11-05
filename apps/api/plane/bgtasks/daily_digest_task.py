"""Minute scheduler and durable per-channel recovery for personal digests.

Database locks serialize schedule claims and sends. SMTP acceptance followed by
worker death before commit can still duplicate email; SMTP has no idempotency key.
Feishu uses the existing delivery outbox and provider UUID deduplication window.
"""

import uuid
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from plane.db.models import DailyDigest, DailyDigestConfig, DailyDigestDelivery, Notification
from plane.services.daily_digest import (
    accessible_workspaces,
    build_digest,
    digest_is_current,
    schedule_slot,
    user_zone,
)
from plane.services.daily_digest_rendering import presentation, send_digest_email
from plane.utils.exception_logger import log_exception
from plane.utils.feishu import enqueue_feishu_notification
from plane.utils.notification_preferences import should_notify


def claim_period(user_id, now):
    with transaction.atomic():
        config = DailyDigestConfig.objects.select_for_update(of=("self",)).select_related("user").get(user_id=user_id)
        if not config.enabled or not config.user.is_active or config.user.is_bot:
            return
        zone = str(user_zone(config.user))
        if config.schedule_timezone != zone:
            config.schedule_timezone = zone
            config.revision = uuid.uuid4()
            config.anchor_at = now
            config.last_period_end = None
            config.save()
            return
        end = schedule_slot(config, now)
        if end <= config.anchor_at or (config.last_period_end and end <= config.last_period_end):
            return
        start = config.last_period_end or max(config.anchor_at, schedule_slot(config, end, previous=True))
        digest, created = DailyDigest.objects.get_or_create(
            config=config,
            period_end=end,
            defaults={"period_start": start, "timezone": zone, "revision": config.revision},
        )
        if created:
            DailyDigestDelivery.objects.bulk_create(
                [
                    DailyDigestDelivery(digest=digest, channel=channel, next_attempt_at=now)
                    for channel in config.channels
                ]
            )
        config.last_period_end = end
        config.save(update_fields=["last_period_end"])


@shared_task
def dispatch_daily_digests():
    now = timezone.now()
    for user_id in (
        DailyDigestConfig.objects.filter(enabled=True, user__is_active=True)
        .values_list("user_id", flat=True)
        .iterator()
    ):
        try:
            claim_period(user_id, now)
        except Exception as error:
            log_exception(error)
    ids = (
        DailyDigestDelivery.objects.filter(
            status__in=["pending", "retry", "queued"],
            next_attempt_at__lte=now,
        )
        .order_by("next_attempt_at")
        .values_list("id", flat=True)[:200]
    )
    for key in ids:
        try:
            send_daily_digest.delay(str(key))
        except Exception as error:
            # Rows remain pending even if the broker is unavailable.
            log_exception(error)


@shared_task
def send_daily_digest(delivery_id):
    config_id = DailyDigestDelivery.objects.filter(pk=delivery_id).values_list("digest__config_id", flat=True).first()
    if not config_id:
        return
    with transaction.atomic():
        # Consistent config -> delivery locking also serializes against PATCH.
        config = DailyDigestConfig.objects.select_for_update(of=("self",)).select_related("user").get(pk=config_id)
        row = (
            DailyDigestDelivery.objects.select_for_update(of=("self",))
            .select_related("digest", "feishu_delivery")
            .get(pk=delivery_id)
        )
        if row.status not in ("pending", "retry", "queued") or row.next_attempt_at > timezone.now():
            return
        digest = row.digest
        digest.config = config
        if not digest_is_current(digest, row.channel) or not should_notify(
            config.user_id,
            event="daily_digest",
            channel=row.channel,
        ):
            row.status = "cancelled"
            row.save(update_fields=["status"])
            return
        payload = build_digest(config, digest.period_start, digest.period_end)
        if not config.send_empty and not any(section["count"] for section in payload["sections"]):
            row.status = "skipped"
            row.save(update_fields=["status"])
            return
        row.attempts += 1
        try:
            if row.channel == "in_app":
                memberships = accessible_workspaces(config.user)
                if config.workspace_ids:
                    memberships = memberships.filter(workspace_id__in=config.workspace_ids)
                if config.project_ids:
                    from plane.services.daily_digest import accessible_projects

                    memberships = memberships.filter(
                        workspace_id__in=accessible_projects(config.user)
                        .filter(
                            project_id__in=config.project_ids,
                        )
                        .values("workspace_id")
                    )
                workspace_id = memberships.order_by("workspace_id").values_list("workspace_id", flat=True).first()
                if workspace_id is None:
                    row.status = "cancelled"
                else:
                    row.notification = Notification.objects.create(
                        workspace_id=workspace_id,
                        project=None,
                        receiver=config.user,
                        triggered_by=None,
                        entity_name="daily_digest",
                        entity_identifier=digest.pk,
                        sender="in_app:daily_digest",
                        title=presentation(config.user, payload)["heading"],
                        data={"event": "daily_digest", "digest": payload},
                    )
                    row.status = "sent"
            elif row.channel == "email":
                send_digest_email(config.user, payload)
                row.status = "sent"
            elif row.channel == "feishu":
                if row.feishu_delivery_id is None:
                    row.feishu_delivery = enqueue_feishu_notification(
                        event_key=f"daily-digest:{row.id}",
                        user_id=config.user_id,
                        kind="daily_digest",
                        title=presentation(config.user, payload)["heading"],
                    )
                    if row.feishu_delivery is None:
                        raise RuntimeError("feishu_unavailable_or_unbound")
                status = row.feishu_delivery.status
                row.status = status if status in ("sent", "failed", "cancelled") else "queued"
            if row.status == "sent":
                row.sent_at = timezone.now()
            row.last_error = ""
        except Exception as error:
            log_exception(error)
            row.status = "retry" if row.attempts < 6 else "failed"
            # Store a type only; SMTP/provider errors may contain private credentials.
            row.last_error = type(error).__name__
        row.next_attempt_at = timezone.now() + timedelta(seconds=min(3600, 60 * 2 ** min(row.attempts, 6)))
        row.save()
