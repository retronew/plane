# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from plane.license.api.views import admin as views


@pytest.fixture
def admin_lookups():
    with (
        patch.object(views.Instance.objects, "first") as instance,
        patch.object(views.User.objects, "filter") as users,
        patch.object(views.InstanceAdmin.objects, "filter") as admins,
        patch.object(views.InstanceAdmin.all_objects, "filter") as all_admins,
        patch.object(views.InstanceAdmin.objects, "create") as create_admin,
        patch.object(views, "InstanceAdminSerializer") as serializer,
        patch("plane.utils.cache.invalidate_cache_directly"),
    ):
        admins.return_value.exists.return_value = False
        all_admins.return_value.first.return_value = None
        serializer.return_value.data = {"id": "admin-id"}
        yield SimpleNamespace(
            instance=instance.return_value,
            users=users,
            admins=admins,
            all_admins=all_admins,
            create_admin=create_admin,
            serializer=serializer,
        )


def _request(data=None, user_id="acting-admin"):
    return SimpleNamespace(data=data or {}, user=SimpleNamespace(id=user_id))


@pytest.mark.unit
class TestPromoteInstanceAdmin:
    def test_restores_revoked_admin_with_requested_role(self, admin_lookups):
        revoked = MagicMock(deleted_at=timezone.now(), role=10, is_verified=False)
        admin_lookups.all_admins.return_value.first.return_value = revoked

        response = views.InstanceAdminEndpoint().post(_request({"email": " Person@example.com ", "role": 20}))

        assert response.status_code == 201
        assert response.data == {"id": "admin-id"}
        admin_lookups.users.assert_called_once_with(email="person@example.com", is_active=True, is_bot=False)
        admin_lookups.all_admins.assert_called_once_with(
            instance=admin_lookups.instance, user=admin_lookups.users.return_value.first.return_value
        )
        assert revoked.deleted_at is None
        assert revoked.role == 20
        assert revoked.is_verified is True
        revoked.save.assert_called_once_with(update_fields=["deleted_at", "role", "is_verified"])
        admin_lookups.create_admin.assert_not_called()
        admin_lookups.serializer.assert_called_once_with(revoked)

    def test_creates_first_admin_grant(self, admin_lookups):
        response = views.InstanceAdminEndpoint().post(_request({"email": "person@example.com"}))

        assert response.status_code == 201
        admin_lookups.create_admin.assert_called_once_with(
            instance=admin_lookups.instance,
            user=admin_lookups.users.return_value.first.return_value,
            role=20,
            is_verified=True,
        )
        admin_lookups.serializer.assert_called_once_with(admin_lookups.create_admin.return_value)

    def test_active_admin_is_rejected_without_changing_grant(self, admin_lookups):
        admin_lookups.admins.return_value.exists.return_value = True

        response = views.InstanceAdminEndpoint().post(_request({"email": "person@example.com"}))

        assert response.status_code == 400
        assert response.data["error_code"] == "ALREADY_ADMIN"
        admin_lookups.all_admins.assert_not_called()
        admin_lookups.create_admin.assert_not_called()

    def test_missing_active_user_does_not_restore_grant(self, admin_lookups):
        admin_lookups.users.return_value.first.return_value = None

        response = views.InstanceAdminEndpoint().post(_request({"email": "person@example.com"}))

        assert response.status_code == 400
        assert response.data["error_code"] == "USER_NOT_FOUND"
        admin_lookups.all_admins.assert_not_called()
        admin_lookups.create_admin.assert_not_called()


@pytest.mark.unit
class TestRevokeInstanceAdmin:
    def test_cannot_remove_self(self, admin_lookups):
        target = admin_lookups.admins.return_value.first.return_value
        target.user_id = "acting-admin"

        response = views.InstanceAdminEndpoint().delete(_request(), pk="admin-id")

        assert response.status_code == 400
        assert response.data["error_code"] == "CANNOT_REMOVE_SELF"
        target.delete.assert_not_called()

    def test_cannot_remove_last_admin(self, admin_lookups):
        target = admin_lookups.admins.return_value.first.return_value
        target.user_id = "other-admin"
        admin_lookups.admins.return_value.count.return_value = 1

        response = views.InstanceAdminEndpoint().delete(_request(), pk="admin-id")

        assert response.status_code == 400
        assert response.data["error_code"] == "LAST_ADMIN"
        target.delete.assert_not_called()

    def test_revokes_another_admin(self, admin_lookups):
        target = admin_lookups.admins.return_value.first.return_value
        target.user_id = "other-admin"
        admin_lookups.admins.return_value.count.return_value = 2

        response = views.InstanceAdminEndpoint().delete(_request(), pk="admin-id")

        assert response.status_code == 204
        target.delete.assert_called_once_with()


@pytest.mark.unit
@pytest.mark.django_db
def test_revoke_then_promote_reuses_existing_admin_record():
    """Exercise the real soft-delete manager and the instance/user unique constraint."""
    instance = views.Instance.objects.create(
        instance_name="Test", instance_id="admin-regrant", current_version="test", last_checked_at=timezone.now()
    )
    user = views.User.objects.create(email="regrant@example.com", username="regrant")
    original = views.InstanceAdmin.objects.create(instance=instance, user=user, is_verified=False)
    endpoint = views.InstanceAdminEndpoint()

    with (
        patch("plane.utils.cache.invalidate_cache_directly"),
        patch("plane.db.mixins.soft_delete_related_objects.delay"),
    ):
        # The acting admin is distinct so the existing self-removal guard applies normally.
        views.InstanceAdmin.objects.create(
            instance=instance,
            user=views.User.objects.create(email="acting@example.com", username="acting"),
        )
        revoked = endpoint.delete(_request(), pk=original.pk)
        assert revoked.status_code == 204
        assert not views.InstanceAdmin.objects.filter(pk=original.pk).exists()
        assert views.InstanceAdmin.all_objects.filter(pk=original.pk).exists()

        response = endpoint.post(_request({"email": user.email}))
        assert response.status_code == 201
        assert str(response.data["id"]) == str(original.pk)
        original.refresh_from_db()
        assert original.deleted_at is None
        assert original.role == 20
        assert original.is_verified is True
        assert views.InstanceAdmin.objects.filter(instance=instance, user=user).count() == 1
        assert views.InstanceAdmin.all_objects.filter(instance=instance, user=user).count() == 1

        duplicate = endpoint.post(_request({"email": user.email}))
        assert duplicate.status_code == 400
        assert duplicate.data["error_code"] == "ALREADY_ADMIN"
