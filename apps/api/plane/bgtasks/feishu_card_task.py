# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException

from plane.db.models import Issue, ProjectMember, WorkspaceMember
from plane.db.models.feishu import FeishuBinding, FeishuCardAction, FeishuDelivery
from plane.utils.feishu import delivery_card
from plane.utils.feishu_client import FeishuClient, FeishuError, get_feishu_config

logger = logging.getLogger(__name__)


def available_actions(now):
    # Delay admission until after Feishu's synchronous callback response has completed.
    return Q(status="queued", claimed_at__lte=now - timedelta(seconds=5)) | Q(
        status="processing", claimed_at__lte=now - timedelta(minutes=5)
    )


@shared_task
def execute_feishu_card_action(action_id):
    from plane.services.feishu_actions import execute_card_action

    with transaction.atomic():
        action = FeishuCardAction.objects.select_for_update().filter(pk=action_id).first()
        if (
            not action
            or not FeishuCardAction.objects.filter(pk=action_id).filter(available_actions(timezone.now())).exists()
        ):
            return
        action.status = "processing"
        action.claimed_at = timezone.now()
        action.save(update_fields=["status", "claimed_at"])
    try:
        execute_card_action(action)
    except APIException:
        FeishuCardAction.objects.filter(pk=action_id, status="processing").update(
            status="failed", result={"code": "action_rejected"}, completed_at=timezone.now()
        )
    except Exception as exc:
        # Never persist raw exceptions or request bodies: provider credentials can occur there.
        logger.error("Feishu card action %s failed (%s)", action_id, type(exc).__name__)
        FeishuCardAction.objects.filter(pk=action_id, status="processing").update(
            status="failed", result={"code": "action_failed"}, completed_at=timezone.now()
        )
    refresh_feishu_card.delay(str(action_id))


def result_card(action, delivery):
    # Never refresh entity details for a recipient whose access has since been revoked.
    visible = (
        WorkspaceMember.objects.filter(
            workspace_id=delivery.workspace_id,
            member_id=delivery.user_id,
            is_active=True,
            member__is_active=True,
            workspace__deleted_at__isnull=True,
        ).exists()
        and ProjectMember.objects.filter(
            workspace_id=delivery.workspace_id,
            project_id=delivery.project_id,
            member_id=delivery.user_id,
            is_active=True,
            project__deleted_at__isnull=True,
            project__archived_at__isnull=True,
        ).exists()
        and Issue.objects.filter(
            pk=delivery.issue_id,
            project_id=delivery.project_id,
            workspace_id=delivery.workspace_id,
            archived_at__isnull=True,
            is_draft=False,
        ).exists()
    )
    if visible:
        return delivery_card(delivery)
    chinese = (getattr(getattr(delivery.user, "profile", None), "language", "en") or "en").startswith("zh")
    message = (
        ("操作已完成。" if chinese else "Action completed.")
        if action.status == "succeeded"
        else ("无法完成操作，请在 Plane 中查看。" if chinese else "Action unavailable. Please check Plane.")
    )
    return {
        "config": {"update_multi": True},
        "elements": [{"tag": "div", "text": {"tag": "plain_text", "content": message}}],
    }


@shared_task
def refresh_feishu_card(action_id):
    binding_id = FeishuCardAction.objects.filter(pk=action_id).values_list("binding_id", flat=True).first()
    if not binding_id:
        return
    with transaction.atomic():
        binding = FeishuBinding.objects.select_for_update().filter(pk=binding_id).first()
        delivery_id = FeishuCardAction.objects.filter(pk=action_id).values_list("delivery_id", flat=True).first()
        delivery = FeishuDelivery.objects.select_for_update().filter(pk=delivery_id).first()
        action = FeishuCardAction.objects.select_for_update().filter(pk=action_id).first()
        if (
            not action
            or action.status not in ("succeeded", "failed")
            or action.card_updated_at
            or action.card_update_attempts >= 6
            or action.next_card_update_at > timezone.now()
        ):
            return
        config = get_feishu_config()
        if (
            not delivery
            or not binding
            or not config.enabled
            or binding.app_id != config.app_id
            or delivery.binding_id != binding.pk
            or not delivery.message_id
        ):
            return
        action.card_update_attempts += 1
        try:
            FeishuClient(config).update_card(delivery.message_id, result_card(action, delivery))
        except FeishuError as exc:
            if not exc.retryable:
                action.card_update_attempts = 6
            action.next_card_update_at = timezone.now() + timedelta(seconds=30 * 2**action.card_update_attempts)
        else:
            action.card_updated_at = timezone.now()
        action.save(update_fields=["card_update_attempts", "next_card_update_at", "card_updated_at"])


@shared_task
def dispatch_feishu_card_actions():
    now = timezone.now()
    for action_id in (
        FeishuCardAction.objects.filter(available_actions(now))
        .order_by("claimed_at")
        .values_list("id", flat=True)[:100]
    ):
        execute_feishu_card_action.delay(str(action_id))
    for action_id in FeishuCardAction.objects.filter(
        status__in=["succeeded", "failed"],
        card_updated_at__isnull=True,
        card_update_attempts__lt=6,
        next_card_update_at__lte=now,
        binding__isnull=False,
        delivery__message_id__gt="",
    ).values_list("id", flat=True)[:100]:
        refresh_feishu_card.delay(str(action_id))
