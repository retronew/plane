# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import base64
import hashlib
import secrets
import uuid
from datetime import timedelta
from urllib.parse import urlencode

from django.db import IntegrityError, transaction
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from plane.app.views.base import BaseAPIView
from plane.db.models import User
from plane.db.models.feishu import FeishuBinding, FeishuDelivery, FeishuOAuthState
from plane.utils.feishu import cancel_pending_feishu_deliveries, enqueue_feishu_notification, unbind_feishu, web_url
from plane.utils.feishu_client import AUTHORIZE_URL, FeishuClient, FeishuError, get_feishu_config

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
        unbind_feishu(request.user.pk)
        return Response(status=204)


class FeishuAuthorizeEndpoint(BaseAPIView):
    throttle_classes = [FeishuActionThrottle]

    def post(self, request):
        config = get_feishu_config()
        if not config.enabled:
            return Response({"error": "feishu_disabled"}, status=503)
        if not request.session.session_key:
            request.session.save()
        state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            FeishuOAuthState.objects.filter(user=request.user).delete()
            FeishuOAuthState.objects.create(
                state_hash=digest(state),
                user=request.user,
                session_hash=digest(request.session.session_key),
                app_id=config.app_id,
                verifier=verifier,
                expires_at=timezone.now() + timedelta(minutes=10),
            )
        return Response(
            {
                "authorization_url": AUTHORIZE_URL
                + "?"
                + urlencode(
                    {
                        "client_id": config.app_id,
                        "redirect_uri": web_url(CALLBACK_PATH),
                        "response_type": "code",
                        "state": state,
                        "code_challenge": challenge,
                        "code_challenge_method": "S256",
                    }
                )
            }
        )


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
        result = "error"
        try:
            config = get_feishu_config()
            state = request.query_params.get("state", "")
            code = request.query_params.get("code", "")
            session_key = request.session.session_key
            if not config.enabled or not state or not session_key:
                raise FeishuError("invalid_oauth_callback")
            verifier = consume_oauth_state(state, request.user.pk, session_key, config.app_id)
            if not code or request.query_params.get("error"):
                raise FeishuError("authorization_denied")
            identity = FeishuClient(config).identity(code, verifier, web_url(CALLBACK_PATH))
            with transaction.atomic():
                # Serializes concurrent binds for one Plane user. The database identity
                # constraint protects against two different users claiming one identity.
                User.objects.select_for_update().get(pk=request.user.pk)
                if not FeishuOAuthState.objects.filter(state_hash=digest(state), user=request.user).exists():
                    raise FeishuError("authorization_cancelled")
                current = get_feishu_config()
                if not current.enabled or current.app_id != config.app_id:
                    raise FeishuError("configuration_changed")
                binding = FeishuBinding.objects.select_for_update().filter(user=request.user).first()
                cancel_pending_feishu_deliveries(request.user.pk)
                if binding:
                    binding.delete()
                FeishuBinding.objects.create(
                    user=request.user,
                    app_id=config.app_id,
                    tenant_key=identity["tenant_key"],
                    open_id=identity["open_id"],
                    display_name=str(identity.get("name", ""))[:255],
                )
            result = "connected"
        except IntegrityError:
            result = "identity_in_use"
        except FeishuError:
            # Provider response and authorization code must never enter logs or URLs.
            pass
        return HttpResponseRedirect(web_url(f"settings/profile/notifications/?feishu={result}"))


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
