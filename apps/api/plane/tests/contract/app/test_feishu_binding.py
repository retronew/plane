# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

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


@pytest.mark.parametrize("app_url", [None, "http://localhost:3000"])
def test_oauth_uses_api_callback_and_returns_to_frontend(session_client, create_user, settings, app_url):
    settings.WEB_URL = "http://localhost:8000"
    settings.APP_BASE_URL = app_url
    callback_url = "http://localhost:8000/api/users/me/integrations/feishu/callback/"
    with (
        patch("plane.app.views.feishu.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
        patch("plane.app.views.feishu.FeishuClient") as client,
    ):
        response = session_client.post("/api/users/me/integrations/feishu/authorize/", {}, format="json")
        assert response.status_code == 200
        query = parse_qs(urlsplit(response.json()["authorization_url"]).query)
        assert query["redirect_uri"] == [callback_url]
        client.return_value.identity.return_value = {"open_id": "open", "tenant_key": "tenant", "name": "Name"}
        response = session_client.get(
            "/api/users/me/integrations/feishu/callback/", {"state": query["state"][0], "code": "code"}
        )
        assert response.status_code == 302
        assert response["Location"] == (
            f"{app_url or settings.WEB_URL}/settings/profile/notifications/?feishu=connected"
        )
        assert client.return_value.identity.call_args.args[2] == callback_url
        assert FeishuBinding.objects.filter(user=create_user, open_id="open").exists()
        response = session_client.get("/api/users/me/integrations/feishu/callback/", {"error": "access_denied"})
        assert response["Location"] == f"{app_url or settings.WEB_URL}/settings/profile/notifications/?feishu=error"


def test_callback_consumes_state_before_identity_conflict(session_client, create_user, settings):
    settings.WEB_URL = "https://plane.example"
    other = User.objects.create(email="claimed-feishu@example.com", username="claimed-feishu")
    FeishuBinding.objects.create(user=other, app_id="app", tenant_key="tenant", open_id="claimed")
    session = session_client.session
    if not session.session_key:
        session.save()
    FeishuOAuthState.objects.create(
        state_hash=digest("callback-state"),
        user=create_user,
        app_id="app",
        session_hash=digest(session.session_key),
        verifier="verifier",
        expires_at=timezone.now() + timedelta(minutes=5),
    )
    with (
        patch("plane.app.views.feishu.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
        patch("plane.app.views.feishu.FeishuClient") as client,
    ):
        client.return_value.identity.return_value = {"open_id": "claimed", "tenant_key": "tenant", "name": "Name"}
        first = session_client.get(
            "/api/users/me/integrations/feishu/callback/", {"state": "callback-state", "code": "code"}
        )
        assert first.status_code == 302
        assert first["Location"].endswith("?feishu=identity_in_use")
        second = session_client.get(
            "/api/users/me/integrations/feishu/callback/", {"state": "callback-state", "code": "code"}
        )
        assert second["Location"].endswith("?feishu=error")
        assert client.return_value.identity.call_count == 1
    assert not FeishuBinding.objects.filter(user=create_user).exists()
    assert FeishuBinding.objects.get(open_id="claimed").user_id == other.pk


def test_new_authorization_invalidates_consumed_in_flight_callback(session_client, create_user, settings):
    settings.WEB_URL = "https://plane.example"
    session = session_client.session
    FeishuOAuthState.objects.create(
        state_hash=digest("old-state"),
        user=create_user,
        app_id="app",
        session_hash=digest(session.session_key),
        verifier="verifier",
        expires_at=timezone.now() + timedelta(minutes=5),
    )

    def identity_after_new_authorization(*args):
        response = session_client.post("/api/users/me/integrations/feishu/authorize/", {}, format="json")
        assert response.status_code == 200
        return {"open_id": "old-identity", "tenant_key": "tenant"}

    with (
        patch("plane.app.views.feishu.get_feishu_config", return_value=FeishuConfig(True, "app", "secret")),
        patch("plane.app.views.feishu.FeishuClient") as client,
    ):
        client.return_value.identity.side_effect = identity_after_new_authorization
        response = session_client.get(
            "/api/users/me/integrations/feishu/callback/", {"state": "old-state", "code": "code"}
        )
    assert response["Location"].endswith("?feishu=error")
    assert not FeishuBinding.objects.filter(user=create_user).exists()
    assert not FeishuOAuthState.objects.filter(state_hash=digest("old-state")).exists()
    assert FeishuOAuthState.objects.filter(user=create_user, consumed_at__isnull=True).count() == 1


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
