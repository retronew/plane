# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
In-process calls from MCP tools to the public ``/api/v1/`` endpoints.

Every tool goes through the same views, serializers, permissions, read-only
token scope and rate limit as a direct API call made with
the user's own credentials, so the MCP layer never re-implements business rules.
"""

# Python imports
import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

# Django imports
from django.test.client import RequestFactory
from django.urls import Resolver404, resolve

API_PREFIX = "/api/v1/"


@dataclass
class ApiResult:
    status: int
    data: Any

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300


class ApiGateway:
    def __init__(self, request, token: str, *, oauth=False):
        self.oauth = oauth
        self.token = token
        # Sub-requests reuse the outer request's host and client address so host validation,
        # absolute links and throttling behave as for a direct call
        self.environ = {
            "HTTP_X_API_KEY": token,
            "HTTP_HOST": request.get_host(),
            "REMOTE_ADDR": request.META.get("REMOTE_ADDR", ""),
            "wsgi.url_scheme": request.scheme,
        }
        for header in ("HTTP_X_FORWARDED_FOR", "HTTP_X_REAL_IP", "HTTP_USER_AGENT"):
            if header in request.META:
                self.environ[header] = request.META[header]
        self.factory = RequestFactory()

    def call(self, method: str, path: str, query: dict | None = None, body: Any = None) -> ApiResult:
        path = API_PREFIX + path.lstrip("/")
        query = {k: v for k, v in (query or {}).items() if v is not None}
        url = f"{path}?{urlencode(query, doseq=True)}" if query else path
        method = method.upper()
        if method == "GET":
            request = self.factory.get(url, **self.environ)
        else:
            request = self.factory.generic(
                method,
                url,
                data=json.dumps(body if body is not None else {}),
                content_type="application/json",
                **self.environ,
            )

        # Private in-process marker: an HTTP header cannot enable OAuth on the public API.
        request._plane_mcp_oauth = self.oauth
        try:
            match = resolve(path)
        except Resolver404:
            return ApiResult(404, {"error": f"Unknown API path {path}"})

        # Django's URL handler normally sets this; some views (e.g. cache invalidation) read it
        request.resolver_match = match
        response = match.func(request, *match.args, **match.kwargs)
        if hasattr(response, "render"):
            response.render()
        content = getattr(response, "content", b"")
        try:
            data = json.loads(content) if content else None
        except ValueError:
            data = {"error": content.decode("utf-8", "replace")[:500]}
        return ApiResult(response.status_code, data)
