# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import hashlib
import json
from dataclasses import dataclass, field

import requests
from django.core.cache import cache

from plane.license.utils.instance_value import get_configuration_value

API_ROOT = "https://open.feishu.cn/open-apis"
AUTHORIZE_URL = "https://accounts.feishu.cn/open-apis/authen/v1/authorize"


class FeishuError(Exception):
    """Safe error identifiers only; never retain provider bodies, tokens or secrets."""

    def __init__(self, reason, *, retryable=False):
        self.reason = reason
        self.retryable = retryable
        super().__init__(reason)


@dataclass(frozen=True)
class FeishuConfig:
    enabled: bool
    app_id: str
    app_secret: str = field(repr=False)


def get_feishu_config():
    enabled, app_id, secret = get_configuration_value(
        [
            {"key": "FEISHU_ENABLED", "default": "0"},
            {"key": "FEISHU_APP_ID", "default": ""},
            {"key": "FEISHU_APP_SECRET", "default": ""},
        ]
    )
    return FeishuConfig(str(enabled).lower() in ("1", "true") and bool(app_id and secret), app_id or "", secret or "")


@dataclass(frozen=True)
class FeishuCallbackConfig:
    verification_token: str = field(repr=False)
    encrypt_key: str = field(repr=False)


def get_feishu_callback_config():
    token, key = get_configuration_value(
        [
            {"key": "FEISHU_VERIFICATION_TOKEN", "default": ""},
            {"key": "FEISHU_ENCRYPT_KEY", "default": ""},
        ]
    )
    return FeishuCallbackConfig(token or "", key or "")


class FeishuClient:
    def __init__(self, config):
        self.config = config

    def request(self, method, path, **kwargs):
        try:
            timeout = kwargs.pop("timeout", (5, 15))
            response = requests.request(method, API_ROOT + path, timeout=timeout, allow_redirects=False, **kwargs)
        except requests.RequestException:
            raise FeishuError("transport_error", retryable=True) from None
        if response.status_code == 429 or response.status_code >= 500:
            raise FeishuError("provider_unavailable", retryable=True)
        if not 200 <= response.status_code < 300:
            # Feishu returns permission failures with HTTP 400. Preserve only the
            # numeric identifier; provider messages may contain sensitive data.
            try:
                error_data = response.json()
            except ValueError:
                error_data = None
            error_code = error_data.get("code") if isinstance(error_data, dict) else None
            if type(error_code) is int and 0 < error_code <= 999999999:
                raise FeishuError(
                    f"provider_error_{error_code}",
                    retryable=error_code in (99991400, 99991401, 99991403, 230020, 99991663, 99991668),
                )
            raise FeishuError("provider_http_error")
        try:
            data = response.json()
        except ValueError:
            raise FeishuError("invalid_provider_response", retryable=True) from None
        if not isinstance(data, dict):
            raise FeishuError("invalid_provider_response")
        if path != "/authen/v2/oauth/token" and "code" not in data:
            raise FeishuError("invalid_provider_response")
        code = data.get("code", 0)
        if code != 0 or data.get("error"):
            raise FeishuError(
                "provider_error_" + str(code)[:16] if isinstance(code, int) else "provider_error",
                retryable=code in (99991400, 99991401, 99991403, 230020, 99991663, 99991668),
            )
        return data

    def identity(self, code, verifier, redirect_uri):
        token = self.request(
            "POST",
            "/authen/v2/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": self.config.app_id,
                "client_secret": self.config.app_secret,
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": redirect_uri,
            },
        )
        access_token = token.get("access_token")
        if not access_token:
            raise FeishuError("missing_user_token")
        identity = self.request("GET", "/authen/v1/user_info", headers={"Authorization": f"Bearer {access_token}"}).get(
            "data", {}
        )
        if not isinstance(identity, dict) or any(
            not isinstance(identity.get(key), str) or not 1 <= len(identity[key]) <= 128
            for key in ("open_id", "tenant_key")
        ):
            raise FeishuError("missing_identity")
        return identity

    @property
    def token_cache_key(self):
        digest = hashlib.sha256(f"{self.config.app_id}:{self.config.app_secret}".encode()).hexdigest()
        return f"feishu:tenant-token:{digest}"

    def tenant_token(self):
        token = cache.get(self.token_cache_key)
        if token:
            return token
        data = self.request(
            "POST",
            "/auth/v3/tenant_access_token/internal",
            json={
                "app_id": self.config.app_id,
                "app_secret": self.config.app_secret,
            },
        )
        token = data.get("tenant_access_token")
        if not token:
            raise FeishuError("missing_tenant_token")
        expiry = data.get("expire", 7200)
        if not isinstance(expiry, int) or expiry <= 0:
            raise FeishuError("invalid_token_expiry")
        cache.set(self.token_cache_key, token, timeout=max(1, expiry - 120))
        return token

    def update_card(self, message_id, card):
        from urllib.parse import quote

        return self.request(
            "PATCH",
            f"/im/v1/messages/{quote(message_id, safe='')}",
            headers={"Authorization": f"Bearer {self.tenant_token()}"},
            json={"content": json.dumps(card)},
        )

    def send(self, open_id, card, delivery_id):
        try:
            return self.request(
                "POST",
                "/im/v1/messages",
                params={"receive_id_type": "open_id"},
                headers={"Authorization": f"Bearer {self.tenant_token()}"},
                json={
                    "receive_id": open_id,
                    "msg_type": "interactive",
                    "content": json.dumps(card),
                    "uuid": str(delivery_id),
                },
            )
        except FeishuError as exc:
            if exc.reason in ("provider_error_99991663", "provider_error_99991668"):
                cache.delete(self.token_cache_key)
            raise
