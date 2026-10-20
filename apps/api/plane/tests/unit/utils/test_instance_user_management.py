# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import MagicMock, patch

import pytest

from plane.license.api.views import user as views

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
