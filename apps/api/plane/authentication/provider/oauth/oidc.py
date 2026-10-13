# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse
import pytz
import requests

# Module imports
from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)

DISCOVERY_TIMEOUT_SECONDS = 10


class OIDCOAuthProvider(OauthAdapter):
    """Generic OpenID Connect provider (Casdoor, Keycloak, Authentik, ...).

    Endpoints are resolved from the issuer's `.well-known/openid-configuration`.
    """

    provider = "oidc"
    scope = "openid email profile"

    def __init__(self, request, code=None, state=None, callback=None):
        (OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_TRUST_EMAIL) = get_configuration_value(
            [
                {
                    "key": "OIDC_ISSUER_URL",
                    "default": os.environ.get("OIDC_ISSUER_URL"),
                },
                {
                    "key": "OIDC_CLIENT_ID",
                    "default": os.environ.get("OIDC_CLIENT_ID"),
                },
                {
                    "key": "OIDC_CLIENT_SECRET",
                    "default": os.environ.get("OIDC_CLIENT_SECRET"),
                },
                {
                    "key": "OIDC_TRUST_EMAIL",
                    "default": os.environ.get("OIDC_TRUST_EMAIL", "0"),
                },
            ]
        )

        if not (OIDC_ISSUER_URL and OIDC_CLIENT_ID and OIDC_CLIENT_SECRET):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",
            )

        parsed = urlparse(OIDC_ISSUER_URL)
        if not parsed.scheme or parsed.scheme not in ("https", "http"):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",  # avoid leaking details to query params
            )
        issuer = OIDC_ISSUER_URL.rstrip("/")
        self.trust_email = OIDC_TRUST_EMAIL == "1"

        discovery = self.__discover(issuer)
        authorization_endpoint = discovery["authorization_endpoint"]
        self.token_url = discovery["token_endpoint"]
        self.userinfo_url = discovery["userinfo_endpoint"]

        client_id = OIDC_CLIENT_ID
        client_secret = OIDC_CLIENT_SECRET

        redirect_uri = f"{'https' if request.is_secure() else 'http'}://{request.get_host()}/auth/oidc/callback/"
        url_params = {
            "client_id": client_id,
            "scope": self.scope,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        auth_url = f"{authorization_endpoint}?{urlencode(url_params)}"

        super().__init__(
            request,
            self.provider,
            client_id,
            self.scope,
            redirect_uri,
            auth_url,
            self.token_url,
            self.userinfo_url,
            client_secret,
            code,
            callback=callback,
        )

    @staticmethod
    def __discover(issuer):
        try:
            response = requests.get(
                f"{issuer}/.well-known/openid-configuration",
                timeout=DISCOVERY_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            discovery = response.json()
        except (requests.RequestException, ValueError):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR",
            )
        required = ("authorization_endpoint", "token_endpoint", "userinfo_endpoint")
        if not all(discovery.get(key) for key in required):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR",
            )
        return discovery

    def set_token_data(self):
        data = {
            "code": self.code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        headers = {"Accept": "application/json"}
        token_response = self.get_user_token(data=data, headers=headers)
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.now(tz=pytz.utc) + timedelta(seconds=token_response.get("expires_in"))
                    if token_response.get("expires_in")
                    else None
                ),
                "refresh_token_expired_at": None,
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()

        email = user_info_response.get("email")
        if not email:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR: No email returned",
            )
        # Never accept an unverified email unless the admin explicitly trusts the
        # IdP — otherwise an IdP user could assert any address and take over an
        # existing account (GHSA-7j95-vh8g-f365).
        if user_info_response.get("email_verified") is not True and not self.trust_email:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OAUTH_PROVIDER_UNVERIFIED_EMAIL"],
                error_message="OAUTH_PROVIDER_UNVERIFIED_EMAIL",
            )

        name = user_info_response.get("name") or user_info_response.get("preferred_username") or ""

        super().set_user_data(
            {
                "email": email,
                "user": {
                    "provider_id": str(user_info_response.get("sub")),
                    "email": email,
                    "avatar": user_info_response.get("picture"),
                    "first_name": user_info_response.get("given_name") or name,
                    "last_name": user_info_response.get("family_name") or "",
                    "display_name": name,
                    "is_password_autoset": True,
                },
            }
        )
