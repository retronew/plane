# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from plane.utils.password import is_password_strong


@pytest.mark.unit
class TestIsPasswordStrong:
    """Test the is_password_strong function"""

    def test_accepts_password_meeting_all_criteria(self):
        assert is_password_strong("Abcd1234!") is True
        assert is_password_strong("Password@123") is True

    def test_rejects_empty_or_short_password(self):
        assert is_password_strong("") is False
        assert is_password_strong(None) is False
        assert is_password_strong("Ab1!xyz") is False

    def test_rejects_password_missing_a_character_class(self):
        assert is_password_strong("abcd1234!") is False  # no upper-case
        assert is_password_strong("ABCD1234!") is False  # no lower-case
        assert is_password_strong("Abcdefgh!") is False  # no digit
        assert is_password_strong("Abcd12345") is False  # no special character
