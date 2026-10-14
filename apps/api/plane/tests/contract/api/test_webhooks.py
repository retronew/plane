# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import hashlib
import hmac
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIClient

from plane.bgtasks.webhook_task import derive_event_types, webhook_activity, webhook_send_task
from plane.db.models import APIToken, Issue, Project, ProjectMember, User, Webhook, WorkspaceMember


@pytest.fixture(autouse=True)
def _no_dns():
    # URL validation resolves the host; tests use example domains
    with patch("plane.app.serializers.webhook.validate_url"):
        yield


@pytest.fixture
def member_client(db, workspace):
    user = User.objects.create(email="member@plane.so", username="member")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    token = APIToken.objects.create(user=user, label="t", token="token-member")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client, user


def _url(workspace, suffix=""):
    return f"/api/v1/workspaces/{workspace.slug}/webhooks/{suffix}"


@pytest.mark.contract
class TestWebhookManagement:
    @pytest.mark.django_db
    def test_member_creates_personal_webhook(self, member_client, workspace):
        client, user = member_client
        response = client.post(
            _url(workspace), {"url": "https://hooks.example.com/a", "events": ["issue.assigned"]}, format="json"
        )
        assert response.status_code == 201, response.data
        assert response.data["scope"] == "personal"
        assert response.data["secret_key"]
        webhook = Webhook.objects.get(pk=response.data["id"])
        assert webhook.owner == user and webhook.events == ["issue.assigned"]

        listed = client.get(_url(workspace)).data
        assert [str(w["id"]) for w in listed] == [str(webhook.id)]
        assert "secret_key" not in listed[0]

    @pytest.mark.django_db
    def test_member_cannot_create_workspace_webhook(self, member_client, workspace):
        client, _ = member_client
        response = client.post(
            _url(workspace), {"url": "https://hooks.example.com/b", "scope": "workspace"}, format="json"
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_admin_sees_workspace_but_not_others_personal(self, api_key_client, member_client, workspace):
        client, user = member_client
        client.post(_url(workspace), {"url": "https://hooks.example.com/personal"}, format="json")
        response = api_key_client.post(
            _url(workspace), {"url": "https://hooks.example.com/ws", "scope": "workspace", "issue": True}, format="json"
        )
        assert response.data["scope"] == "workspace"
        assert [w["url"] for w in api_key_client.get(_url(workspace)).data] == ["https://hooks.example.com/ws"]
        # And the member cannot touch the workspace webhook
        assert client.delete(_url(workspace, f"{response.data['id']}/")).status_code == 404

    @pytest.mark.django_db
    def test_unknown_event_and_duplicate_url(self, member_client, workspace):
        client, _ = member_client
        bad = client.post(_url(workspace), {"url": "https://hooks.example.com/c", "events": ["nope"]}, format="json")
        assert bad.status_code == 400
        client.post(_url(workspace), {"url": "https://hooks.example.com/c"}, format="json")
        dup = client.post(_url(workspace), {"url": "https://hooks.example.com/c"}, format="json")
        assert dup.status_code == 409

    @pytest.mark.django_db
    def test_update_regenerate_logs_test(self, member_client, workspace):
        client, _ = member_client
        created = client.post(_url(workspace), {"url": "https://hooks.example.com/d"}, format="json").data
        detail = _url(workspace, f"{created['id']}/")

        assert client.patch(detail, {"is_active": False}, format="json").data["is_active"] is False
        regenerated = client.post(f"{detail}regenerate-secret/").data
        assert regenerated["secret_key"] and regenerated["secret_key"] != created["secret_key"]
        assert client.get(f"{detail}logs/").data["results"] == []
        with patch("plane.api.views.webhook.webhook_send_task.delay") as delay:
            assert client.post(f"{detail}test/").status_code == 202
        assert delay.call_args.kwargs["event"] == "ping"


@pytest.mark.unit
class TestEventDerivation:
    def test_fine_grained_types(self):
        assert derive_event_types("issue", "updated", "state_id") == ["issue", "issue.updated", "issue.state_changed"]
        assert "issue.assigned" in derive_event_types("issue", "updated", "assignee_ids")
        assert derive_event_types("cycle_issue", "created", None) == ["cycle", "cycle.created"]


@pytest.mark.contract
class TestWebhookFanOut:
    @pytest.fixture
    def project(self, workspace, create_user):
        project = Project.objects.create(name="Hook", identifier="HOOK", workspace=workspace)
        ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
        return project

    def _fan_out(self, workspace, issue, field="state_id"):
        with (
            patch("plane.bgtasks.webhook_task.webhook_send_task.delay") as delay,
            patch("plane.bgtasks.webhook_task.get_model_data", return_value={}),
        ):
            webhook_activity(
                event="issue",
                verb="updated",
                field=field,
                old_value=None,
                new_value=None,
                actor_id=None,
                slug=workspace.slug,
                current_site="https://plane.test",
                event_id=issue.id,
                old_identifier=None,
                new_identifier=None,
            )
        return {call.kwargs["webhook_id"] for call in delay.call_args_list}

    @pytest.mark.django_db
    def test_events_filter_and_owner_visibility(self, workspace, project, create_user):
        outsider = User.objects.create(email="out@plane.so", username="out")
        issue = Issue.objects.create(name="X", project=project, workspace=workspace)
        state_hook = Webhook.objects.create(
            workspace=workspace, url="https://h.example.com/1", owner=create_user, events=["issue.state_changed"]
        )
        assigned_hook = Webhook.objects.create(
            workspace=workspace, url="https://h.example.com/2", owner=create_user, events=["issue.assigned"]
        )
        toggle_hook = Webhook.objects.create(workspace=workspace, url="https://h.example.com/3", issue=True)
        outsider_hook = Webhook.objects.create(
            workspace=workspace, url="https://h.example.com/4", owner=outsider, events=["issue"]
        )

        delivered = self._fan_out(workspace, issue)

        assert state_hook.id in delivered
        assert toggle_hook.id in delivered
        assert assigned_hook.id not in delivered
        assert outsider_hook.id not in delivered  # not a member of the project


@pytest.mark.contract
class TestWebhookSignature:
    @pytest.mark.django_db
    def test_timestamped_signature(self, workspace):
        webhook = Webhook.objects.create(workspace=workspace, url="https://h.example.com/sig", secret_key="s3cret")
        response = MagicMock(status_code=200, headers={}, text="ok")
        with (
            patch("plane.bgtasks.webhook_task.pinned_fetch", return_value=response) as fetch,
            patch("plane.bgtasks.webhook_task.save_webhook_log"),
        ):
            webhook_send_task.run(
                webhook_id=webhook.id,
                slug=workspace.slug,
                event="ping",
                event_data={"x": 1},
                action="ping",
                current_site="https://plane.test",
                activity=None,
                event_types=["ping"],
            )
        kwargs = fetch.call_args.kwargs
        body = kwargs["data"].decode()
        headers = kwargs["headers"]
        timestamp = headers["X-Plane-Timestamp"]
        expected = hmac.new(b"s3cret", f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()
        assert headers["X-Plane-Signature-256"] == f"sha256={expected}"
        assert headers["X-Plane-Signature"] == hmac.new(b"s3cret", body.encode(), hashlib.sha256).hexdigest()
        assert '"event_types": ["ping"]' in body
