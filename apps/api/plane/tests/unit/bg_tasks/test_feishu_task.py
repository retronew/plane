# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from contextlib import nullcontext
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from plane.bgtasks.feishu_task import send_feishu_delivery
from plane.utils.feishu_client import FeishuError

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    "error,attempts,expected",
    [
        (None, 0, "sent"),
        (FeishuError("transport_error", retryable=True), 0, "retry"),
        (FeishuError("transport_error", retryable=True), 5, "failed"),
        (FeishuError("provider_error_230002"), 0, "failed"),
    ],
)
def test_delivery_outcomes(error, attempts, expected):
    delivery = MagicMock(
        status="pending",
        attempts=attempts,
        first_attempt_at=timezone.now(),
        next_attempt_at=timezone.now() - timedelta(seconds=1),
    )
    with (
        patch("plane.bgtasks.feishu_task.transaction.atomic", return_value=nullcontext()),
        patch("plane.bgtasks.feishu_task.FeishuDelivery.objects") as rows,
        patch("plane.bgtasks.feishu_task.FeishuBinding.objects") as bindings,
        patch("plane.bgtasks.feishu_task.get_feishu_config"),
        patch("plane.bgtasks.feishu_task.delivery_allowed", return_value=True),
        patch("plane.bgtasks.feishu_task.delivery_card", return_value={}),
        patch("plane.bgtasks.feishu_task.FeishuClient") as client,
    ):
        rows.filter.return_value.values_list.return_value.first.return_value = "binding"
        rows.select_for_update.return_value.filter.return_value.first.return_value = delivery
        bindings.select_for_update.return_value.filter.return_value.first.return_value.open_id = "open"
        client.return_value.send.side_effect = error
        send_feishu_delivery.run("delivery")
        assert delivery.status == expected
        assert delivery.attempts == attempts + 1
        client.return_value.send.assert_called_once_with("open", {}, delivery.id)
        if expected == "retry":
            assert delivery.next_attempt_at > timezone.now()


def test_send_rechecks_eligibility_and_cancels_without_http():
    delivery = MagicMock(status="retry", next_attempt_at=timezone.now() - timedelta(seconds=1))
    with (
        patch("plane.bgtasks.feishu_task.transaction.atomic", return_value=nullcontext()),
        patch("plane.bgtasks.feishu_task.FeishuDelivery.objects") as rows,
        patch("plane.bgtasks.feishu_task.FeishuBinding.objects"),
        patch("plane.bgtasks.feishu_task.get_feishu_config"),
        patch("plane.bgtasks.feishu_task.delivery_allowed", return_value=False),
        patch("plane.bgtasks.feishu_task.FeishuClient") as client,
    ):
        rows.filter.return_value.values_list.return_value.first.return_value = "binding"
        rows.select_for_update.return_value.filter.return_value.first.return_value = delivery
        send_feishu_delivery.run("delivery")
        assert delivery.status == "cancelled"
        client.assert_not_called()


@pytest.mark.parametrize("status", ["sent", "failed", "cancelled"])
def test_terminal_deliveries_never_resend(status):
    delivery = MagicMock(status=status)
    with (
        patch("plane.bgtasks.feishu_task.transaction.atomic", return_value=nullcontext()),
        patch("plane.bgtasks.feishu_task.FeishuDelivery.objects") as rows,
        patch("plane.bgtasks.feishu_task.FeishuBinding.objects"),
        patch("plane.bgtasks.feishu_task.FeishuClient") as client,
    ):
        rows.filter.return_value.values_list.return_value.first.return_value = "binding"
        rows.select_for_update.return_value.filter.return_value.first.return_value = delivery
        send_feishu_delivery.run("delivery")
        client.assert_not_called()
