# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES, AuthenticationException
from plane.authentication.provider.oauth.oidc import OIDCEmailMissing
from plane.authentication.utils import oidc_email_bind as bind

APP_HOST = "http://app.example.com"
SPACE_HOST = "http://app.example.com/spaces/"
USER = {
    "provider_id": "user-1",
    "avatar": None,
    "first_name": "孔维维",
    "last_name": "",
    "display_name": "孔维维",
    "is_password_autoset": True,
}


class FakeRedis:
    def __init__(self):
        self.store = {}

    def set(self, key, value, ex=None, keepttl=False):
        self.store[key] = value

    def get(self, key):
        return self.store.get(key)

    def delete(self, key):
        self.store.pop(key, None)


@pytest.fixture
def redis():
    fake = FakeRedis()
    with patch.object(bind, "redis_instance", return_value=fake):
        yield fake


@pytest.fixture
def smtp():
    with patch.object(bind, "is_smtp_configured", return_value=True) as mock_smtp:
        yield mock_smtp


def _request():
    request = MagicMock()
    request.session = {}
    return request


def _start(request, is_space=False):
    bind.start_email_bind(
        request,
        dict(USER),
        {"access_token": "at", "refresh_token": "rt", "id_token": "it", "access_token_expired_at": object()},
        host=SPACE_HOST if is_space else APP_HOST,
        is_space=is_space,
    )


@pytest.mark.unit
class TestRedirectToEmailBind:
    def _missing(self):
        return OIDCEmailMissing(user=dict(USER), token_data={"access_token": "at"})

    @patch.object(bind, "base_host", return_value=SPACE_HOST)
    def test_without_smtp_explains_admin_must_act(self, _base_host, redis):
        request = _request()
        with patch.object(bind, "is_smtp_configured", return_value=False):
            response = bind.redirect_to_email_bind(request, self._missing(), host=APP_HOST)

        query = parse_qs(urlparse(response.url).query)
        assert query["error_code"] == [str(AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_NOT_PROVIDED"])]
        assert bind.SESSION_KEY not in request.session
        assert redis.store == {}

    @patch.object(bind, "base_host", return_value=SPACE_HOST)
    def test_with_smtp_parks_identity_and_opens_bind_page(self, _base_host, redis, smtp):
        request = _request()
        response = bind.redirect_to_email_bind(request, self._missing(), host=APP_HOST, next_path="/ws/")

        assert response.url == f"{APP_HOST}/accounts/oidc/bind-email/?next_path=%2Fws%2F"
        _, pending = bind.get_pending(request)
        assert pending["user"]["provider_id"] == "user-1"
        assert pending["is_space"] is False

    @patch.object(bind, "base_host", return_value=SPACE_HOST)
    def test_space_host_opens_space_bind_page(self, _base_host, redis, smtp):
        request = _request()
        response = bind.redirect_to_email_bind(request, self._missing(), host=SPACE_HOST)

        assert response.url == f"{SPACE_HOST}accounts/oidc/bind-email/"
        assert bind.get_pending(request)[1]["is_space"] is True


@pytest.mark.unit
class TestEmailBindCode:
    def test_issue_requires_pending_identity(self, redis, smtp):
        with pytest.raises(AuthenticationException) as exc:
            bind.issue_code(_request(), "a@example.com")
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_EXPIRED"]

    def test_issue_rejects_invalid_email(self, redis, smtp):
        request = _request()
        _start(request)
        with pytest.raises(AuthenticationException) as exc:
            bind.issue_code(request, "not-an-email")
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["INVALID_EMAIL"]

    def test_issue_requires_smtp(self, redis):
        request = _request()
        _start(request)
        with patch.object(bind, "is_smtp_configured", return_value=False):
            with pytest.raises(AuthenticationException) as exc:
                bind.issue_code(request, "a@example.com")
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["SMTP_NOT_CONFIGURED"]

    def test_valid_code_returns_identity_once(self, redis, smtp):
        request = _request()
        _start(request)
        email, code = bind.issue_code(request, " A@Example.com ")
        assert email == "a@example.com"

        pending, bound_email = bind.verify_code(request, "a@example.com", code)
        assert bound_email == "a@example.com"
        assert pending["user"]["provider_id"] == "user-1"
        # The identity is consumed: the same code cannot be replayed
        assert bind.get_pending(request) == (None, None)

    def test_code_is_bound_to_the_requested_email(self, redis, smtp):
        request = _request()
        _start(request)
        _, code = bind.issue_code(request, "a@example.com")
        with pytest.raises(AuthenticationException) as exc:
            bind.verify_code(request, "victim@example.com", code)
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_INVALID_CODE"]

    def test_wrong_codes_exhaust_the_bind(self, redis, smtp):
        request = _request()
        _start(request)
        bind.issue_code(request, "a@example.com")
        for _ in range(bind.MAX_VERIFY_ATTEMPTS - 1):
            with pytest.raises(AuthenticationException) as exc:
                bind.verify_code(request, "a@example.com", "000000")
            assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_INVALID_CODE"]
        with pytest.raises(AuthenticationException) as exc:
            bind.verify_code(request, "a@example.com", "000000")
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_EXPIRED"]
        assert redis.store == {}

    def test_resends_are_capped(self, redis, smtp):
        request = _request()
        _start(request)
        for _ in range(bind.MAX_CODE_SENDS):
            bind.issue_code(request, "a@example.com")
        with pytest.raises(AuthenticationException) as exc:
            bind.issue_code(request, "a@example.com")
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_EXPIRED"]

    def test_pending_from_another_session_is_not_visible(self, redis, smtp):
        _start(_request())
        with pytest.raises(AuthenticationException) as exc:
            bind.issue_code(_request(), "a@example.com")
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_EXPIRED"]


@pytest.mark.unit
class TestOIDCEmailBindAdapter:
    def test_adapter_carries_verified_email_and_identity(self, redis, smtp):
        request = _request()
        _start(request)
        _, code = bind.issue_code(request, "a@example.com")
        pending, email = bind.verify_code(request, "a@example.com", code)

        adapter = bind.OIDCEmailBindAdapter(request=request, pending=pending, email=email)

        assert adapter.provider == "oidc"
        assert adapter.user_data["email"] == "a@example.com"
        assert adapter.user_data["user"]["provider_id"] == "user-1"
        assert adapter.user_data["user"]["is_password_autoset"] is True
        assert adapter.token_data["access_token"] == "at"
        assert adapter.token_data["access_token_expired_at"] is None
