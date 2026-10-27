# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import hashlib
import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from plane.app.views.base import BaseAPIView
from plane.db.models.feishu import FeishuBinding, FeishuDelivery, FeishuOAuthState
from plane.utils.feishu import enqueue_feishu_notification
from plane.utils.feishu_client import FeishuError, get_feishu_config


# Retained for the legacy read-only configuration response.
CALLBACK_PATH = "api/users/me/integrations/feishu/callback/"


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class FeishuActionThrottle(UserRateThrottle):
    scope = "feishu_action"
    rate = "10/min"


class FeishuBindingEndpoint(BaseAPIView):
    def get(self, request):
        config = get_feishu_config()
        binding = FeishuBinding.objects.filter(user=request.user, app_id=config.app_id).first()
        latest = FeishuDelivery.objects.filter(user=request.user).order_by("-created_at").first()
        return Response(
            {
                "enabled": config.enabled,
                "last_delivery": {
                    "status": latest.status,
                    "error": latest.last_error,
                    "created_at": latest.created_at,
                    "sent_at": latest.sent_at,
                }
                if latest
                else None,
                "binding": {
                    "display_name": binding.display_name,
                    "created_at": binding.created_at,
                    "app_id": binding.app_id,
                }
                if binding
                else None,
            }
        )

    def delete(self, request):
        return Response({"error": "administrator_managed"}, status=403)


class FeishuAuthorizeEndpoint(BaseAPIView):
    def post(self, request):
        return Response({"error": "administrator_managed"}, status=403)


def consume_oauth_state(state, user_id, session_key, app_id):
    with transaction.atomic():
        row = FeishuOAuthState.objects.select_for_update().filter(state_hash=digest(state)).first()
        if (
            not row
            or row.consumed_at
            or row.expires_at <= timezone.now()
            or str(row.user_id) != str(user_id)
            or row.session_hash != digest(session_key)
            or row.app_id != app_id
        ):
            raise FeishuError("invalid_oauth_state")
        verifier = row.verifier
        row.consumed_at = timezone.now()
        row.verifier = ""
        row.save(update_fields=["consumed_at", "verifier"])
        return verifier


class FeishuCallbackEndpoint(BaseAPIView):
    def get(self, request):
        # Reject even valid states issued before administrator-only management.
        # This endpoint must never exchange codes or mutate notification bindings.
        return Response({"error": "administrator_managed"}, status=403)


class FeishuTestEndpoint(BaseAPIView):
    throttle_classes = [FeishuActionThrottle]

    def post(self, request):
        if not get_feishu_config().enabled:
            return Response({"error": "feishu_disabled"}, status=503)
        chinese = getattr(getattr(request.user, "profile", None), "language", "en").startswith("zh")
        delivery = enqueue_feishu_notification(
            event_key=f"test:{uuid.uuid4()}",
            user_id=request.user.pk,
            kind="test",
            title="Plane 通知测试" if chinese else "Plane notification test",
            body="飞书通知已成功连接。" if chinese else "Your Feishu notifications are connected.",
            is_test=True,
        )
        if not delivery:
            return Response({"error": "feishu_not_bound"}, status=409)
        return Response({"delivery_id": str(delivery.id), "status": delivery.status}, status=202)
