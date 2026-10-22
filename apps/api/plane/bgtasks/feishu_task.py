# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from plane.db.models.feishu import FeishuBinding, FeishuDelivery, FeishuOAuthState
from plane.utils.feishu import cancel_pending_feishu_deliveries, delivery_allowed, delivery_card
from plane.utils.feishu_client import FeishuClient, FeishuError, get_feishu_config


@shared_task
def send_feishu_delivery(delivery_id):
    # Lock binding before delivery, consistently with unbind/enqueue. A committed unbind
    # cannot be followed by a new send, and parallel workers cannot send the same row.
    binding_id = FeishuDelivery.objects.filter(pk=delivery_id).values_list("binding_id", flat=True).first()
    if not binding_id:
        return
    # Commit before any HTTP call. Even a worker crash or rollback after a successful
    # provider response must not restart Feishu's one-hour UUID deduplication window.
    with transaction.atomic(durable=True):
        FeishuDelivery.objects.filter(
            pk=delivery_id,
            status__in=["pending", "retry"],
            first_attempt_at__isnull=True,
            next_attempt_at__lte=timezone.now(),
        ).update(first_attempt_at=timezone.now())
    with transaction.atomic():
        binding = FeishuBinding.objects.select_for_update().filter(pk=binding_id).first()
        delivery = FeishuDelivery.objects.select_for_update().filter(pk=delivery_id).first()
        if not delivery or delivery.status not in ("pending", "retry") or delivery.next_attempt_at > timezone.now():
            return
        config = get_feishu_config()
        delivery.binding = binding
        if not delivery_allowed(delivery, config):
            delivery.status = "cancelled"
            delivery.last_error = "no_longer_eligible"
            delivery.save(update_fields=["status", "last_error"])
            return
        if delivery.first_attempt_at and timezone.now() >= delivery.first_attempt_at + timedelta(minutes=55):
            delivery.status = "failed"
            delivery.last_error = "delivery_window_expired"
            delivery.save(update_fields=["status", "last_error"])
            return
        delivery.attempts += 1
        try:
            response = FeishuClient(config).send(binding.open_id, delivery_card(delivery), delivery.id)
            message_id = (response.get("data") or {}).get("message_id") if isinstance(response, dict) else None
            if isinstance(message_id, str) and len(message_id) <= 128:
                delivery.message_id = message_id
        except FeishuError as exc:
            delivery.last_error = exc.reason
            delivery.status = "retry" if exc.retryable and delivery.attempts < 6 else "failed"
            delivery.next_attempt_at = timezone.now() + timedelta(seconds=min(3600, 30 * 2**delivery.attempts))
        else:
            delivery.status = "sent"
            delivery.sent_at = timezone.now()
            delivery.last_error = ""
        delivery.save(update_fields=["status", "attempts", "next_attempt_at", "last_error", "sent_at", "message_id"])


@shared_task
def dispatch_feishu_deliveries():
    """Run every 30 seconds; durable recovery includes broker/worker outages."""
    FeishuOAuthState.objects.filter(expires_at__lt=timezone.now()).delete()
    if not get_feishu_config().enabled:
        cancel_pending_feishu_deliveries()
        return
    ids = (
        FeishuDelivery.objects.filter(status__in=["pending", "retry"], next_attempt_at__lte=timezone.now())
        .order_by("next_attempt_at")
        .values_list("id", flat=True)[:200]
    )
    for delivery_id in ids:
        send_feishu_delivery.delay(str(delivery_id))
