# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
JSON-RPC method handling for the MCP endpoint.

Serves both protocol eras on one stateless endpoint:
- modern (2026-07-28): every request carries its version in ``_meta``; ``server/discover``;
- legacy (2025-11-25 and earlier): an ``initialize`` handshake, but no session is minted,
  so follow-up requests are served exactly like modern ones.
"""

# Python imports
import logging

# Module imports
from plane.mcp.formatting import to_text
from plane.mcp.instructions import SERVER_INSTRUCTIONS
from plane.mcp.tools.base import ToolError
from plane.mcp.tools.resources import TOOLS, TOOLS_BY_NAME

logger = logging.getLogger("plane.mcp")

MODERN_VERSIONS = ["2026-07-28"]
LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"]
SUPPORTED_VERSIONS = MODERN_VERSIONS + LEGACY_VERSIONS

META_VERSION = "io.modelcontextprotocol/protocolVersion"
META_SERVER_INFO = "io.modelcontextprotocol/serverInfo"

SERVER_INFO = {"name": "plane", "title": "Plane", "version": "1.0.0"}
CAPABILITIES = {"tools": {"listChanged": False}}
LIST_TTL_MS = 5 * 60 * 1000

# JSON-RPC / MCP error codes
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603
HEADER_MISMATCH = -32020
UNSUPPORTED_PROTOCOL_VERSION = -32022


class RpcError(Exception):
    def __init__(self, code, message, data=None, http_status=200):
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data
        self.http_status = http_status

    def body(self, request_id):
        error = {"code": self.code, "message": self.message}
        if self.data is not None:
            error["data"] = self.data
        return {"jsonrpc": "2.0", "id": request_id, "error": error}


def unsupported_version(requested):
    return RpcError(
        UNSUPPORTED_PROTOCOL_VERSION,
        "Unsupported protocol version",
        {"supported": SUPPORTED_VERSIONS, "requested": requested},
        http_status=400,
    )


def complete(result: dict) -> dict:
    """Mark a result as complete and identify the server, per the 2026-07-28 result shape."""
    result = {"resultType": "complete", **result}
    result.setdefault("_meta", {})[META_SERVER_INFO] = SERVER_INFO
    return result


def handle(method: str, params: dict, ctx_factory) -> dict:
    """Run one JSON-RPC request and return its ``result`` (raises RpcError)."""
    if method == "initialize":
        requested = params.get("protocolVersion")
        version = requested if requested in LEGACY_VERSIONS else LEGACY_VERSIONS[0]
        return {
            "protocolVersion": version,
            "capabilities": CAPABILITIES,
            "serverInfo": SERVER_INFO,
            "instructions": SERVER_INSTRUCTIONS,
        }

    if method == "server/discover":
        return complete(
            {
                "supportedVersions": SUPPORTED_VERSIONS,
                "capabilities": CAPABILITIES,
                "instructions": SERVER_INSTRUCTIONS,
                "ttlMs": LIST_TTL_MS,
                "cacheScope": "public",
            }
        )

    if method == "ping":
        return {}

    if method == "tools/list":
        # A single, deterministic page: the tool set is small and fixed
        return complete({"tools": [tool.definition() for tool in TOOLS], "ttlMs": LIST_TTL_MS, "cacheScope": "public"})

    if method == "tools/call":
        name = params.get("name")
        tool = TOOLS_BY_NAME.get(name)
        if tool is None:
            raise RpcError(INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments") or {}
        if not isinstance(arguments, dict):
            raise RpcError(INVALID_PARAMS, "`arguments` must be an object")
        try:
            output = tool.run(ctx_factory(arguments), arguments)
        except ToolError as error:
            return complete({"content": [{"type": "text", "text": str(error)}], "isError": True})
        except Exception:
            logger.exception("MCP tool %s failed", name)
            return complete({"content": [{"type": "text", "text": "服务器内部错误，请稍后重试。"}], "isError": True})
        return complete({"content": [{"type": "text", "text": to_text(output)}], "isError": False})

    raise RpcError(METHOD_NOT_FOUND, f"Method not found: {method}", http_status=404)
