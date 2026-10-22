import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from plane.app.views.notification.base import UserNotificationPreferenceEndpoint
from plane.app.views.notification.preferences import UnifiedNotificationPreferenceEndpoint
from plane.db.models import UserNotificationPreference
from plane.db.models.notification_preference import NotificationPreference
from plane.utils.notification_preferences import preference_response, should_notify, update_preferences

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def call_view(view, user, method="get", data=None, query=""):
    factory = APIRequestFactory()
    request = getattr(factory, method)(f"/preferences/{query}", data=data, format="json")
    force_authenticate(request, user=user)
    return view.as_view()(request)


def test_legacy_email_migration_is_lazy_and_does_not_duplicate_old_rows(create_user):
    UserNotificationPreference.objects.update_or_create(
        user=create_user, defaults={"property_change": False, "state_change": False}
    )
    assert should_notify(create_user, event="due_reminder", channel="email") is False
    assert should_notify(create_user, event="approval_requested", channel="email") is False
    assert should_notify(create_user, event="due_reminder", channel="in_app") is True
    update_preferences(create_user, None, None, {"channels": {"feishu": True}})
    assert should_notify(create_user, event="due_reminder", channel="email") is False
    assert UserNotificationPreference.objects.filter(user=create_user).count() == 1


def test_patch_roundtrip_and_local_inherit(create_user, workspace):
    update_preferences(create_user, None, None, {"events": {"email": {"comment": False}}})
    query = f"?workspace_id={workspace.pk}"
    response = call_view(
        UnifiedNotificationPreferenceEndpoint, create_user, "patch", {"events": {"email": {"comment": True}}}, query
    )
    assert response.status_code == 200
    assert response.data["effective"]["email"]["comment"] == {"enabled": True, "source": "workspace"}
    response = call_view(
        UnifiedNotificationPreferenceEndpoint, create_user, "patch", {"events": {"email": {"comment": None}}}, query
    )
    assert response.status_code == 200
    assert response.data["events"]["email"]["comment"] is None
    assert response.data["effective"]["email"]["comment"] == {"enabled": False, "source": "global"}


def test_partial_patch_preserves_other_events_and_channels(create_user):
    update_preferences(
        create_user,
        None,
        None,
        {"events": {"email": {"comment": False, "mention": False}, "in_app": {"comment": False}}},
    )
    update_preferences(create_user, None, None, {"events": {"email": {"comment": True}}})
    result = preference_response(create_user)
    assert result["events"]["email"]["mention"] is False
    assert result["events"]["email"]["comment"] is True
    assert result["events"]["in_app"]["comment"] is False


def test_old_and_new_api_remain_bidirectionally_compatible(create_user):
    UserNotificationPreference.objects.get_or_create(user=create_user)
    update_preferences(create_user, None, None, {"events": {"email": {"comment": False, "approval_requested": True}}})
    assert UserNotificationPreference.objects.get(user=create_user).comment is False
    response = call_view(
        UserNotificationPreferenceEndpoint,
        create_user,
        "patch",
        {"comment": True, "state_change": False, "workspace": "d4c15c5e-1a21-461c-9c32-5a80b3ac9e94"},
    )
    assert response.status_code == 200
    assert should_notify(create_user, event="comment", channel="email") is True
    assert should_notify(create_user, event="approval_requested", channel="email") is True
    assert UserNotificationPreference.objects.get(user=create_user).workspace_id is None


def test_invalid_patch_never_creates_preference(create_user):
    response = call_view(UnifiedNotificationPreferenceEndpoint, create_user, "patch", {"user": "someone-else"})
    assert response.status_code == 400
    assert not NotificationPreference.objects.filter(user=create_user).exists()


def test_revoked_workspace_membership_denies_access(create_user, workspace):
    workspace.workspace_member.update(is_active=False)
    response = call_view(UnifiedNotificationPreferenceEndpoint, create_user, query=f"?workspace_id={workspace.pk}")
    assert response.status_code == 404
