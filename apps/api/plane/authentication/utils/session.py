# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.core.cache import cache

# Module imports
from plane.license.utils.instance_value import get_configuration_value

SESSION_CONFIG_CACHE_KEY = "instance_session_config"
SESSION_CONFIG_CACHE_TTL = 60


def _to_positive_int(value, default):
    try:
        value = int(value)
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def get_session_config():
    """Return (user_session_age, admin_session_age, save_every_request).

    Values come from the instance configuration (editable in god mode) and fall
    back to the environment based settings. Cached briefly since the session
    middleware reads it on every request.
    """
    config = cache.get(SESSION_CONFIG_CACHE_KEY)
    if config is not None:
        return config

    user_age, admin_age, save_every_request = get_configuration_value(
        [
            {"key": "SESSION_COOKIE_AGE", "default": settings.SESSION_COOKIE_AGE},
            {"key": "ADMIN_SESSION_COOKIE_AGE", "default": settings.ADMIN_SESSION_COOKIE_AGE},
            {
                "key": "SESSION_SAVE_EVERY_REQUEST",
                "default": "1" if settings.SESSION_SAVE_EVERY_REQUEST else "0",
            },
        ]
    )
    config = (
        _to_positive_int(user_age, settings.SESSION_COOKIE_AGE),
        _to_positive_int(admin_age, settings.ADMIN_SESSION_COOKIE_AGE),
        str(save_every_request) == "1",
    )
    cache.set(SESSION_CONFIG_CACHE_KEY, config, SESSION_CONFIG_CACHE_TTL)
    return config


def clear_session_config_cache():
    cache.delete(SESSION_CONFIG_CACHE_KEY)
