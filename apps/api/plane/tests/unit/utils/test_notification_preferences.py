from types import SimpleNamespace
from unittest.mock import patch

import pytest
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.test import APIRequestFactory, force_authenticate

from plane.app.views.notification.preferences import UnifiedNotificationPreferenceEndpoint, validate_preferences
from plane.utils.notification_preferences import CHANNELS, EVENTS, resolve_policy

pytestmark = pytest.mark.unit


def preference(events=None, channels=None, override_scopes=None):
    return SimpleNamespace(events=events or {}, channels=channels or {}, override_scopes=override_scopes or {})


@pytest.mark.parametrize("event", EVENTS)
@pytest.mark.parametrize("channel,enabled", [("in_app", True), ("email", True), ("feishu", False)])
def test_defaults(event, channel, enabled):
    assert resolve_policy(None, None, None, None, event, channel)["enabled"] is enabled


@pytest.mark.parametrize("channel", CHANNELS)
def test_channel_disabled_is_hard_gate(channel):
    global_pref = preference(channels={channel: False})
    local = preference(events={channel: {"comment": True}})
    assert resolve_policy(global_pref, local, local, None, "comment", channel) == {
        "enabled": False,
        "source": "channel_disabled",
    }


def test_scope_precedence_and_null_inheritance():
    global_pref = preference(events={"email": {"comment": False}})
    workspace = preference(events={"email": {"comment": True}})
    project = preference(events={"email": {"comment": False}})
    assert resolve_policy(global_pref, workspace, project, None, "comment", "email") == {
        "enabled": False,
        "source": "project",
    }
    project.events["email"]["comment"] = None
    assert resolve_policy(global_pref, workspace, project, None, "comment", "email") == {
        "enabled": True,
        "source": "workspace",
    }
    workspace.events["email"]["comment"] = None
    assert resolve_policy(global_pref, workspace, project, None, "comment", "email") == {
        "enabled": False,
        "source": "global",
    }


def test_uniform_override_ignores_both_local_scopes():
    global_pref = preference(events={"email": {"comment": False}}, override_scopes={"email": True})
    local = preference(events={"email": {"comment": True}, "in_app": {"comment": False}})
    assert resolve_policy(global_pref, local, local, None, "comment", "email") == {"enabled": False, "source": "global"}
    assert resolve_policy(global_pref, local, local, None, "comment", "in_app")["source"] == "project"


@pytest.mark.parametrize(
    "event,field",
    [
        ("due_reminder", "property_change"),
        ("approval_requested", "state_change"),
        ("intake_created", "property_change"),
    ],
)
def test_legacy_compatibility_and_explicit_override(event, field):
    legacy = SimpleNamespace(**{field: False})
    assert resolve_policy(None, None, None, legacy, event, "email") == {"enabled": False, "source": "legacy"}
    global_pref = preference(events={"email": {event: True}})
    assert resolve_policy(global_pref, None, None, legacy, event, "email") == {"enabled": True, "source": "global"}
    assert resolve_policy(None, None, None, legacy, event, "in_app")["enabled"] is True


@pytest.mark.parametrize(
    "data,is_global",
    [
        ({"user": "someone-else"}, True),
        ({"channels": {"email": True}}, False),
        ({"override_scopes": {"email": True}}, False),
        ({"channels": {"sms": True}}, True),
        ({"channels": {"email": 1}}, True),
        ({"events": {"email": {"unknown": True}}}, True),
        ({"events": {"email": {"comment": None}}}, True),
        ({"events": {"email": {"comment": "false"}}}, False),
        ([], False),
    ],
)
def test_invalid_payload(data, is_global):
    with pytest.raises(ValidationError):
        validate_preferences(data, is_global)


def test_local_tristate():
    payload = {"events": {"email": {"comment": None, "mention": True, "state_change": False}}}
    assert validate_preferences(payload, False) == payload


def test_unknown_resolver_input_fails_closed():
    with pytest.raises(ValueError):
        resolve_policy(None, None, None, None, "typo", "email")


def test_scope_requires_workspace_for_project():
    request = SimpleNamespace(query_params={"project_id": "d4c15c5e-1a21-461c-9c32-5a80b3ac9e94"})
    with pytest.raises(ValidationError):
        UnifiedNotificationPreferenceEndpoint().get_scope(request)


def test_scope_denies_nonmember():
    request = SimpleNamespace(query_params={"workspace_id": "d4c15c5e-1a21-461c-9c32-5a80b3ac9e94"}, user=object())
    with patch("plane.app.views.notification.preferences.WorkspaceMember.objects.filter") as members:
        members.return_value.exists.return_value = False
        with pytest.raises(NotFound):
            UnifiedNotificationPreferenceEndpoint().get_scope(request)
        assert members.call_args.kwargs["member"] is request.user
        assert members.call_args.kwargs["is_active"] is True


def test_scope_denies_foreign_project():
    request = SimpleNamespace(
        query_params={
            "workspace_id": "d4c15c5e-1a21-461c-9c32-5a80b3ac9e94",
            "project_id": "d4c15c5e-1a21-461c-9c32-5a80b3ac9e95",
        },
        user=object(),
    )
    with (
        patch("plane.app.views.notification.preferences.WorkspaceMember.objects.filter") as workspaces,
        patch("plane.app.views.notification.preferences.ProjectMember.objects.filter") as projects,
    ):
        workspaces.return_value.exists.return_value = True
        projects.return_value.exists.return_value = False
        with pytest.raises(NotFound):
            UnifiedNotificationPreferenceEndpoint().get_scope(request)
        assert str(projects.call_args.kwargs["project__workspace_id"]) == request.query_params["workspace_id"]
        assert projects.call_args.kwargs["member"] is request.user


def test_patch_uses_authenticated_user_only():
    user = SimpleNamespace(pk="current-user", is_authenticated=True, user_timezone="UTC")
    request = APIRequestFactory().patch("/preferences/", {"events": {"email": {"comment": False}}}, format="json")
    force_authenticate(request, user=user)
    with (
        patch("plane.app.views.notification.preferences.update_preferences") as update,
        patch("plane.app.views.notification.preferences.preference_response", return_value={"effective": {}}),
    ):
        response = UnifiedNotificationPreferenceEndpoint.as_view()(request)
    assert response.status_code == 200
    assert update.call_args.args[0] is user


def test_unauthenticated_request_is_denied():
    request = APIRequestFactory().get("/preferences/")
    response = UnifiedNotificationPreferenceEndpoint.as_view()(request)
    assert response.status_code in (401, 403)


def test_snapshot_loads_once_for_every_channel_and_event():
    from plane.utils.notification_preferences import NotificationPreferenceResolver

    with patch("plane.utils.notification_preferences.load_preferences", return_value=(None, None, None, None)) as load:
        resolver = NotificationPreferenceResolver("user-id", "workspace-id", "project-id")
        for channel in CHANNELS:
            for event in EVENTS:
                resolver.should_notify(event, channel)
        load.assert_called_once_with("user-id", "workspace-id", "project-id")
