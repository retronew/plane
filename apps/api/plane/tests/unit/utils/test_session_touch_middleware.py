# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for SessionMiddleware sliding-touch throttling and APITokenLogMiddleware body skip."""

import time
from unittest.mock import MagicMock, patch

import pytest
from django.http import HttpResponse
from django.test import RequestFactory

from plane.authentication.middleware.session import SessionMiddleware
from plane.middleware.logger import APITokenLogMiddleware


@pytest.mark.unit
def test_session_middleware_throttles_readonly_get_writes(settings):
    settings.SESSION_TOUCH_INTERVAL = 300
    settings.SESSION_COOKIE_NAME = "session-id"
    settings.SESSION_COOKIE_PATH = "/"
    settings.SESSION_COOKIE_DOMAIN = None
    settings.SESSION_COOKIE_SECURE = False
    settings.SESSION_COOKIE_HTTPONLY = True
    settings.SESSION_COOKIE_SAMESITE = "Lax"

    mw = SessionMiddleware(lambda req: HttpResponse("ok"))
    req = RequestFactory().get("/api/workspaces/demo/projects/")
    session_data = {"_auth_user_id": "u1", "_last_touched": int(time.time())}
    session = MagicMock()
    session.accessed = True
    session.modified = False
    session.is_empty.return_value = False
    session.get.side_effect = session_data.get
    session.__setitem__.side_effect = session_data.__setitem__
    session.get_expire_at_browser_close.return_value = False
    session.get_expiry_age.return_value = 3600
    session.session_key = "abc123"
    req.session = session

    with patch("plane.authentication.middleware.session.get_session_config", return_value=(3600, 3600, True)):
        resp = mw.process_response(req, HttpResponse("ok"))
    assert resp.status_code == 200
    session.save.assert_not_called()

    # Once the touch interval has elapsed, a sliding refresh save occurs.
    session_data["_last_touched"] = int(time.time()) - 400
    with patch("plane.authentication.middleware.session.get_session_config", return_value=(3600, 3600, True)):
        mw.process_response(req, HttpResponse("ok"))
    session.save.assert_called_once()


@pytest.mark.unit
def test_api_token_log_middleware_skips_body_read_without_api_key():
    mw = APITokenLogMiddleware(lambda req: HttpResponse("ok"))
    req = MagicMock()
    req.headers = {}
    type(req).body = property(lambda self: (_ for _ in ()).throw(AssertionError("body should not be read")))
    resp = mw(req)
    assert resp.status_code == 200
