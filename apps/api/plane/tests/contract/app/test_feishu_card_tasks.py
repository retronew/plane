from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from plane.bgtasks.feishu_card_task import (
    dispatch_feishu_card_actions,
    execute_feishu_card_action,
    refresh_feishu_card,
)
from plane.db.models.feishu import FeishuBinding, FeishuCardAction, FeishuDelivery
from plane.utils.feishu_client import FeishuConfig, FeishuError

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def action(create_user):
    binding = FeishuBinding.objects.create(user=create_user, app_id="app", tenant_key="tenant", open_id="open")
    delivery = FeishuDelivery.objects.create(
        user=create_user,
        binding=binding,
        event_key="card-task",
        kind="test",
        title="Test",
        status="sent",
        message_id="om_test",
    )
    return FeishuCardAction.objects.create(
        delivery=delivery,
        binding=binding,
        key="state",
        operation="state",
        status="queued",
        expires_at=timezone.now() + timedelta(hours=1),
        claimed_at=timezone.now() - timedelta(seconds=10),
    )


def test_dispatch_waits_for_callback_response(action):
    action.claimed_at = timezone.now()
    action.save()
    with patch("plane.bgtasks.feishu_card_task.execute_feishu_card_action.delay") as dispatch:
        dispatch_feishu_card_actions.run()
    dispatch.assert_not_called()


def test_dispatch_recovers_abandoned_processing(action):
    action.status = "processing"
    action.claimed_at = timezone.now() - timedelta(minutes=6)
    action.save()
    with patch("plane.bgtasks.feishu_card_task.execute_feishu_card_action.delay") as dispatch:
        dispatch_feishu_card_actions.run()
    dispatch.assert_called_once_with(str(action.pk))


def test_terminal_action_is_never_executed_again(action):
    action.status = "succeeded"
    action.save()
    with patch("plane.services.feishu_actions.execute_card_action") as execute:
        execute_feishu_card_action.run(str(action.pk))
    execute.assert_not_called()


def test_rejected_action_is_recorded_without_raw_exception(action):
    with (
        patch("plane.services.feishu_actions.execute_card_action", side_effect=ValidationError("sensitive data")),
        patch("plane.bgtasks.feishu_card_task.refresh_feishu_card.delay") as refresh,
    ):
        execute_feishu_card_action.run(str(action.pk))
    action.refresh_from_db()
    assert action.status == "failed"
    assert action.result == {"code": "action_rejected"}
    assert action.completed_at
    refresh.assert_called_once_with(str(action.pk))


def test_exception_after_business_commit_cannot_overwrite_success(action):
    def commit_then_error(row):
        FeishuCardAction.objects.filter(pk=row.pk).update(status="succeeded", result={"code": "done"})
        raise RuntimeError("after commit")

    with (
        patch("plane.services.feishu_actions.execute_card_action", side_effect=commit_then_error),
        patch("plane.bgtasks.feishu_card_task.refresh_feishu_card.delay"),
    ):
        execute_feishu_card_action.run(str(action.pk))
    action.refresh_from_db()
    assert action.status == "succeeded"
    assert action.result == {"code": "done"}


@pytest.mark.parametrize("retryable,attempts", [(True, 1), (False, 6)])
def test_card_update_retries_without_repeating_business_action(action, retryable, attempts):
    action.status = "succeeded"
    action.save()
    with (
        patch("plane.bgtasks.feishu_card_task.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
        patch("plane.bgtasks.feishu_card_task.result_card", return_value={"elements": []}),
        patch("plane.bgtasks.feishu_card_task.FeishuClient") as client,
    ):
        client.return_value.update_card.side_effect = FeishuError("transport_error", retryable=retryable)
        refresh_feishu_card.run(str(action.pk))
    action.refresh_from_db()
    assert action.status == "succeeded"
    assert action.card_update_attempts == attempts
    assert action.card_updated_at is None
    assert action.next_card_update_at > timezone.now()


def test_successful_card_update_is_not_repeated(action):
    action.status = "succeeded"
    action.save()
    with (
        patch("plane.bgtasks.feishu_card_task.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
        patch("plane.bgtasks.feishu_card_task.result_card", return_value={"elements": []}),
        patch("plane.bgtasks.feishu_card_task.FeishuClient") as client,
    ):
        refresh_feishu_card.run(str(action.pk))
        refresh_feishu_card.run(str(action.pk))
    client.return_value.update_card.assert_called_once_with("om_test", {"elements": []})
    action.refresh_from_db()
    assert action.card_updated_at


def test_result_card_does_not_read_entity_details_without_membership(action):
    from plane.bgtasks.feishu_card_task import result_card

    with patch("plane.bgtasks.feishu_card_task.delivery_card") as render:
        card = result_card(action, action.delivery)
    render.assert_not_called()
    assert "Test" not in str(card)
    assert "Plane" in str(card)


def test_unbound_action_cannot_update_existing_message(action):
    action.status = "succeeded"
    action.save()
    action.binding.delete()
    with patch("plane.bgtasks.feishu_card_task.FeishuClient") as client:
        refresh_feishu_card.run(str(action.pk))
    client.assert_not_called()
