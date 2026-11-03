# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""God mode sign-in through the instance's OIDC provider.

Password sign-in stays available as the fallback for when the identity
provider is down. Both endpoints live under /api/instances/ so the whole
round trip uses the God mode session cookie (see SessionMiddleware).
"""

from urllib.parse import urlencode, urljoin

# Django imports
from django.http import HttpResponseRedirect
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.views import View

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
from plane.authentication.utils.host import base_host
from plane.authentication.utils.login import user_login
from plane.authentication.adapter.oauth import ensure_single_oidc_identity
from plane.authentication.utils.oidc_state import start_oidc_transaction, consume_oidc_transaction
from plane.db.models import Account, User
from plane.license.models import Instance, InstanceAdmin

CALLBACK_PATH = "/api/instances/admins/oidc/callback/"
STATE_SESSION_KEY = "admin_oidc_state"


def _error_redirect(request, error_key):
    exc = AuthenticationException(
        error_code=AUTHENTICATION_ERROR_CODES[error_key],
        error_message=error_key,
    )
    return HttpResponseRedirect(base_host(request=request, is_admin=True) + "?" + urlencode(exc.get_error_dict()))


@transaction.atomic
def resolve_admin_user(sub, email, token_data=None):
    """Map an IdP identity to an instance admin, or None.

    The linked identity wins; a trusted IdP email is the fallback, exactly as
    for app sign-in. Only active, non-bot users who are admins qualify.
    """
    account = Account.objects.filter(provider="oidc", provider_account_id=sub).select_related("user").first()
    user = account.user if account else (User.objects.filter(email=email).first() if email else None)
    if user is not None:
        user = User.objects.select_for_update().get(pk=user.pk)
        ensure_single_oidc_identity(user, sub)
    if user is None or not user.is_active or user.is_bot:
        return None
    if not InstanceAdmin.objects.filter(user=user).exists():
        return None
    # Persist the first trusted-email association while holding the same user lock.
    # Otherwise another sub with the same email could keep using this fallback.
    token_data = token_data or {}
    Account.objects.get_or_create(
        user=user,
        provider="oidc",
        provider_account_id=sub,
        defaults={
            "access_token": token_data.get("access_token") or "",
            "refresh_token": token_data.get("refresh_token"),
            "access_token_expired_at": token_data.get("access_token_expired_at"),
            "refresh_token_expired_at": token_data.get("refresh_token_expired_at"),
            "id_token": token_data.get("id_token", ""),
            "metadata": token_data.get("metadata", {}),
            "last_connected_at": timezone.now(),
        },
    )
    return user


class InstanceAdminOIDCInitiateEndpoint(View):
    def get(self, request):
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            return _error_redirect(request, "INSTANCE_NOT_CONFIGURED")
        try:
            state = start_oidc_transaction(request, host=base_host(request=request, is_admin=True), audience="admin")
            provider = OIDCOAuthProvider(
                request=request, state=state, redirect_path=CALLBACK_PATH, entry=request.GET.get("entry")
            )
        except AuthenticationException as exc:
            return _error_redirect(request, exc.error_message)
        return HttpResponseRedirect(provider.get_auth_url())


class InstanceAdminOIDCCallbackEndpoint(View):
    def get(self, request):
        code = request.GET.get("code")
        state = request.GET.get("state")
        pending = consume_oidc_transaction(request, state, audience="admin")
        if not code or not pending:
            return _error_redirect(request, "ADMIN_SSO_FAILED")

        try:
            provider = OIDCOAuthProvider(request=request, code=code, redirect_path=CALLBACK_PATH)
            sub, email = provider.fetch_identity()
        except AuthenticationException:
            return _error_redirect(request, "ADMIN_SSO_FAILED")

        try:
            user = resolve_admin_user(sub, email, token_data=provider.token_data)
        except AuthenticationException as exc:
            return _error_redirect(request, exc.error_message)
        except IntegrityError:
            return _error_redirect(request, "OIDC_ACCOUNT_ALREADY_LINKED")
        if user is None:
            return _error_redirect(request, "ADMIN_SSO_NOT_ADMIN")

        user_login(request=request, user=user, is_admin=True)
        return HttpResponseRedirect(urljoin(base_host(request=request, is_admin=True), "general/"))
