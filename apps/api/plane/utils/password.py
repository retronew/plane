# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re

# Keep in sync with getPasswordStrength in packages/utils/src/auth.ts
PASSWORD_MIN_LENGTH = 8
SPECIAL_CHARACTERS_REGEX = re.compile(r"""[!@#$%^&*()\-_+=\[\]{}|;:'",.<>?/]""")


def is_password_strong(password: str) -> bool:
    """Return True when the password meets the same criteria enforced by the frontend."""
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        return False
    return bool(
        re.search(r"[A-Z]", password)
        and re.search(r"[a-z]", password)
        and re.search(r"[0-9]", password)
        and SPECIAL_CHARACTERS_REGEX.search(password)
    )
