# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""God mode sign-in through the instance's OIDC provider.

Password sign-in stays available as the fallback for when the identity
provider is down. Both endpoints live under /api/instances/ so the whole
round trip uses the God mode session cookie (see SessionMiddleware).
"""

import uuid
from urllib.parse import urlencode, urljoin

# Django imports
from django.http import HttpResponseRedirect
from django.views import View

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
from plane.authentication.utils.host import base_host
from plane.authentication.utils.login import user_login
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


def resolve_admin_user(sub, email):
    """Map an IdP identity to an instance admin, or None.

    The linked identity wins; a trusted IdP email is the fallback, exactly as
    for app sign-in. Only active, non-bot users who are admins qualify.
    """
    account = Account.objects.filter(provider="oidc", provider_account_id=sub).select_related("user").first()
    user = account.user if account else (User.objects.filter(email=email).first() if email else None)
    if user is None or not user.is_active or user.is_bot:
        return None
    if not InstanceAdmin.objects.filter(user=user).exists():
        return None
    return user


class InstanceAdminOIDCInitiateEndpoint(View):
    def get(self, request):
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            return _error_redirect(request, "INSTANCE_NOT_CONFIGURED")
        try:
            state = uuid.uuid4().hex
            provider = OIDCOAuthProvider(request=request, state=state, redirect_path=CALLBACK_PATH)
        except AuthenticationException:
            return _error_redirect(request, "ADMIN_SSO_FAILED")
        request.session[STATE_SESSION_KEY] = state
        return HttpResponseRedirect(provider.get_auth_url())


class InstanceAdminOIDCCallbackEndpoint(View):
    def get(self, request):
        code = request.GET.get("code")
        state = request.GET.get("state")
        expected_state = request.session.pop(STATE_SESSION_KEY, None)
        if not code or not state or state != expected_state:
            return _error_redirect(request, "ADMIN_SSO_FAILED")

        try:
            provider = OIDCOAuthProvider(request=request, code=code, redirect_path=CALLBACK_PATH)
            sub, email = provider.fetch_identity()
        except AuthenticationException:
            return _error_redirect(request, "ADMIN_SSO_FAILED")

        user = resolve_admin_user(sub, email)
        if user is None:
            return _error_redirect(request, "ADMIN_SSO_NOT_ADMIN")

        user_login(request=request, user=user, is_admin=True)
        return HttpResponseRedirect(urljoin(base_host(request=request, is_admin=True), "general/"))
