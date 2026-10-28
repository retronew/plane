# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.urls import resolve
from django.utils import timezone
from rest_framework.test import APIClient

from plane.db.models import User, Workspace, WorkspaceMember
from plane.license.models import Instance, InstanceAdmin

import pytest

from plane.license.api.views import user as views


@pytest.fixture
def detail_client(db):
    admin = User.objects.create(email="detail-admin@example.com", username="detail-admin")
    instance = Instance.objects.create(
        instance_name="Test", instance_id="user-detail", current_version="test", last_checked_at=timezone.now()
    )
    InstanceAdmin.objects.create(instance=instance, user=admin, role=15)
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def detail_user(db):
    return User.objects.create(
        email="detail-target@example.com",
        username="detail-target",
        first_name="Original",
        last_name="Name",
        display_name="Original Name",
    )


def _detail_url(user_id):
    return f"/api/instances/users/{user_id}/"


@pytest.mark.unit
@pytest.mark.django_db
class TestUserDetail:
    def test_list_order_is_stable_after_profile_edit(self, detail_client):
        joined = timezone.now()
        users = [
            User.objects.create(
                id=f"00000000-0000-0000-0000-{index:012d}",
                email=f"sort-{index}@example.com",
                username=f"sort-{index}",
                date_joined=joined if index != 3 else joined - timezone.timedelta(days=1),
                is_active=index != 1,
            )
            for index in [3, 2, 1]
        ]
        url = "/api/instances/users/?search=sort-&per_page=2"
        response = detail_client.get(url)
        assert response.status_code == 200
        expected = [str(users[2].pk), str(users[1].pk)]
        assert [user["id"] for user in response.data["results"]] == expected
        next_page = detail_client.get(f"{url}&cursor={response.data['next_cursor']}")
        assert [user["id"] for user in next_page.data["results"]] == [str(users[0].pk)]

        updated = detail_client.patch(
            _detail_url(users[2].pk),
            {"first_name": "Zed", "display_name": "Updated"},
            format="json",
        )
        assert updated.status_code == 200
        assert [user["id"] for user in detail_client.get(url).data["results"]] == expected

    def test_detail_route_and_workspace_filtering(self, detail_client, detail_user):
        other = User.objects.create(email="other@example.com", username="other")
        visible = None
        for state in ["active", "inactive", "deleted-member", "deleted-workspace", "other-user"]:
            workspace = Workspace.objects.create(name=state, slug=state, owner=detail_user)
            WorkspaceMember.objects.create(
                workspace=workspace,
                member=other if state == "other-user" else detail_user,
                role=15,
                is_active=state != "inactive",
                deleted_at=timezone.now() if state == "deleted-member" else None,
            )
            if state == "deleted-workspace":
                Workspace.objects.filter(pk=workspace.pk).update(deleted_at=timezone.now())
            if state == "active":
                visible = workspace
        url = _detail_url(detail_user.pk)
        assert resolve(url).func.view_class is views.InstanceUserDetailEndpoint
        response = detail_client.get(url)
        assert response.status_code == 200
        expected = views.serialize_user(views._user_queryset().get(pk=detail_user.pk))
        assert response.data == {
            **expected,
            "workspaces": [{"id": str(visible.pk), "name": "active", "slug": "active", "role": 15}],
        }
        assert response.data["workspace_count"] == 1
        assert set(response.data) == {
            "id",
            "email",
            "display_name",
            "first_name",
            "last_name",
            "avatar_url",
            "is_active",
            "is_instance_admin",
            "has_sso",
            "last_login_medium",
            "last_login_time",
            "workspace_count",
            "date_joined",
            "workspaces",
        }

    def test_patch_trims_and_returns_updated_detail(self, detail_client, detail_user):
        response = detail_client.patch(
            _detail_url(detail_user.pk),
            {
                "first_name": "  Taylor  ",
                "last_name": "  ",
                "display_name": "  Taylor T  ",
            },
            format="json",
        )
        assert response.status_code == 200
        detail_user.refresh_from_db()
        assert (detail_user.first_name, detail_user.last_name, detail_user.display_name) == ("Taylor", "", "Taylor T")
        assert response.data == detail_client.get(_detail_url(detail_user.pk)).data
        assert detail_user.email == "detail-target@example.com"

    def test_partial_and_empty_patch(self, detail_client, detail_user):
        url = _detail_url(detail_user.pk)
        assert detail_client.patch(url, {"first_name": ""}, format="json").status_code == 200
        detail_user.refresh_from_db()
        assert detail_user.first_name == ""
        assert detail_user.last_name == "Name"
        assert detail_client.patch(url, {}, format="json").data == detail_client.get(url).data

    @pytest.mark.parametrize("field", ["first_name", "last_name", "display_name"])
    @pytest.mark.parametrize("value", [None, 123, True, [], {}, "x" * 256])
    def test_rejects_invalid_values(self, detail_client, detail_user, field, value):
        response = detail_client.patch(_detail_url(detail_user.pk), {field: value}, format="json")
        assert response.status_code == 400
        assert field in response.data
        detail_user.refresh_from_db()
        assert detail_user.first_name == "Original"
        assert detail_user.last_name == "Name"
        assert detail_user.display_name == "Original Name"

    @pytest.mark.parametrize("field", ["first_name", "last_name", "display_name"])
    def test_accepts_max_length(self, detail_client, detail_user, field):
        response = detail_client.patch(_detail_url(detail_user.pk), {field: "x" * 255}, format="json")
        assert response.status_code == 200
        assert response.data[field] == "x" * 255

    @pytest.mark.parametrize(
        "data",
        [
            {"display_name": ""},
            {"display_name": "  "},
            {"first_name": "https://example.com"},
            {"last_name": "https://example.com"},
            {"email": "new@example.com"},
            {"is_active": False},
            {"is_superuser": True},
            {"password": "new-password"},
            {"workspaces": []},
            {"unknown": "value"},
        ],
    )
    def test_rejects_invalid_fields_without_partial_update(self, detail_client, detail_user, data):
        response = detail_client.patch(_detail_url(detail_user.pk), {"first_name": "Changed", **data}, format="json")
        assert response.status_code == 400
        detail_user.refresh_from_db()
        assert detail_user.first_name == "Original"

    @pytest.mark.parametrize("method", ["get", "patch"])
    @pytest.mark.parametrize("kind", ["unknown", "bot"])
    def test_missing_or_bot_user_returns_404(self, detail_client, detail_user, method, kind):
        target_id = uuid4()
        if kind == "bot":
            detail_user.is_bot = True
            detail_user.save(update_fields=["is_bot"])
            target_id = detail_user.pk
        response = getattr(detail_client, method)(_detail_url(target_id))
        assert response.status_code == 404

    @pytest.mark.parametrize("method", ["get", "patch"])
    @pytest.mark.parametrize("identity", ["anonymous", "regular", "low-role"])
    def test_requires_instance_admin(self, detail_client, detail_user, method, identity):
        if identity == "low-role":
            InstanceAdmin.objects.create(instance=Instance.objects.first(), user=detail_user, role=5)
        detail_client.force_authenticate(user=None if identity == "anonymous" else detail_user)
        response = getattr(detail_client, method)(_detail_url(detail_user.pk))
        assert response.status_code in (401, 403)


ADMIN_ID = "11111111-1111-1111-1111-111111111111"
TARGET_ID = "22222222-2222-2222-2222-222222222222"


def _request(user_id=ADMIN_ID):
    request = MagicMock()
    request.user.id = user_id
    return request


def _target(user_id=TARGET_ID, active=True):
    user = MagicMock()
    user.id = user_id
    user.pk = user_id
    user.is_active = active
    return user


@pytest.fixture
def lookups():
    """Patch the ORM lookups the views use; returns the mocks to configure."""
    with (
        patch.object(views.User.objects, "filter") as users,
        patch.object(views.InstanceAdmin.objects, "filter") as admins,
        patch.object(views.Session.objects, "filter") as sessions,
        patch.object(views, "_user_queryset") as queryset,
        patch.object(views, "serialize_user", side_effect=lambda user: {"id": str(user.id)}),
        patch.object(views, "user_ip", return_value="10.0.0.1"),
    ):
        admins.return_value.exists.return_value = False
        yield {"users": users, "admins": admins, "sessions": sessions, "queryset": queryset}


@pytest.mark.unit
class TestListUsers:
    @pytest.mark.parametrize(
        ("account_type", "expected_admin"),
        [("admin", True), ("user", False)],
    )
    def test_filters_account_type_before_pagination(self, lookups, account_type, expected_admin):
        request = _request()
        request.query_params = {"account_type": account_type, "status": "active", "search": "Taylor"}
        queryset = lookups["queryset"].return_value
        queryset.filter.return_value = queryset
        endpoint = views.InstanceUserEndpoint()

        with patch.object(endpoint, "paginate") as paginate:
            endpoint.get(request)

        assert queryset.filter.call_count == 3
        queryset.filter.assert_any_call(is_active=True)
        queryset.filter.assert_any_call(is_instance_admin=expected_admin)
        assert paginate.call_args.kwargs["queryset"] is queryset

    @pytest.mark.parametrize("account_type", [None, "", "all", "unknown"])
    def test_omitted_or_unknown_account_type_keeps_all_users(self, lookups, account_type):
        request = _request()
        request.query_params = {"account_type": account_type}
        queryset = lookups["queryset"].return_value
        endpoint = views.InstanceUserEndpoint()

        with patch.object(endpoint, "paginate") as paginate:
            endpoint.get(request)

        queryset.filter.assert_not_called()
        assert paginate.call_args.kwargs["queryset"] is queryset


@pytest.mark.unit
class TestDeactivateUser:
    def _post(self, lookups, target, request=None):
        lookups["users"].return_value.first.return_value = target
        lookups["queryset"].return_value.get.return_value = target
        return views.InstanceUserDeactivateEndpoint().post(request or _request(), pk=TARGET_ID)

    def test_deactivates_and_ends_every_session(self, lookups):
        target = _target()
        response = self._post(lookups, target)

        assert response.status_code == 200
        assert target.is_active is False
        # A logout time is what keeps a deactivated account from signing back in with SSO
        assert target.last_logout_time is not None
        target.save.assert_called_once()
        lookups["sessions"].assert_called_once_with(user_id=TARGET_ID)
        lookups["sessions"].return_value.delete.assert_called_once()

    def test_cannot_deactivate_yourself(self, lookups):
        target = _target(user_id=ADMIN_ID)
        response = self._post(lookups, target)

        assert response.status_code == 400
        assert response.data["error_code"] == "CANNOT_DEACTIVATE_SELF"
        target.save.assert_not_called()

    def test_admins_must_lose_admin_access_first(self, lookups):
        lookups["admins"].return_value.exists.return_value = True
        target = _target()
        response = self._post(lookups, target)

        assert response.status_code == 400
        assert response.data["error_code"] == "USER_IS_ADMIN"
        target.save.assert_not_called()
        lookups["sessions"].assert_not_called()

    def test_unknown_user(self, lookups):
        response = self._post(lookups, None)
        assert response.status_code == 404


@pytest.mark.unit
class TestActivateUser:
    def test_reactivates_user(self, lookups):
        target = _target(active=False)
        lookups["users"].return_value.first.return_value = target
        lookups["queryset"].return_value.get.return_value = target

        response = views.InstanceUserActivateEndpoint().post(_request(), pk=TARGET_ID)

        assert response.status_code == 200
        assert target.is_active is True
        target.save.assert_called_once_with(update_fields=["is_active"])

    def test_unknown_user(self, lookups):
        lookups["users"].return_value.first.return_value = None
        response = views.InstanceUserActivateEndpoint().post(_request(), pk=TARGET_ID)
        assert response.status_code == 404


@pytest.mark.unit
@pytest.mark.django_db
class TestUserNotificationPreferences:
    def test_target_isolation_and_partial_merge(self, detail_client, detail_user):
        from plane.utils.notification_preferences import preference_response, update_preferences

        other = User.objects.create(email="notification-other@example.com", username="notification-other")
        before = preference_response(other)
        update_preferences(detail_user, None, None, {"events": {"email": {"mention": False}}})
        url = f"{_detail_url(detail_user.pk)}notification-preferences/"
        assert resolve(url).func.view_class is views.InstanceUserNotificationPreferencesEndpoint
        response = detail_client.patch(url, {"events": {"email": {"comment": False}}}, format="json")
        assert response.status_code == 200
        assert response.data["events"]["email"]["comment"] is False
        assert response.data["events"]["email"]["mention"] is False
        assert detail_client.get(url).data == response.data
        assert preference_response(other) == before
        assert preference_response(detail_client.handler._force_user) == before

    @pytest.mark.parametrize(
        "payload",
        [
            {"user": "someone"},
            {"workspace_id": "anything"},
            {"channels": {"feishu": 1}},
            {"channels": {"unknown": True}},
            {"events": {"email": {"comment": None}}},
            {"events": {"email": {"unknown": True}}},
            [],
        ],
    )
    def test_invalid_payload_is_rejected(self, detail_client, detail_user, payload):
        from plane.db.models.notification_preference import NotificationPreference

        url = f"{_detail_url(detail_user.pk)}notification-preferences/"
        assert detail_client.patch(url, payload, format="json").status_code == 400
        assert not NotificationPreference.objects.filter(user=detail_user).exists()

    def test_scope_and_missing_target(self, detail_client, detail_user):
        url = f"{_detail_url(detail_user.pk)}notification-preferences/"
        assert detail_client.get(url + "?workspace_id=anything").status_code == 400
        assert detail_client.patch(url + "?project_id=anything", {}, format="json").status_code == 400
        assert detail_client.get(f"{_detail_url(uuid4())}notification-preferences/").status_code == 404
        detail_user.is_bot = True
        detail_user.save()
        assert detail_client.get(url).status_code == 404

    def test_regular_user_cannot_read_or_write(self, detail_client, detail_user):
        detail_client.force_authenticate(user=detail_user)
        url = f"{_detail_url(detail_user.pk)}notification-preferences/"
        assert detail_client.get(url).status_code == 403
        assert detail_client.patch(url, {"channels": {"feishu": True}}, format="json").status_code == 403
        detail_client.force_authenticate(user=None)
        assert detail_client.get(url).status_code in (401, 403)
