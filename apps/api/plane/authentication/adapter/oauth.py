# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import requests
from django.db import DatabaseError, IntegrityError, transaction

# Django imports
from django.utils import timezone

from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)

# Module imports
from plane.db.models import Account, User
from plane.utils.exception_logger import log_exception

from .base import Adapter


class OauthAdapter(Adapter):
    def __init__(
        self,
        request,
        provider,
        client_id,
        scope,
        redirect_uri,
        auth_url,
        token_url,
        userinfo_url,
        client_secret=None,
        code=None,
        callback=None,
    ):
        super().__init__(request=request, provider=provider, callback=callback)
        self.client_id = client_id
        self.scope = scope
        self.redirect_uri = redirect_uri
        self.auth_url = auth_url
        self.token_url = token_url
        self.userinfo_url = userinfo_url
        self.client_secret = client_secret
        self.code = code

    def authentication_error_code(self):
        if self.provider == "google":
            return "GOOGLE_OAUTH_PROVIDER_ERROR"
        elif self.provider == "github":
            return "GITHUB_OAUTH_PROVIDER_ERROR"
        elif self.provider == "gitlab":
            return "GITLAB_OAUTH_PROVIDER_ERROR"
        elif self.provider == "gitea":
            return "GITEA_OAUTH_PROVIDER_ERROR"
        elif self.provider == "oidc":
            return "OIDC_OAUTH_PROVIDER_ERROR"
        else:
            return "OAUTH_NOT_CONFIGURED"

    def get_auth_url(self):
        return self.auth_url

    def get_token_url(self):
        return self.token_url

    def get_user_info_url(self):
        return self.userinfo_url

    def authenticate(self):
        self.set_token_data()
        self.set_user_data()
        return self.complete_login_or_signup()

    def complete_login_or_signup(self):
        if self.provider != "oidc":
            return super().complete_login_or_signup()
        # Serialize automatic email association and explicit profile re-linking on the user.
        with transaction.atomic():
            email = self.sanitize_email(self.user_data.get("email"))
            user = User.objects.select_for_update().filter(email=email).first()
            sub = self.user_data.get("user", {}).get("provider_id")
            if user:
                ensure_single_oidc_identity(user, sub)
            return super().complete_login_or_signup()

    def get_user_token(self, data, headers=None):
        try:
            headers = headers or {}
            response = requests.post(self.get_token_url(), data=data, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException:
            self.logger.warning("Error getting user token")
            code = self.authentication_error_code()
            raise AuthenticationException(error_code=AUTHENTICATION_ERROR_CODES[code], error_message=str(code))

    def get_user_response(self):
        try:
            headers = {"Authorization": f"Bearer {self.token_data.get('access_token')}"}
            response = requests.get(self.get_user_info_url(), headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException:
            # Do not log headers here: they carry the access token
            self.logger.warning("Error getting user response")
            code = self.authentication_error_code()
            raise AuthenticationException(error_code=AUTHENTICATION_ERROR_CODES[code], error_message=str(code))

    def set_user_data(self, data):
        self.user_data = data

    def create_update_account(self, user):
        try:
            # Check if the account already exists
            account = Account.objects.filter(
                user=user,
                provider=self.provider,
                provider_account_id=self.user_data.get("user").get("provider_id"),
            ).first()
            # Update the account if it exists
            if account:
                account.access_token = self.token_data.get("access_token")
                account.refresh_token = self.token_data.get("refresh_token", None)
                account.access_token_expired_at = self.token_data.get("access_token_expired_at")
                account.refresh_token_expired_at = self.token_data.get("refresh_token_expired_at")
                account.last_connected_at = timezone.now()
                account.id_token = self.token_data.get("id_token", "")
                if "metadata" in self.token_data:
                    account.metadata = {**account.metadata, **self.token_data["metadata"]}
                    if "feishu_identity" not in self.token_data["metadata"]:
                        account.metadata.pop("feishu_identity", None)
                account.save()
            # Create a new account if it does not exist
            else:
                Account.objects.create(
                    user=user,
                    provider=self.provider,
                    provider_account_id=self.user_data.get("user", {}).get("provider_id"),
                    access_token=self.token_data.get("access_token"),
                    refresh_token=self.token_data.get("refresh_token", None),
                    access_token_expired_at=self.token_data.get("access_token_expired_at"),
                    refresh_token_expired_at=self.token_data.get("refresh_token_expired_at"),
                    last_connected_at=timezone.now(),
                    id_token=self.token_data.get("id_token", ""),
                    metadata=self.token_data.get("metadata", {}),
                )
        except (DatabaseError, IntegrityError) as e:
            if self.provider == "oidc":
                # A concurrent claim must roll back this login, rather than authenticating
                # a user whose identity could not be persisted.
                key = "OIDC_ACCOUNT_ALREADY_LINKED" if isinstance(e, IntegrityError) else "OIDC_OAUTH_PROVIDER_ERROR"
                raise AuthenticationException(error_code=AUTHENTICATION_ERROR_CODES[key], error_message=key) from e
            log_exception(e)


def ensure_single_oidc_identity(user, sub):
    if Account.objects.filter(user=user, provider="oidc").exclude(provider_account_id=sub).exists():
        raise AuthenticationException(
            error_code=AUTHENTICATION_ERROR_CODES["OIDC_IDENTITY_ALREADY_BOUND"],
            error_message="OIDC_IDENTITY_ALREADY_BOUND",
        )
    if Account.objects.filter(provider="oidc", provider_account_id=sub).exclude(user=user).exists():
        raise AuthenticationException(
            error_code=AUTHENTICATION_ERROR_CODES["OIDC_ACCOUNT_ALREADY_LINKED"],
            error_message="OIDC_ACCOUNT_ALREADY_LINKED",
        )
