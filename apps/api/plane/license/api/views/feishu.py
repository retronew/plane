# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import uuid

from django.conf import settings
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from plane.app.views.feishu import CALLBACK_PATH
from plane.db.models.feishu import FeishuBinding, FeishuDelivery
from plane.license.api.permissions import InstanceAdminPermission
from plane.utils.feishu import enqueue_feishu_notification, web_url
from plane.utils.feishu_client import FeishuClient, FeishuError, get_feishu_callback_config, get_feishu_config

from .base import BaseAPIView


class FeishuAdminThrottle(UserRateThrottle):
    scope = "feishu_admin"
    rate = "10/min"


class InstanceFeishuEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        config = get_feishu_config()
        callback_config = get_feishu_callback_config()
        return Response(
            {
                "enabled": config.enabled,
                "app_id": config.app_id,
                "secret_configured": bool(config.app_secret),
                "verification_token_configured": bool(callback_config.verification_token),
                "encrypt_key_configured": bool(callback_config.encrypt_key),
                "callback_url": web_url(CALLBACK_PATH),
                "card_callback_url": web_url("api/integrations/feishu/cards/"),
                "managed_by_env": not settings.SKIP_ENV_VAR,
                "current_user_bound": FeishuBinding.objects.filter(user=request.user, app_id=config.app_id).exists(),
                "last_delivery": FeishuDelivery.objects.filter(user=request.user)
                .order_by("-created_at")
                .values("status", "last_error", "created_at", "sent_at")
                .first(),
            }
        )


class InstanceFeishuCheckEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]
    throttle_classes = [FeishuAdminThrottle]

    def post(self, request):
        try:
            FeishuClient(get_feishu_config()).tenant_token()
        except FeishuError as exc:
            return Response(
                {"code": exc.reason, "error": "Unable to validate the saved Feishu credentials."}, status=400
            )
        return Response({"success": True})


class InstanceFeishuTestEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]
    throttle_classes = [FeishuAdminThrottle]

    def post(self, request):
        config = get_feishu_config()
        if not config.enabled:
            return Response({"code": "feishu_disabled", "error": "Feishu notifications are disabled."}, status=400)
        if not FeishuBinding.objects.filter(user=request.user, app_id=config.app_id).exists():
            return Response(
                {"code": "account_not_bound", "error": "Bind your Feishu account in personal settings first."},
                status=400,
            )
        delivery = enqueue_feishu_notification(
            event_key=f"admin-test:{uuid.uuid4()}",
            user_id=request.user.pk,
            kind="test",
            title="Plane 通知测试 / Notification test",
            body="飞书通知已连接。Feishu notifications are connected.",
            is_test=True,
        )
        if delivery is None:
            return Response(
                {"code": "delivery_unavailable", "error": "Unable to queue the test notification."}, status=400
            )
        return Response({"success": True, "status": "queued", "delivery_id": str(delivery.pk)}, status=202)
