# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for cache invalidation ordering and non-blocking pattern deletion."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.response import Response

from plane.utils.cache import invalidate_cache, invalidate_cache_directly


@pytest.mark.unit
def test_invalidate_cache_directly_prefers_delete_pattern_over_keys():
    fake_cache = MagicMock()
    fake_cache.delete_pattern = MagicMock()
    fake_cache.keys = MagicMock(side_effect=AssertionError("blocking KEYS must not be called"))

    with patch("plane.utils.cache.cache", fake_cache):
        invalidate_cache_directly(path="/api/workspaces/demo/states/", user=False, multiple=True)

    fake_cache.delete_pattern.assert_called_once_with("*/api/workspaces/demo/states/*")


@pytest.mark.unit
def test_invalidate_cache_runs_after_successful_view_and_skips_errors():
    events = []

    class DummyView:
        @invalidate_cache(path="/api/workspaces/demo/states/", user=False, multiple=True)
        def ok_view(self, request):
            events.append("view")
            return Response({"ok": True}, status=200)

        @invalidate_cache(path="/api/workspaces/demo/states/", user=False, multiple=True)
        def bad_view(self, request):
            events.append("bad_view")
            return Response({"error": "invalid"}, status=400)

    request = SimpleNamespace(user=SimpleNamespace(is_anonymous=True), get_full_path=lambda: "/x")

    with (
        patch("plane.utils.cache.transaction.on_commit", side_effect=lambda fn: fn()),
        patch("plane.utils.cache.invalidate_cache_directly", side_effect=lambda **kw: events.append("invalidate")),
    ):
        DummyView().ok_view(request)
        assert events == ["view", "invalidate"]

        events.clear()
        DummyView().bad_view(request)
        assert events == ["bad_view"]
