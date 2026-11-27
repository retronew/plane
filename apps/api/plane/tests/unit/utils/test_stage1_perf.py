# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import MagicMock, patch

import pytest

from plane.settings.storage import S3Storage, _S3_CLIENT_CACHE, _get_cached_s3_client
from plane.utils.paginator import Cursor, GroupedOffsetPaginator

pytestmark = pytest.mark.unit


class TestS3StorageCaching:
    def setup_method(self):
        _S3_CLIENT_CACHE.clear()

    def teardown_method(self):
        _S3_CLIENT_CACHE.clear()

    @patch("plane.settings.storage.boto3.client")
    def test_get_cached_s3_client_reuses_client_for_same_config(self, mock_boto_client):
        mock_boto_client.return_value = MagicMock()

        c1 = _get_cached_s3_client("https://s3.example.com", "us-east-1", "ak", "sk")
        c2 = _get_cached_s3_client("https://s3.example.com", "us-east-1", "ak", "sk")
        c3 = _get_cached_s3_client("https://other.example.com", "us-east-1", "ak", "sk")

        assert c1 is c2
        assert c1 is not c3
        assert mock_boto_client.call_count == 2

    @patch("plane.settings.storage.boto3.client")
    def test_generate_presigned_url_passes_response_cache_control(self, mock_boto_client):
        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = "https://signed.example.com/obj"
        mock_boto_client.return_value = mock_client

        storage = S3Storage()
        url = storage.generate_presigned_url(
            object_name="avatars/u1.png",
            disposition="inline",
            filename="u1.png",
            response_cache_control="public, max-age=31536000, immutable",
        )

        assert url == "https://signed.example.com/obj"
        _, kwargs = mock_client.generate_presigned_url.call_args
        assert kwargs["Params"]["ResponseCacheControl"] == "public, max-age=31536000, immutable"
        assert "u1.png" in kwargs["Params"]["ResponseContentDisposition"]


class TestGroupedOffsetPaginatorOptimization:
    def test_preserves_total_count_queryset_and_avoids_redundant_exists_when_count_filter_none(self):
        base_qs = MagicMock()
        window_qs = MagicMock()
        page_qs = MagicMock()
        total_qs = MagicMock()

        base_qs.annotate.return_value = window_qs
        window_qs.filter.return_value.order_by.return_value = page_qs
        total_qs.count.return_value = 5
        total_qs.values.return_value.annotate.return_value.order_by.return_value = [
            {"state_id": "s1", "count": 3},
            {"state_id": "s2", "count": 2},
        ]

        paginator = GroupedOffsetPaginator(
            queryset=base_qs,
            group_by_field_name="state_id",
            group_by_fields=["s1", "s2"],
            count_filter=None,
            total_count_queryset=total_qs,
            order_by="sort_order",
        )
        paginator.bound_window = lambda r: r

        res = paginator.get_result(limit=2, cursor=Cursor(2, 0, 0))

        assert paginator.total_count_queryset is total_qs
        total_qs.count.assert_called_once()
        base_qs.count.assert_not_called()
        # stop = 0 + 2 + 1 = 3; max group count = 3 >= stop -> has_next is True
        # without calling window_qs.filter(...).exists()
        assert res.next.has_results is True
        assert res.hits == 5
        assert res.max_hits == 2
        # window_qs.filter should only have been called once (for the page slice), never for row_number__gte=stop
        assert window_qs.filter.call_count == 1
