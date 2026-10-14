# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.license.models import InstanceAdmin
from plane.license.utils.instance_value import get_configuration_value


def is_password_login_enabled():
    (ENABLE_EMAIL_PASSWORD,) = get_configuration_value(
        [{"key": "ENABLE_EMAIL_PASSWORD", "default": os.environ.get("ENABLE_EMAIL_PASSWORD", "1")}]
    )
    return ENABLE_EMAIL_PASSWORD != "0"


def can_manage_password(user):
    """Whether `user` may set, change or reset a password.

    With password login disabled a password is useless for signing in to the
    app, so members cannot create one. Instance admins are the exception: God
    mode still signs in with a password and this is their only way to change it.
    """
    if is_password_login_enabled():
        return True
    return bool(user) and InstanceAdmin.objects.filter(user=user).exists()


def password_management_disabled():
    return AuthenticationException(
        error_code=AUTHENTICATION_ERROR_CODES["PASSWORD_LOGIN_DISABLED"],
        error_message="PASSWORD_LOGIN_DISABLED",
    )
