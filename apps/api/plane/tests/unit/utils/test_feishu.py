# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from contextlib import nullcontext
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.test import override_settings
from django.utils import timezone

from plane.app.views.feishu import consume_oauth_state, digest
from plane.db.models.feishu import FeishuBinding, FeishuDelivery
from plane.utils.feishu import delivery_allowed, delivery_card
from plane.utils.feishu_client import FeishuClient, FeishuConfig, FeishuError

pytestmark = pytest.mark.unit


@pytest.fixture
def client():
    return FeishuClient(FeishuConfig(True, "app", "secret-not-for-logs"))


@pytest.mark.parametrize(
    "http,body,retryable",
    [
        (429, {}, True),
        (503, {}, True),
        (403, {}, False),
        (200, {"code": 230020}, True),
        (200, {"code": 230002}, False),
        (200, {"error": "invalid_grant"}, False),
    ],
)
def test_http_and_provider_errors(client, http, body, retryable):
    with patch(
        "plane.utils.feishu_client.requests.request", return_value=SimpleNamespace(status_code=http, json=lambda: body)
    ):
        with pytest.raises(FeishuError) as error:
            client.request("GET", "/test")
        assert error.value.retryable is retryable
        assert "secret" not in str(error.value)


@pytest.mark.parametrize(
    "http,code,reason,retryable",
    [
        (400, 99991672, "provider_error_99991672", False),
        (403, 99991672, "provider_error_99991672", False),
        (400, 99991663, "provider_error_99991663", True),
        (400, 99991668, "provider_error_99991668", True),
        (400, "secret-token", "provider_http_error", False),
        (400, True, "provider_http_error", False),
        (400, 0, "provider_http_error", False),
        (400, 10**30, "provider_http_error", False),
        (429, 99991672, "provider_unavailable", True),
        (503, 99991672, "provider_unavailable", True),
    ],
)
def test_http_error_preserves_only_safe_provider_code(client, http, code, reason, retryable):
    response = SimpleNamespace(status_code=http, json=lambda: {"code": code, "msg": "secret-token"})
    with patch("plane.utils.feishu_client.requests.request", return_value=response):
        with pytest.raises(FeishuError) as error:
            client.request("GET", "/tenant/v2/tenant/query")
    assert str(error.value) == reason
    assert error.value.retryable is retryable
    assert "secret-token" not in repr(error.value)


def test_http_error_with_non_json_body_is_safe(client):
    response = MagicMock(status_code=400)
    response.json.side_effect = ValueError("secret-token")
    with patch("plane.utils.feishu_client.requests.request", return_value=response):
        with pytest.raises(FeishuError) as error:
            client.request("GET", "/test")
    assert str(error.value) == "provider_http_error"


def test_transport_error_does_not_expose_secrets(client):
    with patch("plane.utils.feishu_client.requests.request", side_effect=requests.Timeout("secret body")):
        with pytest.raises(FeishuError, match="transport_error") as error:
            client.request("POST", "/test")
        assert error.value.retryable
        assert str(error.value) == "transport_error"
    assert "secret-not-for-logs" not in repr(client.config)


def test_send_uses_stable_uuid_and_open_id(client):
    with patch.object(client, "tenant_token", return_value="token"), patch.object(client, "request") as request:
        client.send("open", {"header": {}}, "stable-id")
        client.send("open", {"header": {}}, "stable-id")
        assert request.call_args.kwargs["json"]["uuid"] == "stable-id"
        assert request.call_args.kwargs["params"] == {"receive_id_type": "open_id"}
        assert request.call_args.args == ("POST", "/im/v1/messages")


def test_token_cache_namespaces_credentials():
    first = FeishuClient(FeishuConfig(True, "one", "secret"))
    second = FeishuClient(FeishuConfig(True, "two", "secret"))
    rotated = FeishuClient(FeishuConfig(True, "one", "rotated"))
    assert len({first.token_cache_key, second.token_cache_key, rotated.token_cache_key}) == 3
    assert "secret" not in first.token_cache_key


@pytest.mark.parametrize(
    "override",
    [
        {"user_id": "someone-else"},
        {"session_hash": digest("other-session")},
        {"app_id": "other-app"},
        {"expires_at": timezone.now() - timedelta(seconds=1)},
        {"consumed_at": timezone.now()},
    ],
)
def test_oauth_rejects_wrong_session_user_app_expiry_or_replay(override):
    row = MagicMock(
        user_id="user",
        session_hash=digest("session"),
        app_id="app",
        expires_at=timezone.now() + timedelta(minutes=5),
        consumed_at=None,
        verifier="verifier",
    )
    for key, value in override.items():
        setattr(row, key, value)
    with (
        patch("plane.app.views.feishu.transaction.atomic", return_value=nullcontext()),
        patch("plane.app.views.feishu.FeishuOAuthState.objects.select_for_update") as query,
    ):
        query.return_value.filter.return_value.first.return_value = row
        with pytest.raises(FeishuError, match="invalid_oauth_state"):
            consume_oauth_state("state", "user", "session", "app")
        row.save.assert_not_called()


def test_oauth_state_is_consumed_and_verifier_erased():
    row = MagicMock(
        user_id="user",
        session_hash=digest("session"),
        app_id="app",
        expires_at=timezone.now() + timedelta(minutes=5),
        consumed_at=None,
        verifier="verifier",
    )
    with (
        patch("plane.app.views.feishu.transaction.atomic", return_value=nullcontext()),
        patch("plane.app.views.feishu.FeishuOAuthState.objects.select_for_update") as query,
    ):
        query.return_value.filter.return_value.first.return_value = row
        assert consume_oauth_state("state", "user", "session", "app") == "verifier"
        assert row.verifier == ""
        assert row.consumed_at is not None
        with pytest.raises(FeishuError):
            consume_oauth_state("state", "user", "session", "app")


def test_database_identity_and_delivery_constraints():
    assert FeishuBinding._meta.constraints[0].fields == ("app_id", "tenant_key", "open_id")
    assert FeishuDelivery._meta.constraints[0].fields == ("event_key", "user", "channel")


def test_test_delivery_bypasses_preferences_but_not_instance_or_binding():
    delivery = SimpleNamespace(binding=SimpleNamespace(app_id="app"), user_id="user", is_test=True)
    with patch("plane.utils.feishu.User.objects.filter") as users:
        users.return_value.exists.return_value = True
        assert delivery_allowed(delivery, FeishuConfig(True, "app", "secret"))
        assert not delivery_allowed(delivery, FeishuConfig(False, "app", "secret"))
        assert not delivery_allowed(delivery, FeishuConfig(True, "changed", "secret"))
        delivery.binding = None
        assert not delivery_allowed(delivery, FeishuConfig(True, "app", "secret"))


def test_removed_membership_blocks_delivery_before_preference_check():
    delivery = SimpleNamespace(
        binding=SimpleNamespace(app_id="app"), user_id="user", is_test=False, workspace_id="workspace"
    )
    with (
        patch("plane.utils.feishu.User.objects.filter") as users,
        patch("plane.utils.feishu.WorkspaceMember.objects.filter") as members,
    ):
        users.return_value.exists.return_value = True
        members.return_value.exists.return_value = False
        assert not delivery_allowed(delivery, FeishuConfig(True, "app", "secret"))
        members.assert_called_once_with(
            member_id="user", workspace_id="workspace", is_active=True, workspace__deleted_at__isnull=True
        )


@pytest.mark.parametrize("app_url", [None, "http://localhost:3000"])
@override_settings(WEB_URL="https://plane.example")
def test_card_uses_fixed_origin_and_plain_text(settings, app_url):
    settings.APP_BASE_URL = app_url
    delivery = SimpleNamespace(
        user=SimpleNamespace(), workspace_id=None, title="<script>test</script>", body="[text](https://evil.example)"
    )
    card = delivery_card(delivery)
    assert card["elements"][0]["text"]["tag"] == "plain_text"
    assert card["elements"][1]["actions"][0]["url"] == (
        f"{app_url or 'https://plane.example'}/settings/profile/notifications/"
    )


def test_live_preferences_are_checked_for_business_delivery():
    delivery = SimpleNamespace(
        binding=SimpleNamespace(app_id="app"),
        user_id="user",
        is_test=False,
        workspace_id="workspace",
        project_id=None,
        issue_id=None,
        kind="mention",
    )
    with (
        patch("plane.utils.feishu.User.objects.filter") as users,
        patch("plane.utils.feishu.WorkspaceMember.objects.filter") as members,
        patch("plane.utils.notification_preferences.should_notify", return_value=False) as preference,
    ):
        users.return_value.exists.return_value = True
        members.return_value.exists.return_value = True
        assert not delivery_allowed(delivery, FeishuConfig(True, "app", "secret"))
        preference.assert_called_once_with("user", "workspace", None, "mention", "feishu")


def test_oauth_pkce_uses_official_endpoints_and_discards_user_tokens(client):
    with patch.object(
        client,
        "request",
        side_effect=[
            {"access_token": "user-access", "refresh_token": "discarded"},
            {"data": {"open_id": "open", "tenant_key": "tenant"}},
        ],
    ) as request:
        assert client.identity("code", "verifier", "https://plane.example/callback") == {
            "open_id": "open",
            "tenant_key": "tenant",
        }
        assert request.call_args_list[0].args == ("POST", "/authen/v2/oauth/token")
        assert request.call_args_list[0].kwargs["json"]["code_verifier"] == "verifier"
        assert request.call_args_list[1].args == ("GET", "/authen/v1/user_info")
        assert not hasattr(client, "access_token")


def test_missing_provider_code_is_not_success(client):
    with patch(
        "plane.utils.feishu_client.requests.request", return_value=SimpleNamespace(status_code=200, json=lambda: {})
    ):
        with pytest.raises(FeishuError, match="invalid_provider_response"):
            client.request("POST", "/im/v1/messages")


@pytest.mark.parametrize("kind,key", [("due_reminder", "bad"), ("approval_requested", "approval-requested:not-a-uuid")])
def test_sensitive_events_fail_closed_without_durable_reference(kind, key):
    from plane.utils.feishu import event_still_relevant

    assert not event_still_relevant(SimpleNamespace(kind=kind, event_key=key))


@pytest.mark.parametrize("approvers,expected", [([{"id": "user"}], True), ([{"id": "other"}], False)])
def test_pending_approval_rechecks_current_approvers(approvers, expected):
    from plane.utils.feishu import event_still_relevant

    delivery = SimpleNamespace(
        kind="approval_requested",
        event_key="approval-requested:00000000-0000-0000-0000-000000000001",
        issue_id="issue",
        workspace_id="workspace",
        project_id="project",
        user_id="user",
    )
    with patch("plane.utils.feishu.WorkflowApproval.objects.filter") as approvals:
        approvals.return_value.first.return_value = SimpleNamespace(branches=[{"approvers": approvers}])
        assert event_still_relevant(delivery) is expected
        assert approvals.call_args.kwargs["status"] == "pending"
        approvals.return_value.first.return_value = None
        assert not event_still_relevant(delivery)


def test_changed_due_date_suppresses_queued_reminder():
    from plane.utils.feishu import event_still_relevant

    delivery = SimpleNamespace(
        kind="due_reminder",
        event_key="due-reminder:00000000-0000-0000-0000-000000000001",
        issue_id="issue",
        user_id="user",
    )
    with patch("plane.utils.feishu.IssueDueReminder.objects.filter") as reminders:
        reminders.return_value.select_related.return_value.first.return_value = SimpleNamespace(
            target_date="2026-10-22", issue=SimpleNamespace(target_date="2026-10-23")
        )
        assert not event_still_relevant(delivery)
