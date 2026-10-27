# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from plane.app.views.feishu import consume_oauth_state, digest
from plane.db.models import User
from plane.db.models.feishu import FeishuBinding, FeishuDelivery, FeishuOAuthState
from plane.utils.feishu import enqueue_feishu_notification, unbind_feishu
from plane.utils.feishu_client import FeishuConfig, FeishuError

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def binding(create_user):
    return FeishuBinding.objects.create(user=create_user, app_id="app", tenant_key="tenant", open_id="open")


def test_identity_cannot_be_claimed_by_another_user(binding):
    other = User.objects.create(email="other-feishu@example.com", username="other-feishu")
    with pytest.raises(IntegrityError), transaction.atomic():
        FeishuBinding.objects.create(user=other, app_id="app", tenant_key="tenant", open_id="open")
    assert FeishuBinding.objects.get(pk=binding.pk).user_id == binding.user_id
    assert not FeishuBinding.objects.filter(user=other).exists()


def test_identity_is_namespaced_by_application_and_tenant(binding):
    other = User.objects.create(email="other-feishu@example.com", username="other-feishu")
    FeishuBinding.objects.create(user=other, app_id="other-app", tenant_key="tenant", open_id="open")
    third = User.objects.create(email="third-feishu@example.com", username="third-feishu")
    FeishuBinding.objects.create(user=third, app_id="app", tenant_key="other-tenant", open_id="open")
    assert FeishuBinding.objects.count() == 3


def test_unbind_cancels_pending_messages_and_invalidates_oauth(binding):
    pending = FeishuDelivery.objects.create(
        user=binding.user, binding=binding, event_key="pending", kind="test", title="test"
    )
    retry = FeishuDelivery.objects.create(
        user=binding.user, binding=binding, event_key="retry", kind="test", title="test", status="retry"
    )
    sent = FeishuDelivery.objects.create(
        user=binding.user, binding=binding, event_key="sent", kind="test", title="test", status="sent"
    )
    FeishuOAuthState.objects.create(
        state_hash=digest("state"),
        user=binding.user,
        app_id="app",
        session_hash=digest("session"),
        verifier="verifier",
        expires_at=timezone.now() + timedelta(minutes=5),
    )
    unbind_feishu(binding.user_id)
    pending.refresh_from_db()
    retry.refresh_from_db()
    sent.refresh_from_db()
    assert pending.status == retry.status == "cancelled"
    assert sent.status == "sent"
    assert pending.binding_id is None
    assert not FeishuOAuthState.objects.filter(user_id=binding.user_id).exists()
    assert not FeishuBinding.objects.filter(pk=binding.pk).exists()


def test_oauth_database_state_is_single_use(create_user):
    row = FeishuOAuthState.objects.create(
        state_hash=digest("state"),
        user=create_user,
        app_id="app",
        session_hash=digest("session"),
        verifier="verifier",
        expires_at=timezone.now() + timedelta(minutes=5),
    )
    assert consume_oauth_state("state", create_user.pk, "session", "app") == "verifier"
    with pytest.raises(FeishuError, match="invalid_oauth_state"):
        consume_oauth_state("state", create_user.pk, "session", "app")
    row.refresh_from_db()
    assert row.verifier == ""
    assert row.consumed_at is not None


def test_enqueue_deduplicates_persistently(binding):
    with patch("plane.utils.feishu.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")):
        first = enqueue_feishu_notification(
            event_key="same", user_id=binding.user_id, kind="test", title="test", is_test=True
        )
        second = enqueue_feishu_notification(
            event_key="same", user_id=binding.user_id, kind="test", title="test", is_test=True
        )
    assert first.pk == second.pk
    assert FeishuDelivery.objects.filter(event_key="same").count() == 1


@pytest.mark.parametrize("enabled", [True, False])
@pytest.mark.parametrize("bound", [True, False])
def test_personal_binding_writes_are_administrator_managed(session_client, create_user, enabled, bound):
    if bound:
        FeishuBinding.objects.create(user=create_user, app_id="app", tenant_key="tenant", open_id="existing")
    session = session_client.session
    row = FeishuOAuthState.objects.create(
        state_hash=digest("old-state"), user=create_user, app_id="app",
        session_hash=digest(session.session_key), verifier="verifier",
        expires_at=timezone.now() + timedelta(minutes=5),
    )
    with (
        patch("plane.app.views.feishu.get_feishu_config", return_value=FeishuConfig(enabled, "app", "secret")),
        patch("plane.utils.feishu_client.FeishuClient.identity") as identity,
    ):
        responses = [
            session_client.post("/api/users/me/integrations/feishu/authorize/", {}, format="json"),
            session_client.delete("/api/users/me/integrations/feishu/"),
            session_client.get("/api/users/me/integrations/feishu/callback/", {"state": "old-state", "code": "code"}),
            session_client.get("/api/users/me/integrations/feishu/callback/", {"error": "access_denied"}),
        ]
    for response in responses:
        assert response.status_code == 403
        assert response.json() == {"error": "administrator_managed"}
    identity.assert_not_called()
    assert FeishuBinding.objects.filter(user=create_user).count() == int(bound)
    if bound:
        assert FeishuBinding.objects.get(user=create_user).open_id == "existing"
    row.refresh_from_db()
    assert row.verifier == "verifier"
    assert row.consumed_at is None
    assert FeishuOAuthState.objects.filter(user=create_user).count() == 1


def test_personal_status_and_test_remain_available(session_client, binding):
    with (
        patch("plane.app.views.feishu.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
        patch("plane.utils.feishu.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
    ):
        response = session_client.get("/api/users/me/integrations/feishu/")
        assert response.status_code == 200
        assert response.json()["binding"]["app_id"] == "app"
        response = session_client.post("/api/users/me/integrations/feishu/test/", {}, format="json")
    assert response.status_code == 202
    assert FeishuDelivery.objects.get(pk=response.json()["delivery_id"]).is_test is True
    assert FeishuBinding.objects.filter(pk=binding.pk).exists()


@pytest.mark.django_db(transaction=True)
def test_first_attempt_survives_response_commit_failure(binding, settings):
    from plane.bgtasks.feishu_task import send_feishu_delivery

    settings.WEB_URL = "https://plane.example"
    delivery = FeishuDelivery.objects.create(
        user=binding.user, binding=binding, event_key="crash", kind="test", title="test", is_test=True
    )
    with (
        patch("plane.bgtasks.feishu_task.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
        patch("plane.bgtasks.feishu_task.FeishuClient") as client,
        patch.object(FeishuDelivery, "save", side_effect=RuntimeError("database commit failed")),
    ):
        with pytest.raises(RuntimeError):
            send_feishu_delivery.run(str(delivery.id))
        client.return_value.send.assert_called_once()
    delivery.refresh_from_db()
    assert delivery.first_attempt_at is not None
    assert delivery.status == "pending"
    FeishuDelivery.objects.filter(pk=delivery.pk).update(first_attempt_at=timezone.now() - timedelta(minutes=56))
    with (
        patch("plane.bgtasks.feishu_task.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
        patch("plane.bgtasks.feishu_task.FeishuClient") as client,
    ):
        send_feishu_delivery.run(str(delivery.id))
        client.assert_not_called()
    delivery.refresh_from_db()
    assert delivery.status == "failed"
    assert delivery.last_error == "delivery_window_expired"
