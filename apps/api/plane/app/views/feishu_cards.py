# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import logging

from django.core.exceptions import RequestDataTooBig
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from plane.db.models.feishu import FeishuBinding, FeishuCardAction, FeishuDelivery
from plane.utils.feishu_card_security import (
    MAX_BODY_BYTES,
    FeishuCardSecurityError,
    read_action_token,
    read_callback,
)
from plane.utils.feishu_client import get_feishu_callback_config, get_feishu_config

logger = logging.getLogger("plane.api.feishu_cards")


def _toast(status):
    # Never echo row.result, business payloads or external exception messages.
    kind, content = {
        "queued": ("info", "已受理，正在处理，请勿重复操作。"),
        "processing": ("info", "正在处理，请稍候。"),
        "succeeded": ("success", "此操作已完成。"),
        "failed": ("error", "此操作未能完成，请在 Plane 中查看并处理。"),
        "unavailable": ("warning", "此卡片操作已失效，请在 Plane 中查看并处理。"),
    }.get(status, ("warning", "此卡片操作已失效，请在 Plane 中查看并处理。"))
    return JsonResponse({"toast": {"type": kind, "content": content}})


def accept_card_action(body):
    header, event = body["header"], body["event"]
    operator, interaction = event["operator"], event["action"]
    if interaction["tag"] == "select_static":
        if interaction["value"].get("kind") != "state":
            raise FeishuCardSecurityError(400)
        token = interaction.get("option")
        operations = ("state",)
    else:
        token = interaction["value"].get("token")
        operations = ("approve", "reject")
    action_id = read_action_token(token)
    # Read only identifiers before acquiring locks, then recheck all relations under lock.
    reference = FeishuCardAction.objects.filter(pk=action_id).values("binding_id", "delivery_id").first()
    if not reference or not reference["binding_id"]:
        return _toast("unavailable")
    with transaction.atomic():
        binding = FeishuBinding.objects.select_for_update().filter(pk=reference["binding_id"]).first()
        delivery = FeishuDelivery.objects.select_for_update().filter(pk=reference["delivery_id"]).first()
        action = FeishuCardAction.objects.select_for_update().filter(pk=action_id).first()
        # Check config under the locks too; the worker rechecks again before business execution.
        config = get_feishu_config()
        if not config.enabled:
            return _toast("unavailable")
        if config.app_id != header["app_id"]:
            raise FeishuCardSecurityError()
        if not binding or not delivery or not action:
            return _toast("unavailable")
        if (
            binding.app_id != config.app_id
            or binding.open_id != operator["open_id"]
            or binding.tenant_key != operator["tenant_key"]
            or action.binding_id != binding.pk
            or delivery.binding_id != binding.pk
            or action.delivery_id != delivery.pk
            or delivery.user_id != binding.user_id
        ):
            raise FeishuCardSecurityError()
        if action.operation not in operations:
            raise FeishuCardSecurityError(400)
        message_id = event["context"]["open_message_id"]
        if delivery.message_id and delivery.message_id != message_id:
            raise FeishuCardSecurityError()
        if delivery.status not in ("sent", "retry") or (delivery.status == "sent" and not delivery.message_id):
            return _toast("unavailable")
        if action.expires_at <= timezone.now():
            return _toast("unavailable")
        if action.status != "pending":
            return _toast(action.status)
        # Holding the delivery lock serializes clicks across different actions on one card.
        # Failed actions also consume the card: retries must never run a competing choice.
        if FeishuCardAction.objects.filter(delivery=delivery).exclude(status="pending").exists():
            return _toast("unavailable")
        if delivery.status == "retry":
            # A signed callback with this unguessable, recipient-bound token proves receipt.
            # Recover a provider success whose message ID could not be committed locally.
            delivery.message_id = message_id
            delivery.status = "sent"
            delivery.sent_at = delivery.sent_at or timezone.now()
            delivery.last_error = ""
            delivery.save(update_fields=["message_id", "status", "sent_at", "last_error"])
        action.status = "queued"
        action.claimed_at = timezone.now()
        action.save(update_fields=["status", "claimed_at"])
    # The periodic dispatcher owns publishing and execution; no broker/HTTP calls here.
    return _toast("queued")


class FeishuCardCallbackEndpoint(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request):
        try:
            # Bound reads even when Content-Length is absent or dishonest. APIView's
            # CSRF exemption is intentional: Feishu signature/token replace browser auth.
            declared = request.META.get("CONTENT_LENGTH", "")
            if declared and (len(declared) > 12 or not declared.isdecimal() or int(declared) > MAX_BODY_BYTES):
                raise FeishuCardSecurityError(400)
            raw = request.read(MAX_BODY_BYTES + 1)
            body = read_callback(raw, request.headers, get_feishu_callback_config())
            if body.get("type") == "url_verification":
                return JsonResponse({"challenge": body["challenge"]})
            config = get_feishu_config()
            if body["header"]["app_id"] != config.app_id:
                raise FeishuCardSecurityError()
            if not config.enabled:
                return _toast("unavailable")
            return accept_card_action(body)
        except FeishuCardSecurityError as exc:
            timestamp = request.headers.get("X-Lark-Request-Timestamp", "")
            logger.warning(
                "Feishu card callback rejected: %s",
                exc.reason,
                extra={
                    "timestamp_length": len(timestamp),
                    "timestamp_shape": "".join(
                        "9" if char.isdecimal() else "A" if char.isalpha() else char
                        for char in timestamp[:96]
                    ),
                    "timestamp_ascii": timestamp.isascii(),
                    "timestamp_decimal": timestamp.isdecimal(),
                    "timestamp_has_dot": "." in timestamp,
                    "timestamp_has_comma": "," in timestamp,
                    "timestamp_has_whitespace": any(char.isspace() for char in timestamp),
                    "nonce_length": len(request.headers.get("X-Lark-Request-Nonce", "")),
                    "signature_length": len(request.headers.get("X-Lark-Signature", "")),
                },
            )
            return JsonResponse({"error": "invalid_feishu_callback"}, status=exc.status)
        except RequestDataTooBig:
            return JsonResponse({"error": "invalid_feishu_callback"}, status=400)
