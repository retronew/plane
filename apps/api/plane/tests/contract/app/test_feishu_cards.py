# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

import pytest
from django.db import close_old_connections
from django.utils import timezone
from rest_framework.test import APIClient

from plane.db.models import User
from plane.db.models.feishu import FeishuBinding, FeishuCardAction, FeishuDelivery
from plane.tests.unit.utils.test_feishu_card_security import CONFIG, NOW, encrypt_body, event_body, signed_headers
from plane.utils.feishu_card_security import action_token
from plane.utils.feishu_client import FeishuConfig

pytestmark = [pytest.mark.contract, pytest.mark.django_db]
URL = "/api/integrations/feishu/cards/"


@pytest.fixture(autouse=True)
def config():
    with (
        patch(
            "plane.app.views.feishu_cards.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")
        ) as mock,
        patch("plane.app.views.feishu_cards.get_feishu_callback_config", return_value=CONFIG),
        patch("plane.utils.feishu_card_security.time.time", return_value=NOW),
    ):
        yield mock


@pytest.fixture
def card_action(create_user):
    binding = FeishuBinding.objects.create(user=create_user, app_id="app", tenant_key="tenant", open_id="open")
    delivery = FeishuDelivery.objects.create(
        user=create_user,
        binding=binding,
        event_key="approval:one",
        kind="approval_requested",
        title="Approval",
        status="sent",
        message_id="message",
        sent_at=timezone.now(),
    )
    return FeishuCardAction.objects.create(
        delivery=delivery,
        binding=binding,
        key="approve",
        operation="approve",
        payload={"approval_id": "server-only-reference"},
        expires_at=timezone.now() + timedelta(hours=1),
    )


def callback_body(action):
    body = event_body()
    body["event"]["action"]["value"] = {"token": action_token(action)}
    return body


def post(body, client=None, *, encrypted=True):
    raw = encrypt_body(body) if encrypted else json.dumps(body).encode()
    headers = {"HTTP_" + key.upper().replace("-", "_"): value for key, value in signed_headers(raw).items()}
    return (client or APIClient()).post(URL, data=raw, content_type="application/json", **headers)


@pytest.mark.parametrize("encrypted", [False, True])
def test_signed_callback_without_verification_token_queues(card_action, encrypted):
    body = callback_body(card_action)
    del body["header"]["token"]
    assert post(body, encrypted=encrypted).status_code == 200
    card_action.refresh_from_db()
    assert card_action.status == "queued"


@pytest.mark.parametrize("encrypted", [False, True])
def test_wrong_callback_token_is_rejected_without_logging_secrets(card_action, encrypted, caplog):
    body = callback_body(card_action)
    body["header"]["token"] = "private-invalid-token"
    response = post(body, encrypted=encrypted)
    assert response.status_code == 403
    assert response.json() == {"error": "invalid_feishu_callback"}
    assert "verification_token_mismatch" in caplog.text
    assert "private-invalid-token" not in caplog.text
    assert action_token(card_action) not in caplog.text
    card_action.refresh_from_db()
    assert card_action.status == "pending"


def test_anonymous_callback_only_queues_without_broker_or_http(card_action):
    with patch("requests.request") as http, patch("celery.app.task.Task.apply_async") as broker:
        response = post(callback_body(card_action), APIClient(enforce_csrf_checks=True))
    assert response.status_code == 200
    assert response.json()["toast"]["type"] == "info"
    assert "已受理" in response.json()["toast"]["content"]
    http.assert_not_called()
    broker.assert_not_called()
    card_action.refresh_from_db()
    assert card_action.status == "queued"
    assert card_action.claimed_at is not None
    assert card_action.completed_at is None
    assert card_action.card_updated_at is None
    assert card_action.payload == {"approval_id": "server-only-reference"}


@pytest.mark.parametrize(
    "status,toast_type",
    [
        ("queued", "info"),
        ("processing", "info"),
        ("succeeded", "success"),
        ("failed", "error"),
    ],
)
def test_duplicate_returns_safe_status_without_requeue(card_action, status, toast_type):
    accepted_at = timezone.now() - timedelta(minutes=1)
    card_action.status = status
    card_action.claimed_at = accepted_at
    card_action.result = {"secret": "private provider message"}
    card_action.save()
    response = post(callback_body(card_action))
    assert response.status_code == 200
    assert response.json()["toast"]["type"] == toast_type
    assert b"private" not in response.content
    card_action.refresh_from_db()
    assert card_action.status == status
    assert card_action.claimed_at == accepted_at


def test_other_pending_choice_never_executes_after_one_is_accepted(card_action):
    other = FeishuCardAction.objects.create(
        delivery=card_action.delivery,
        binding=card_action.binding,
        key="reject",
        operation="reject",
        expires_at=card_action.expires_at,
    )
    assert post(callback_body(card_action)).json()["toast"]["type"] == "info"
    assert post(callback_body(other)).json()["toast"]["type"] == "warning"
    other.refresh_from_db()
    assert other.status == "pending"
    assert other.claimed_at is None
    assert FeishuCardAction.objects.filter(delivery=card_action.delivery, status="queued").count() == 1


def test_select_static_uses_option_and_server_payload(card_action):
    card_action.operation = "state"
    card_action.payload = {"state_id": "server-state"}
    card_action.save()
    body = callback_body(card_action)
    body["event"]["action"] = {
        "tag": "select_static",
        "option": action_token(card_action),
        "value": {"kind": "state", "state_id": "attacker-state", "user_id": "attacker-user"},
    }
    response = post(body)
    assert response.status_code == 200
    card_action.refresh_from_db()
    assert card_action.status == "queued"
    assert card_action.payload == {"state_id": "server-state"}


@pytest.mark.parametrize(
    "tag,operation,kind",
    [
        ("button", "state", None),
        ("select_static", "approve", "state"),
        ("select_static", "state", "other"),
    ],
)
def test_control_type_must_match_operation(card_action, tag, operation, kind):
    card_action.operation = operation
    card_action.save()
    body = callback_body(card_action)
    body["event"]["action"] = {
        "tag": tag,
        "option": action_token(card_action),
        "value": {"token": action_token(card_action), "kind": kind},
    }
    assert post(body).status_code == 400
    card_action.refresh_from_db()
    assert card_action.status == "pending"


@pytest.mark.parametrize(
    "section,key,value",
    [
        ("header", "app_id", "other-app"),
        ("operator", "open_id", "other-open"),
        ("operator", "tenant_key", "other-tenant"),
        ("context", "open_message_id", "other-message"),
    ],
)
def test_provider_identity_and_message_are_verified(card_action, section, key, value):
    body = callback_body(card_action)
    target = body["header"] if section == "header" else body["event"][section]
    target[key] = value
    body["event"]["action"]["value"].update({"open_id": "open", "tenant_key": "tenant", "app_id": "app"})
    assert post(body).status_code == 403
    card_action.refresh_from_db()
    assert card_action.status == "pending"


def test_app_tenant_can_differ_from_operator_tenant(card_action):
    body = callback_body(card_action)
    body["header"]["tenant_key"] = "application-tenant"
    assert post(body).json()["toast"]["type"] == "info"
    card_action.refresh_from_db()
    assert card_action.status == "queued"


def test_matching_wrong_header_and_operator_tenant_still_rejected(card_action):
    body = callback_body(card_action)
    body["header"]["tenant_key"] = body["event"]["operator"]["tenant_key"] = "other-tenant"
    assert post(body).status_code == 403


@pytest.mark.parametrize("changed", ["delivery_user", "delivery_binding", "action_binding"])
def test_server_relations_must_match_current_binding(card_action, changed):
    other_user = User.objects.create(email="feishu-other@example.com", username="feishu-other")
    other_binding = FeishuBinding.objects.create(user=other_user, app_id="app", tenant_key="tenant", open_id="other")
    if changed == "delivery_user":
        FeishuDelivery.objects.filter(pk=card_action.delivery_id).update(user=other_user)
    elif changed == "delivery_binding":
        FeishuDelivery.objects.filter(pk=card_action.delivery_id).update(binding=other_binding)
    else:
        FeishuCardAction.objects.filter(pk=card_action.pk).update(binding=other_binding)
    assert post(callback_body(card_action)).status_code == 403
    card_action.refresh_from_db()
    assert card_action.status == "pending"


def test_unbound_or_rebound_identity_cannot_use_old_action(card_action):
    user_id = card_action.binding.user_id
    card_action.binding.delete()
    FeishuBinding.objects.create(user_id=user_id, app_id="app", tenant_key="tenant", open_id="open")
    response = post(callback_body(card_action))
    assert response.status_code == 200
    assert response.json()["toast"]["type"] == "warning"
    card_action.refresh_from_db()
    assert card_action.status == "pending"


def test_disabled_instance_rejects_action_but_accepts_challenge(card_action, config):
    config.return_value = FeishuConfig(False, "app", "secret")
    assert post(callback_body(card_action)).json()["toast"]["type"] == "warning"
    response = APIClient(enforce_csrf_checks=True).post(
        URL,
        data={"type": "url_verification", "token": CONFIG.verification_token, "challenge": "setup"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json() == {"challenge": "setup"}
    card_action.refresh_from_db()
    assert card_action.status == "pending"


def test_disabled_after_initial_config_check_cannot_queue(card_action, config):
    config.side_effect = [FeishuConfig(True, "app", "secret"), FeishuConfig(False, "app", "secret")]
    assert post(callback_body(card_action)).json()["toast"]["type"] == "warning"
    card_action.refresh_from_db()
    assert card_action.status == "pending"


def test_expired_action_is_business_toast(card_action):
    card_action.expires_at = timezone.now() - timedelta(seconds=1)
    card_action.save()
    response = post(callback_body(card_action))
    assert response.status_code == 200
    assert response.json()["toast"]["type"] == "warning"
    card_action.refresh_from_db()
    assert card_action.status == "pending"


@pytest.mark.parametrize(
    "status,message_id,accepted",
    [
        ("sent", "", False),
        ("pending", "", False),
        ("cancelled", "message", False),
        ("failed", "message", False),
        ("retry", "", True),
        ("retry", "message", True),
    ],
)
def test_delivery_status_and_missing_message_id_policy(card_action, status, message_id, accepted):
    FeishuDelivery.objects.filter(pk=card_action.delivery_id).update(status=status, message_id=message_id)
    response = post(callback_body(card_action))
    assert response.status_code == 200
    card_action.refresh_from_db()
    assert card_action.status == ("queued" if accepted else "pending")
    card_action.delivery.refresh_from_db()
    if accepted:
        assert card_action.delivery.message_id == "message"
        assert card_action.delivery.status == "sent"


def test_retry_recovery_never_overwrites_existing_different_message(card_action):
    FeishuDelivery.objects.filter(pk=card_action.delivery_id).update(status="retry", message_id="other")
    assert post(callback_body(card_action)).status_code == 403
    card_action.delivery.refresh_from_db()
    assert card_action.delivery.message_id == "other"
    assert card_action.delivery.status == "retry"


def test_retry_recovery_requires_recipient_match_before_storing_message(card_action):
    FeishuDelivery.objects.filter(pk=card_action.delivery_id).update(status="retry", message_id="")
    body = callback_body(card_action)
    body["event"]["operator"]["open_id"] = "attacker"
    assert post(body).status_code == 403
    card_action.delivery.refresh_from_db()
    assert card_action.delivery.message_id == ""
    assert card_action.delivery.status == "retry"


def test_unsigned_ordinary_event_is_rejected_without_redirect(card_action):
    response = APIClient().post(URL, data=json.dumps(callback_body(card_action)), content_type="application/json")
    assert response.status_code == 403
    assert response.json() == {"error": "invalid_feishu_callback"}
    assert "Location" not in response


def test_oversized_request_is_rejected():
    response = APIClient().post(URL, data=b"x" * (64 * 1024 + 1), content_type="application/json")
    assert response.status_code == 400
    assert response.json() == {"error": "invalid_feishu_callback"}


@pytest.mark.django_db(transaction=True)
def test_concurrent_choices_only_accept_one_action(card_action):
    other = FeishuCardAction.objects.create(
        delivery=card_action.delivery,
        binding=card_action.binding,
        key="reject",
        operation="reject",
        expires_at=card_action.expires_at,
    )
    bodies = [callback_body(card_action), callback_body(other)]
    barrier = Barrier(2)

    def click(body):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            response = post(body)
            assert response.status_code == 200
            return response.json()["toast"]["type"]
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(click, bodies))
    assert sorted(results) == ["info", "warning"]
    assert FeishuCardAction.objects.filter(delivery=card_action.delivery, status="queued").count() == 1
    assert FeishuCardAction.objects.filter(delivery=card_action.delivery, status="pending").count() == 1
