# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import MagicMock, patch

import pytest

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES
from plane.authentication.utils import password_management as pm


def _password_login(value):
    return patch.object(pm, "get_configuration_value", return_value=(value,))


def _instance_admin(is_admin):
    queryset = MagicMock()
    queryset.exists.return_value = is_admin
    return patch.object(pm.InstanceAdmin.objects, "filter", return_value=queryset)


@pytest.mark.unit
class TestPasswordManagement:
    @pytest.mark.parametrize("value", ["1", None, ""])
    def test_enabled_unless_explicitly_disabled(self, value):
        with _password_login(value):
            assert pm.is_password_login_enabled() is True

    def test_members_can_manage_password_when_login_enabled(self):
        with _password_login("1"), _instance_admin(False):
            assert pm.can_manage_password(MagicMock()) is True

    def test_members_cannot_manage_password_when_login_disabled(self):
        with _password_login("0"), _instance_admin(False):
            assert pm.can_manage_password(MagicMock()) is False

    def test_instance_admins_keep_password_when_login_disabled(self):
        # God mode signs in with a password, so admins must still be able to change it
        with _password_login("0"), _instance_admin(True):
            assert pm.can_manage_password(MagicMock()) is True

    def test_no_user_cannot_manage_password_when_login_disabled(self):
        with _password_login("0"):
            assert pm.can_manage_password(None) is False

    def test_disabled_error_code(self):
        assert pm.password_management_disabled().error_code == AUTHENTICATION_ERROR_CODES["PASSWORD_LOGIN_DISABLED"]
