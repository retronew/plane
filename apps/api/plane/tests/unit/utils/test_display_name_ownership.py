from unittest.mock import MagicMock, patch

import pytest

from plane.app.serializers.user import UserSerializer
from plane.authentication.adapter.base import Adapter
from plane.db.models import User


@pytest.mark.unit
@pytest.mark.django_db
@pytest.mark.parametrize("name, expected", [("张三", "张三"), ("zhangsan", "zhangsan"), ("", "person")])
def test_oidc_signup_initializes_automatic_name(name, expected):
    adapter = Adapter(MagicMock(), "oidc")
    adapter.user_data = {
        "email": "person@example.com",
        "user": {"display_name": name, "first_name": "Person", "is_password_autoset": True},
    }
    with (
        patch.object(adapter, "_Adapter__check_signup"),
        patch.object(adapter, "check_sync_enabled", return_value=False),
        patch.object(adapter, "save_user_data", side_effect=lambda user: user),
    ):
        adapter.complete_login_or_signup()
    user = User.objects.get(email="person@example.com")
    assert user.display_name == expected
    assert user.is_display_name_custom is False


@pytest.mark.unit
@pytest.mark.django_db
@pytest.mark.parametrize("custom", [True, False])
def test_oidc_sync_preserves_custom_names(custom):
    user = User.objects.create(
        email="sync@example.com", username="sync", display_name="Saved", is_display_name_custom=custom
    )
    adapter = Adapter(MagicMock(), "oidc")
    adapter.user_data = {"email": user.email, "user": {"display_name": "Provider", "first_name": "New"}}
    with (
        patch.object(adapter, "delete_old_avatar"),
        patch.object(adapter, "download_and_upload_avatar", return_value=None),
    ):
        adapter.sync_user_data(user)
    user.refresh_from_db()
    assert user.display_name == ("Saved" if custom else "Provider")
    assert user.first_name == "New"


@pytest.mark.unit
@pytest.mark.django_db
@pytest.mark.parametrize("payload", [{"display_name": "Saved"}, {"display_name": "John Doe"}, {"display_name": "张三"}])
def test_explicit_display_name_patch_claims_ownership(payload):
    user = User.objects.create(
        email="patch@example.com", username="patch", display_name="Saved", is_display_name_custom=False
    )
    serializer = UserSerializer(user, data={**payload, "is_display_name_custom": False}, partial=True)
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    user.refresh_from_db()
    assert user.is_display_name_custom is True
    assert user.display_name == payload["display_name"]


@pytest.mark.unit
@pytest.mark.parametrize("name", ["   ", "x" * 256, "https://example.com"])
def test_invalid_display_name_rejected(name):
    serializer = UserSerializer(data={"display_name": name}, partial=True)
    assert not serializer.is_valid()
    assert "display_name" in serializer.errors


@pytest.mark.unit
@pytest.mark.django_db
def test_unrelated_patch_keeps_automatic_name_and_non_oidc_defaults_are_custom():
    user = User.objects.create(email="normal@example.com", username="normal")
    assert user.display_name == "normal"
    assert user.is_display_name_custom is True
    user.is_display_name_custom = False
    user.save()
    serializer = UserSerializer(user, data={"first_name": "Updated", "is_display_name_custom": True}, partial=True)
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    user.refresh_from_db()
    assert user.is_display_name_custom is False
