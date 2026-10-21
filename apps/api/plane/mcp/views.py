# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The ``/mcp/`` Streamable HTTP endpoint (stateless, JSON responses)."""

# Python imports
import base64
import binascii
import json
from urllib.parse import urlparse

# Django imports
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

# Third party imports
from crum import impersonate
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

# Module imports
from plane.api.middleware.api_authentication import APIKeyAuthentication
from plane.db.models import APIToken, WorkspaceMember
from plane.mcp.gateway import ApiGateway
from plane.mcp.protocol import (
    INVALID_REQUEST,
    HEADER_MISMATCH,
    LEGACY_VERSIONS,
    META_VERSION,
    MODERN_VERSIONS,
    PARSE_ERROR,
    RpcError,
    handle,
    unsupported_version,
)
from plane.mcp.tools.base import Context, ToolError

NAMED_METHODS = {"tools/call": "name", "prompts/get": "name", "resources/read": "uri"}
UNAUTHORIZED = -32001


def decode_header_value(value: str) -> str:
    """Undo the ``=?base64?...?=`` sentinel encoding used for non-ASCII header values."""
    if value.startswith("=?base64?") and value.endswith("?="):
        try:
            return base64.b64decode(value[len("=?base64?") : -2]).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError):
            raise RpcError(HEADER_MISMATCH, "Malformed base64 header value", http_status=400)
    return value


def rpc_response(body, status=200):
    return JsonResponse(body, status=status, json_dumps_params={"ensure_ascii": False})


@method_decorator(csrf_exempt, name="dispatch")
class MCPEndpoint(View):
    http_method_names = ["post", "get", "delete", "options"]

    def get(self, request):
        # No standalone SSE stream and no sessions in this revision
        response = HttpResponse(status=405)
        response["Allow"] = "POST"
        return response

    delete = get

    def post(self, request):
        if not self.origin_allowed(request):
            return rpc_response(RpcError(INVALID_REQUEST, "Origin not allowed").body(None), status=403)

        try:
            message = json.loads(request.body or b"")
        except ValueError:
            return rpc_response(RpcError(PARSE_ERROR, "Parse error").body(None), status=400)
        if (
            not isinstance(message, dict)
            or message.get("jsonrpc") != "2.0"
            or not isinstance(message.get("method"), str)
        ):
            return rpc_response(RpcError(INVALID_REQUEST, "Expected a single JSON-RPC request").body(None), status=400)

        request_id = message.get("id")
        method = message["method"]
        params = message.get("params") or {}
        if not isinstance(params, dict):
            return rpc_response(RpcError(INVALID_REQUEST, "`params` must be an object").body(request_id), status=400)

        # Notifications (e.g. legacy notifications/initialized) need no reply
        if "id" not in message:
            return HttpResponse(status=202)

        try:
            self.validate_protocol(request, method, params)
            user, token = self.authenticate(request)
        except RpcError as error:
            response = rpc_response(error.body(request_id), status=error.http_status)
            if error.http_status == 401:
                response["WWW-Authenticate"] = 'Bearer realm="plane"'
            return response

        def ctx_factory(arguments):
            listing = params.get("name") == "workspace" and arguments.get("action") == "list"
            slug = self.workspace_slug(request, user, arguments, required=not listing)
            scope = APIToken.objects.values_list("workspace__slug", flat=True).get(token=token)
            if scope and slug and slug != scope:
                raise ToolError("This API token is restricted to its workspace")
            return Context(
                request=request,
                user=user,
                slug=slug,
                gateway=ApiGateway(request, token),
                workspace_scope=scope,
            )

        try:
            with impersonate(user):
                result = handle(method, params, ctx_factory)
        except RpcError as error:
            return rpc_response(error.body(request_id), status=error.http_status)
        return rpc_response({"jsonrpc": "2.0", "id": request_id, "result": result})

    # -- validation ---------------------------------------------------------------

    def origin_allowed(self, request) -> bool:
        origin = request.headers.get("Origin")
        if not origin:
            return True
        host = urlparse(origin).netloc
        allowed = {request.get_host()}
        for url in [getattr(settings, "WEB_URL", None), *getattr(settings, "CORS_ALLOWED_ORIGINS", [])]:
            if url:
                allowed.add(urlparse(url).netloc)
        return host in allowed

    def validate_protocol(self, request, method, params):
        if method == "initialize":
            return
        meta = params.get("_meta") or {}
        meta_version = meta.get(META_VERSION) if isinstance(meta, dict) else None
        header_version = request.headers.get("MCP-Protocol-Version")

        if meta_version is None:
            # Legacy follow-up request after an initialize handshake (no session to check);
            # clients older than 2025-06-18 send no version header at all
            if header_version is None or header_version in LEGACY_VERSIONS:
                return
            if header_version in MODERN_VERSIONS:
                raise RpcError(
                    INVALID_REQUEST, f"Missing _meta.{META_VERSION} for protocol {header_version}", http_status=400
                )
            raise unsupported_version(header_version)

        if header_version != meta_version:
            raise RpcError(
                HEADER_MISMATCH,
                f"Header mismatch: MCP-Protocol-Version header {header_version!r} does not match body {meta_version!r}",
                http_status=400,
            )
        if meta_version not in MODERN_VERSIONS:
            raise unsupported_version(meta_version)

        header_method = request.headers.get("Mcp-Method")
        if header_method != method:
            raise RpcError(
                HEADER_MISMATCH,
                f"Header mismatch: Mcp-Method header {header_method!r} does not match body {method!r}",
                http_status=400,
            )
        if method in NAMED_METHODS:
            body_name = params.get(NAMED_METHODS[method])
            header_name = request.headers.get("Mcp-Name")
            if header_name is None or decode_header_value(header_name) != body_name:
                raise RpcError(
                    HEADER_MISMATCH,
                    f"Header mismatch: Mcp-Name header does not match body value {body_name!r}",
                    http_status=400,
                )

    def authenticate(self, request):
        authorization = request.headers.get("Authorization", "")
        token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else None
        token = token or request.headers.get("X-Api-Key")
        if not token:
            raise RpcError(UNAUTHORIZED, "Missing API key: send `Authorization: Bearer <key>`", http_status=401)
        try:
            # Scope (read-only keys) is enforced on each underlying API call by its HTTP method
            scope = APIToken.objects.filter(token=token).values_list("workspace__slug", flat=True).first()
            user, _ = APIKeyAuthentication().validate_api_token(token, workspace_slug=scope)
        except AuthenticationFailed:
            raise RpcError(UNAUTHORIZED, "Invalid or expired API key", http_status=401)
        except PermissionDenied as error:
            raise RpcError(UNAUTHORIZED, str(error.detail), http_status=403)
        return user, token

    def workspace_slug(self, request, user, arguments, *, required=True) -> str | None:
        slug = arguments.get("workspace_slug")
        if not required and "workspace_slug" not in arguments:
            return None
        if not isinstance(slug, str) or not slug.strip():
            raise ToolError(
                "缺少有效的 workspace_slug：每次操作必须显式指定工作区，可用 workspace(action='list') 查看。"
            )
        if not WorkspaceMember.objects.filter(
            member=user, is_active=True, workspace__slug=slug, workspace__deleted_at__isnull=True
        ).exists():
            raise ToolError(f"你不是工作区 {slug} 的活跃成员，或该工作区不存在。")
        return slug
