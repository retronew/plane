# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from urllib.parse import urlencode, urljoin

# Django imports
from django.http import HttpResponseRedirect
from django.views import View

# Third party imports
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.utils.host import base_host
from plane.authentication.rate_limit import AuthenticationThrottle, throttle_auth_redirect
from plane.authentication.utils.login import user_login
from plane.authentication.utils.oidc_email_bind import (
    BIND_PAGE_PATH,
    OIDCEmailBindAdapter,
    get_pending,
    is_smtp_configured,
    issue_code,
    verify_code,
)
from plane.authentication.utils.redirection_path import get_redirection_path
from plane.authentication.utils.user_auth_workflow import post_user_auth_workflow
from plane.bgtasks.magic_link_code_task import magic_link
from plane.utils.path_validator import validate_next_path


class OIDCEmailBindCodeEndpoint(APIView):
    """GET reports whether an OIDC identity is waiting for an email;
    POST mails a verification code to the email the user entered."""

    permission_classes = [AllowAny]
    throttle_classes = [AuthenticationThrottle]

    def get(self, request):
        _, pending = get_pending(request)
        if not pending:
            return Response({"pending": False}, status=status.HTTP_200_OK)
        return Response(
            {
                "pending": True,
                "display_name": pending["user"].get("display_name") or "",
                "is_smtp_configured": is_smtp_configured(),
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        try:
            email, code = issue_code(request, request.data.get("email"))
        except AuthenticationException as e:
            return Response(e.get_error_dict(), status=status.HTTP_400_BAD_REQUEST)
        magic_link.delay(email, "oidc_email_bind", code)
        return Response({"email": email}, status=status.HTTP_200_OK)


class OIDCEmailBindEndpoint(View):
    """Verifies the code, binds the email to the OIDC identity and logs in."""

    @throttle_auth_redirect(is_app=True)
    def post(self, request):
        email = request.POST.get("email", "")
        code = request.POST.get("code", "")
        next_path = request.POST.get("next_path")
        _, pending = get_pending(request)
        # Fall back to the web app when the pending identity is already gone
        host = (pending and pending["host"]) or request.session.get("host") or base_host(request=request, is_app=True)
        is_space = bool(pending and pending["is_space"])

        params = {}
        if next_path:
            params["next_path"] = str(validate_next_path(next_path))

        try:
            pending, email = verify_code(request, email, code)
            adapter = OIDCEmailBindAdapter(
                request=request,
                pending=pending,
                email=email,
                callback=None if is_space else post_user_auth_workflow,
            )
            user = adapter.authenticate()
            user_login(request=request, user=user, is_app=not is_space, is_space=is_space)
            if next_path:
                path = str(validate_next_path(next_path))
            else:
                path = "" if is_space else get_redirection_path(user=user)
            return HttpResponseRedirect(urljoin(host, path))
        except AuthenticationException as e:
            params.update(e.get_error_dict())
            if e.error_code == AUTHENTICATION_ERROR_CODES["OIDC_EMAIL_BIND_INVALID_CODE"]:
                # Wrong code: let the user try again on the bind page
                params["email"] = email
                url = urljoin(host.rstrip("/") + "/", BIND_PAGE_PATH)
            else:
                url = host
            return HttpResponseRedirect(url + "?" + urlencode(params))
