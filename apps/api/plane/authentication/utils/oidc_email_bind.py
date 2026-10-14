# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Bind an email to an OIDC identity whose provider returned none.

Some identity providers (e.g. Casdoor backed by Lark/Feishu) cannot always
return an email address. Plane accounts are keyed by email, so instead of
rejecting the login we park the verified OIDC identity server-side, ask the
user for an email and only complete the login once they prove ownership of
that address with a one-time code. Without that proof anyone signing in
through the IdP could claim an existing user's email and take over the
account.

The pending identity lives in Redis under a random id that is only stored in
the user's session, so it cannot be replayed from another browser.
"""

# Python imports
import hmac
import json
import os
import secrets
import uuid
from urllib.parse import urlencode, urljoin

# Django imports
from django.core.exceptions import ValidationError
from django.http import HttpResponseRedirect
from django.core.validators import validate_email

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.adapter.oauth import OauthAdapter
from plane.authentication.utils.host import base_host
from plane.license.utils.instance_value import get_configuration_value
from plane.settings.redis import redis_instance
from plane.utils.path_validator import validate_next_path

SESSION_KEY = "oidc_email_bind_id"
BIND_PAGE_PATH = "accounts/oidc/bind-email/"
PENDING_TTL_SECONDS = 600
MAX_CODE_SENDS = 5
MAX_VERIFY_ATTEMPTS = 5


def _pending_key(bind_id):
    return f"oidc_email_bind:{bind_id}"


def is_smtp_configured():
    (EMAIL_HOST,) = get_configuration_value([{"key": "EMAIL_HOST", "default": os.environ.get("EMAIL_HOST", "")}])
    return bool(EMAIL_HOST)


def _expired():
    return AuthenticationException(
        error_code=AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_EXPIRED"],
        error_message="OIDC_EMAIL_BIND_EXPIRED",
    )


def start_email_bind(request, user, token_data, host, is_space):
    """Park the OIDC identity and remember it in the session."""
    bind_id = uuid.uuid4().hex
    pending = {
        "user": user,
        "token_data": {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "id_token": token_data.get("id_token", ""),
        },
        "host": host,
        "is_space": is_space,
        "email": None,
        "code": None,
        "code_sends": 0,
        "verify_attempts": 0,
    }
    redis_instance().set(_pending_key(bind_id), json.dumps(pending), ex=PENDING_TTL_SECONDS)
    request.session[SESSION_KEY] = bind_id


def redirect_to_email_bind(request, missing, host, next_path=None):
    """Send a user whose IdP returned no email to the bind page, or explain
    to them that the administrator must act when no code can be mailed."""
    params = {}
    if next_path:
        params["next_path"] = str(validate_next_path(next_path))

    if not is_smtp_configured():
        exc = AuthenticationException(
            error_code=AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_NOT_PROVIDED"],
            error_message="OIDC_EMAIL_NOT_PROVIDED",
        )
        params.update(exc.get_error_dict())
        return HttpResponseRedirect(urljoin(host, "?" + urlencode(params)))

    is_space = host.rstrip("/") == base_host(request=request, is_space=True).rstrip("/")
    start_email_bind(request, missing.user, missing.token_data, host=host, is_space=is_space)
    url = urljoin(host.rstrip("/") + "/", BIND_PAGE_PATH)
    return HttpResponseRedirect(url + ("?" + urlencode(params) if params else ""))


def get_pending(request):
    bind_id = request.session.get(SESSION_KEY)
    if not bind_id:
        return None, None
    raw = redis_instance().get(_pending_key(bind_id))
    if not raw:
        return bind_id, None
    return bind_id, json.loads(raw)


def _save(bind_id, pending):
    # keepttl: the bind window starts at the OIDC callback and is never extended
    redis_instance().set(_pending_key(bind_id), json.dumps(pending), keepttl=True)


def clear_pending(request, bind_id=None):
    bind_id = bind_id or request.session.get(SESSION_KEY)
    if bind_id:
        redis_instance().delete(_pending_key(bind_id))
    request.session.pop(SESSION_KEY, None)


def normalize_email(email):
    email = str(email or "").strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        raise AuthenticationException(
            error_code=AUTHENTICATION_ERROR_CODES["INVALID_EMAIL"],
            error_message="INVALID_EMAIL",
            payload={"email": email},
        )
    return email


def issue_code(request, email):
    """Generate a code for `email` and return it; the caller sends the mail."""
    bind_id, pending = get_pending(request)
    if not pending:
        raise _expired()
    if not is_smtp_configured():
        raise AuthenticationException(
            error_code=AUTHENTICATION_ERROR_CODES["SMTP_NOT_CONFIGURED"],
            error_message="SMTP_NOT_CONFIGURED",
        )

    email = normalize_email(email)
    if pending["code_sends"] >= MAX_CODE_SENDS:
        clear_pending(request, bind_id)
        raise _expired()

    code = str(secrets.randbelow(900000) + 100000)
    pending.update(
        {
            "email": email,
            "code": code,
            "code_sends": pending["code_sends"] + 1,
            "verify_attempts": 0,
        }
    )
    _save(bind_id, pending)
    return email, code


def verify_code(request, email, code):
    """Check the code and return the pending identity with the bound email."""
    bind_id, pending = get_pending(request)
    if not pending:
        raise _expired()

    email = normalize_email(email)
    code = str(code or "").strip()
    expected = pending.get("code")
    if expected and pending.get("email") == email and hmac.compare_digest(code, expected):
        clear_pending(request, bind_id)
        return pending, email

    pending["verify_attempts"] += 1
    if pending["verify_attempts"] >= MAX_VERIFY_ATTEMPTS:
        clear_pending(request, bind_id)
        raise _expired()
    _save(bind_id, pending)
    raise AuthenticationException(
        error_code=AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_INVALID_CODE"],
        error_message="OIDC_EMAIL_BIND_INVALID_CODE",
        payload={"email": email},
    )


class OIDCEmailBindAdapter(OauthAdapter):
    """Completes an OIDC login for a parked identity using the verified email."""

    def __init__(self, request, pending, email, callback=None):
        super().__init__(
            request=request,
            provider="oidc",
            client_id=None,
            scope=None,
            redirect_uri=None,
            auth_url=None,
            token_url=None,
            userinfo_url=None,
            callback=callback,
        )
        user = dict(pending["user"])
        user["email"] = email
        self.user_data = {"email": email, "user": user}
        self.token_data = {
            **pending["token_data"],
            "access_token_expired_at": None,
            "refresh_token_expired_at": None,
        }

    def authenticate(self):
        return self.complete_login_or_signup()
