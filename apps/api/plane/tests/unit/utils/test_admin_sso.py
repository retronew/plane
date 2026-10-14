# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES, AuthenticationException
from plane.license.api.views import admin_sso

ADMIN_HOST = "http://admin.example.com/god-mode/"


def _user(active=True, bot=False):
    user = MagicMock()
    user.is_active = active
    user.is_bot = bot
    return user


def _patch_lookup(account_user=None, email_user=None, is_admin=True):
    account = MagicMock(user=account_user) if account_user else None
    patches = [
        patch.object(admin_sso.Account.objects, "filter"),
        patch.object(admin_sso.User.objects, "filter"),
        patch.object(admin_sso.InstanceAdmin.objects, "filter"),
    ]
    accounts, users, admins = (p.start() for p in patches)
    accounts.return_value.select_related.return_value.first.return_value = account
    users.return_value.first.return_value = email_user
    admins.return_value.exists.return_value = is_admin
    return patches


@pytest.fixture
def stop_patches():
    started = []
    yield started
    for patches in started:
        for p in patches:
            p.stop()


@pytest.mark.unit
class TestResolveAdminUser:
    def test_linked_identity_wins(self, stop_patches):
        linked = _user()
        stop_patches.append(_patch_lookup(account_user=linked, email_user=_user()))
        assert admin_sso.resolve_admin_user("sub-1", "other@example.com") is linked

    def test_trusted_email_is_the_fallback(self, stop_patches):
        by_email = _user()
        stop_patches.append(_patch_lookup(email_user=by_email))
        assert admin_sso.resolve_admin_user("sub-1", "admin@example.com") is by_email

    def test_no_email_and_no_link_is_rejected(self, stop_patches):
        stop_patches.append(_patch_lookup(email_user=_user()))
        assert admin_sso.resolve_admin_user("sub-1", None) is None

    def test_non_admin_is_rejected(self, stop_patches):
        stop_patches.append(_patch_lookup(account_user=_user(), is_admin=False))
        assert admin_sso.resolve_admin_user("sub-1", None) is None

    @pytest.mark.parametrize("user", [_user(active=False), _user(bot=True)])
    def test_inactive_or_bot_is_rejected(self, stop_patches, user):
        stop_patches.append(_patch_lookup(account_user=user))
        assert admin_sso.resolve_admin_user("sub-1", None) is None


def _request(state="s1", session_state="s1", code="c1"):
    request = MagicMock()
    request.GET = {"code": code, "state": state}
    request.session = {admin_sso.STATE_SESSION_KEY: session_state} if session_state else {}
    return request


def _error_code(response):
    return parse_qs(urlparse(response.url).query)["error_code"][0]


@pytest.mark.unit
@patch.object(admin_sso, "base_host", return_value=ADMIN_HOST)
class TestAdminOIDCCallback:
    def test_state_mismatch_is_rejected(self, _base_host):
        with patch.object(admin_sso, "OIDCOAuthProvider") as provider:
            response = admin_sso.InstanceAdminOIDCCallbackEndpoint().get(_request(state="forged"))
        provider.assert_not_called()
        assert _error_code(response) == str(AUTHENTICATION_ERROR_CODES["ADMIN_SSO_FAILED"])

    def test_provider_error_is_reported(self, _base_host):
        failing = MagicMock()
        failing.fetch_identity.side_effect = AuthenticationException(error_code=1, error_message="X")
        with patch.object(admin_sso, "OIDCOAuthProvider", return_value=failing):
            response = admin_sso.InstanceAdminOIDCCallbackEndpoint().get(_request())
        assert _error_code(response) == str(AUTHENTICATION_ERROR_CODES["ADMIN_SSO_FAILED"])

    def test_non_admin_cannot_sign_in(self, _base_host):
        provider = MagicMock()
        provider.fetch_identity.return_value = ("sub-1", "member@example.com")
        with (
            patch.object(admin_sso, "OIDCOAuthProvider", return_value=provider),
            patch.object(admin_sso, "resolve_admin_user", return_value=None),
            patch.object(admin_sso, "user_login") as login,
        ):
            response = admin_sso.InstanceAdminOIDCCallbackEndpoint().get(_request())
        login.assert_not_called()
        assert _error_code(response) == str(AUTHENTICATION_ERROR_CODES["ADMIN_SSO_NOT_ADMIN"])

    def test_admin_gets_a_god_mode_session(self, _base_host):
        admin = _user()
        provider = MagicMock()
        provider.fetch_identity.return_value = ("sub-1", None)
        request = _request()
        with (
            patch.object(admin_sso, "OIDCOAuthProvider", return_value=provider) as provider_cls,
            patch.object(admin_sso, "resolve_admin_user", return_value=admin),
            patch.object(admin_sso, "user_login") as login,
        ):
            response = admin_sso.InstanceAdminOIDCCallbackEndpoint().get(request)
        # The code is exchanged with the same God mode redirect URI it was issued for
        assert provider_cls.call_args.kwargs["redirect_path"] == admin_sso.CALLBACK_PATH
        login.assert_called_once_with(request=request, user=admin, is_admin=True)
        assert response.url == f"{ADMIN_HOST}general/"
        # The state is single-use
        assert admin_sso.STATE_SESSION_KEY not in request.session
