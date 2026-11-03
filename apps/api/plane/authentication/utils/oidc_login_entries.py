# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

"""Validated server-owned routing hints for one OIDC issuer/client."""

import json
import os
import re
from urllib.parse import urlsplit

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES, AuthenticationException
from plane.license.utils.instance_value import get_configuration_value


def parse_login_entries(value):
    if not isinstance(value, str) or len(value) > 131072:
        raise ValueError("OIDC_LOGIN_ENTRIES must be a JSON string array.")
    try:
        entries = json.loads(value)
    except (ValueError, TypeError):
        raise ValueError("OIDC_LOGIN_ENTRIES must be a JSON string array.") from None
    if not isinstance(entries, list) or len(entries) > 32:
        raise ValueError("OIDC_LOGIN_ENTRIES must be an array with at most 32 entries.")
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) - {"id", "name", "provider_hint", "icon_url", "enabled"}:
            raise ValueError("Invalid OIDC login entry fields.")
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", entry_id):
            raise ValueError("Entry id must contain 1–64 ASCII letters, digits, underscores or hyphens.")
        if entry_id in seen:
            raise ValueError("OIDC login entry ids must be unique.")
        seen.add(entry_id)
        name = entry.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > 100 or any(ord(c) < 32 for c in name):
            raise ValueError("Entry name must contain 1–100 printable characters.")
        hint = entry.get("provider_hint")
        if (
            not isinstance(hint, str)
            or not 1 <= len(hint) <= 256
            or hint != hint.strip()
            or any(ord(c) < 32 or ord(c) == 127 for c in hint)
        ):
            raise ValueError("Invalid OIDC provider hint.")
        if type(entry.get("enabled")) is not bool:
            raise ValueError("Entry enabled must be a boolean.")
        icon = entry.get("icon_url", "")
        if not isinstance(icon, str) or len(icon) > 2048:
            raise ValueError("Invalid entry icon URL.")
        if icon:
            try:
                parsed = urlsplit(icon)
                valid = (
                    parsed.scheme in {"http", "https"}
                    and parsed.hostname
                    and not parsed.username
                    and not parsed.password
                    and not parsed.fragment
                    and parsed.port != 0
                )
            except ValueError:
                valid = False
            if not valid or any(c.isspace() or ord(c) < 32 for c in icon) or "\\" in icon:
                raise ValueError("Entry icon must be an absolute HTTP(S) URL without credentials or fragments.")
    return entries


def get_login_entries():
    (value,) = get_configuration_value(
        [{"key": "OIDC_LOGIN_ENTRIES", "default": os.environ.get("OIDC_LOGIN_ENTRIES", "[]")}]
    )
    return parse_login_entries(value)


def public_login_entries():
    # Include disabled entries so an all-disabled configuration cannot enable the legacy button.
    try:
        entries = get_login_entries()
    except ValueError:
        return [{"id": "invalid", "name": "OIDC", "enabled": False}]
    return [{key: entry[key] for key in ("id", "name", "icon_url", "enabled") if key in entry} for entry in entries]


def resolve_provider_hint(entry_id):
    try:
        entries = get_login_entries()
    except ValueError:
        entries = None
    if entries is not None:
        if entry_id is None and not entries:
            return None
        for entry in entries:
            if entry["id"] == entry_id and entry["enabled"]:
                return entry["provider_hint"]
    raise AuthenticationException(
        error_code=AUTHENTICATION_ERROR_CODES["OIDC_LOGIN_ENTRY_INVALID"],
        error_message="OIDC_LOGIN_ENTRY_INVALID",
    )
