# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os
from pathlib import Path

import pytz


def detect_server_timezone():
    """Resolve an IANA timezone before Django replaces the process TZ with UTC."""
    candidates = [os.environ.get("TZ", "")]
    try:
        candidates.append(Path("/etc/timezone").read_text().strip())
    except (OSError, UnicodeError):
        pass
    try:
        candidates.append(str(Path("/etc/localtime").resolve()))
    except (OSError, RuntimeError):
        pass

    for candidate in candidates:
        candidate = candidate.removeprefix(":")
        if "/zoneinfo/" in candidate:
            candidate = candidate.split("/zoneinfo/", 1)[1]
        if candidate in pytz.common_timezones_set:
            return candidate
    return "UTC"


def get_default_timezone():
    from django.conf import settings

    return settings.DEFAULT_TIMEZONE
