# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import uuid

from django.conf import settings
from django.db.models import Q
from rest_framework import serializers

from plane.db.models.feishu import FeishuDirectoryPreview
from plane.services.feishu_directory import bind_preview, create_preview, eligible_users, preview_data, unbind_preview
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


class DirectoryPreviewSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=("unbound", "all"), default="unbound")


class DirectorySelectionSerializer(serializers.Serializer):
    row_id = serializers.UUIDField()
    member_id = serializers.UUIDField(required=False)


class DirectoryBindSerializer(serializers.Serializer):
    preview_id = serializers.UUIDField()
    selections = DirectorySelectionSerializer(many=True, allow_empty=False, max_length=20)
    enable_notifications = serializers.BooleanField(default=False)


class InstanceFeishuDirectoryEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]
    throttle_classes = [FeishuAdminThrottle]

    def post(self, request):
        serializer = DirectoryPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return Response(preview_data(create_preview(request.user, serializer.validated_data["mode"])), status=201)
        except FeishuError as exc:
            return Response({"code": exc.reason}, status=400)

    def get(self, request):
        field = serializers.UUIDField()
        preview_id = field.run_validation(request.query_params.get("preview_id"))
        preview = FeishuDirectoryPreview.objects.filter(pk=preview_id, administrator=request.user).first()
        if not preview:
            return Response({"code": "preview_not_found"}, status=404)
        return Response(preview_data(preview))


class InstanceFeishuDirectoryUsersEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]
    throttle_classes = [FeishuAdminThrottle]

    def get(self, request):
        search = request.query_params.get("search", "").strip()[:255]
        users = eligible_users().filter(feishu_binding__isnull=True)
        if search:
            users = users.filter(Q(email__icontains=search) | Q(display_name__icontains=search))
        return Response(list(users.order_by("email", "id").values("id", "email", "display_name")[:50]))


class InstanceFeishuDirectoryBindEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]
    throttle_classes = [FeishuAdminThrottle]

    def post(self, request):
        serializer = DirectoryBindSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        selections = [{key: str(value) for key, value in item.items()} for item in data["selections"]]
        try:
            preview = bind_preview(request.user, data["preview_id"], selections, data["enable_notifications"])
        except FeishuError as exc:
            return Response({"code": exc.reason}, status=409)
        return Response(preview_data(preview))


class DirectoryUnbindSerializer(serializers.Serializer):
    preview_id = serializers.UUIDField()
    row_id = serializers.UUIDField()


class InstanceFeishuDirectoryUnbindEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]
    throttle_classes = [FeishuAdminThrottle]

    def post(self, request):
        serializer = DirectoryUnbindSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            unbind_preview(request.user, **serializer.validated_data)
        except FeishuError as exc:
            return Response({"code": exc.reason}, status=409)
        return Response({"success": True})


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
