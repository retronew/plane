# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Link an OIDC identity to the signed-in user.

Accounts created before SSO was enabled (e.g. the first instance admin) have
no OIDC identity yet, and their email may differ from the one the IdP
returns. Signing in with SSO would then land in a different account, so the
user links the identity from their profile while signed in instead.
"""

from urllib.parse import urlencode, urljoin

# Django imports
from django.http import HttpResponseRedirect
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.views import View

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
from plane.authentication.utils.host import base_host
from plane.authentication.utils.oidc_state import start_oidc_transaction
from plane.db.models import Account, User

SESSION_KEY = "oidc_link_user_id"
PROFILE_PATH = "settings/profile/general/"


def _profile_url(host, params):
    return urljoin(host.rstrip("/") + "/", PROFILE_PATH) + "?" + urlencode(params)


class OIDCLinkStatusEndpoint(APIView):
    def get(self, request):
        account = Account.objects.filter(user=request.user, provider="oidc").first()
        return Response(
            {"linked": bool(account), "linked_at": account.created_at if account else None},
            status=status.HTTP_200_OK,
        )


class OIDCLinkInitiateEndpoint(View):
    def get(self, request):
        host = base_host(request=request, is_app=True)
        if not request.user.is_authenticated:
            return HttpResponseRedirect(host)
        try:
            state = start_oidc_transaction(request, host=host, purpose="link", user_id=request.user.id)
            provider = OIDCOAuthProvider(request=request, state=state, entry=request.GET.get("entry"))
        except AuthenticationException as e:
            return HttpResponseRedirect(_profile_url(host, e.get_error_dict()))
        request.session["host"] = host
        request.session.pop("next_path", None)
        return HttpResponseRedirect(provider.get_auth_url())


def complete_oidc_link(request, code, host, user_id=None):
    """Finish a link started by OIDCLinkInitiateEndpoint (called from the callback)."""
    user_id = user_id or request.session.pop(SESSION_KEY, None)
    # The link must finish in the same signed-in session that started it
    if not request.user.is_authenticated or str(request.user.id) != user_id:
        return HttpResponseRedirect(host)

    try:
        provider = OIDCOAuthProvider(request=request, code=code)
        sub, idp_email = provider.fetch_identity()
    except AuthenticationException as e:
        return HttpResponseRedirect(_profile_url(host, e.get_error_dict()))

    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=user_id)
            existing = Account.objects.filter(provider="oidc", provider_account_id=sub).first()
            if existing and existing.user_id != user.id:
                exc = AuthenticationException(
                    error_code=AUTHENTICATION_ERROR_CODES["OIDC_ACCOUNT_ALREADY_LINKED"],
                    error_message="OIDC_ACCOUNT_ALREADY_LINKED",
                )
                return HttpResponseRedirect(_profile_url(host, exc.get_error_dict()))

            token_data = provider.token_data or {}
            defaults = {
                "access_token": token_data.get("access_token") or "",
                "refresh_token": token_data.get("refresh_token"),
                "access_token_expired_at": token_data.get("access_token_expired_at"),
                "refresh_token_expired_at": token_data.get("refresh_token_expired_at"),
                "id_token": token_data.get("id_token", ""),
                "metadata": token_data.get("metadata", {}),
                "last_connected_at": timezone.now(),
            }
            # A user links one identity: re-linking replaces the previous one
            Account.objects.filter(user=user, provider="oidc").exclude(provider_account_id=sub).delete()
            Account.objects.update_or_create(user=user, provider="oidc", provider_account_id=sub, defaults=defaults)
    except IntegrityError:
        exc = AuthenticationException(
            error_code=AUTHENTICATION_ERROR_CODES["OIDC_ACCOUNT_ALREADY_LINKED"],
            error_message="OIDC_ACCOUNT_ALREADY_LINKED",
        )
        return HttpResponseRedirect(_profile_url(host, exc.get_error_dict()))

    params = {"oidc_linked": "1"}
    # Suggest the IdP email when it differs; changing it still requires the
    # usual verification code, and only if no other account uses it
    if idp_email and idp_email != user.email and not User.objects.filter(email=idp_email).exists():
        params["oidc_email"] = idp_email
    return HttpResponseRedirect(_profile_url(host, params))
