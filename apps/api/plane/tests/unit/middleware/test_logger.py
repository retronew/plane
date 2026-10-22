# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for request logging middleware.

Covers the credential-hygiene guarantees of the request loggers:
- the raw API key is never persisted (a non-reversible hash is stored instead)
- sensitive request headers are redacted before being logged
- OAuth query parameters are omitted and sensitive exchanges are not persisted
"""

import hashlib
import hmac
from unittest.mock import Mock, patch

import pytest
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.test import RequestFactory

from plane.middleware.logger import APITokenLogMiddleware, RequestLoggerMiddleware


@pytest.fixture
def request_factory():
    return RequestFactory()


@pytest.fixture
def middleware():
    return APITokenLogMiddleware(Mock(return_value=HttpResponse(b"{}")))


@pytest.mark.unit
class TestAPITokenLogMiddleware:
    API_KEY = "plane_api_supersecretvalue"
    AUTHORIZATION = "Bearer secret-bearer-token"
    COOKIE = "sessionid=secret-session-value"

    def _captured_log_data(self, middleware, request_factory):
        request = request_factory.get(
            "/api/v1/workspaces/",
            HTTP_X_API_KEY=self.API_KEY,
            HTTP_AUTHORIZATION=self.AUTHORIZATION,
            HTTP_COOKIE=self.COOKIE,
        )
        request.user = AnonymousUser()
        response = HttpResponse(b"{}")
        with patch("plane.middleware.logger.process_logs") as process_logs:
            middleware.process_request(request, response, request_body=b"")
            assert process_logs.delay.called
            return process_logs.delay.call_args.kwargs["log_data"]

    def test_token_identifier_is_hashed_not_plaintext(self, middleware, request_factory):
        log_data = self._captured_log_data(middleware, request_factory)

        expected_hash = hmac.new(
            settings.SECRET_KEY.encode(), self.API_KEY.encode(), hashlib.sha256
        ).hexdigest()
        assert log_data["token_identifier"] == expected_hash
        assert self.API_KEY not in log_data["token_identifier"]

    def test_sensitive_headers_are_redacted(self, middleware, request_factory):
        log_data = self._captured_log_data(middleware, request_factory)

        # None of the sensitive header values may appear in the logged headers.
        assert self.API_KEY not in log_data["headers"]
        assert self.AUTHORIZATION not in log_data["headers"]
        assert self.COOKIE not in log_data["headers"]
        assert "[REDACTED]" in log_data["headers"]

    def test_no_log_without_api_key(self, middleware, request_factory):
        request = request_factory.get("/api/v1/workspaces/")
        request.user = AnonymousUser()
        with patch("plane.middleware.logger.process_logs") as process_logs:
            middleware.process_request(request, HttpResponse(b"{}"), request_body=b"")
            assert not process_logs.delay.called


@pytest.mark.unit
def test_oauth_exchange_is_not_persisted_even_with_api_key(middleware, request_factory):
    request = request_factory.post("/auth/mcp/token/", HTTP_X_API_KEY="test-key")
    with patch("plane.middleware.logger.process_logs") as logs:
        middleware.process_request(request, HttpResponse(b'{"access_token":"secret"}'), b"code=secret")
        logs.delay.assert_not_called()


@pytest.mark.unit
@pytest.mark.parametrize(
    "path",
    ["/auth/mcp/authorize/", "/api/users/me/integrations/feishu/callback/"],
)
def test_oauth_request_log_omits_sensitive_query(request_factory, path):
    request = request_factory.get(path, {"code": "secret-code", "state": "secret-state"})
    request.user = AnonymousUser()
    response = HttpResponse(status=302)
    assert "code=secret-code" in request.get_full_path()
    assert "state=secret-state" in request.get_full_path()

    with patch("plane.middleware.logger.api_logger") as logger:
        assert RequestLoggerMiddleware(lambda request: response)(request) is response

    logger.info.assert_called_once()
    assert logger.info.call_args.args == (f"GET {path} 302",)
    assert logger.info.call_args.kwargs["extra"]["path"] == path
    logged_data = str(logger.mock_calls)
    assert "secret-code" not in logged_data
    assert "secret-state" not in logged_data


@pytest.mark.unit
def test_feishu_callback_is_not_persisted_even_with_api_key(request_factory):
    request = request_factory.get(
        "/api/users/me/integrations/feishu/callback/",
        {"code": "secret-code", "state": "secret-state"},
        HTTP_X_API_KEY="test-key",
    )
    response = HttpResponse(status=302)
    middleware = APITokenLogMiddleware(Mock(return_value=response))

    with patch("plane.middleware.logger.process_logs") as logs:
        assert middleware(request) is response

    middleware.get_response.assert_called_once_with(request)
    logs.delay.assert_not_called()


@pytest.mark.unit
def test_regular_request_log_preserves_query(request_factory):
    request = request_factory.get("/api/v1/workspaces/?page=2")
    request.user = AnonymousUser()

    with patch("plane.middleware.logger.api_logger") as logger:
        RequestLoggerMiddleware(lambda request: HttpResponse())(request)

    logger.info.assert_called_once()
    assert logger.info.call_args.args == ("GET /api/v1/workspaces/?page=2 200",)
