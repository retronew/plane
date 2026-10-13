# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for the instance-configurable session lifetime."""

from unittest.mock import patch

import pytest

from plane.authentication.utils.session import (
    clear_session_config_cache,
    get_session_config,
)
from plane.license.models import InstanceConfiguration


@pytest.fixture(autouse=True)
def _session_settings(settings):
    settings.SKIP_ENV_VAR = True
    settings.SESSION_COOKIE_AGE = 100
    settings.ADMIN_SESSION_COOKIE_AGE = 10
    settings.SESSION_SAVE_EVERY_REQUEST = False
    clear_session_config_cache()
    yield
    clear_session_config_cache()


def _set(key, value):
    InstanceConfiguration.objects.update_or_create(key=key, defaults={"value": value, "category": "SESSION"})


@pytest.mark.unit
class TestGetSessionConfig:
    @pytest.mark.django_db
    def test_falls_back_to_settings_when_not_configured(self):
        InstanceConfiguration.objects.filter(category="SESSION").delete()
        assert get_session_config() == (100, 10, False)

    @pytest.mark.django_db
    def test_reads_instance_configuration(self):
        _set("SESSION_COOKIE_AGE", "2592000")
        _set("ADMIN_SESSION_COOKIE_AGE", "28800")
        _set("SESSION_SAVE_EVERY_REQUEST", "1")
        assert get_session_config() == (2592000, 28800, True)

    @pytest.mark.django_db
    def test_invalid_values_fall_back_to_settings(self):
        _set("SESSION_COOKIE_AGE", "abc")
        _set("ADMIN_SESSION_COOKIE_AGE", "-5")
        _set("SESSION_SAVE_EVERY_REQUEST", "0")
        assert get_session_config() == (100, 10, False)

    @pytest.mark.django_db
    def test_result_is_cached_until_cleared(self):
        _set("SESSION_COOKIE_AGE", "500")
        assert get_session_config()[0] == 500
        _set("SESSION_COOKIE_AGE", "600")
        with patch("plane.authentication.utils.session.get_configuration_value") as mocked:
            assert get_session_config()[0] == 500
            mocked.assert_not_called()
        clear_session_config_cache()
        assert get_session_config()[0] == 600
