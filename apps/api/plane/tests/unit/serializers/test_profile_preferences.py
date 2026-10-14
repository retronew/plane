import pytest
from plane.app.serializers.user import ProfileSerializer
from plane.db.models import Profile


@pytest.mark.unit
@pytest.mark.parametrize("shortcut", ["enter", "mod-enter"])
def test_editor_preferences_are_writable(shortcut):
    data = {"comment_submit_shortcut": shortcut, "is_smooth_cursor_enabled": True, "timezone_auto_set": True}
    serializer = ProfileSerializer(data=data, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data == data


@pytest.mark.unit
def test_invalid_submit_shortcut_is_rejected():
    serializer = ProfileSerializer(data={"comment_submit_shortcut": "space"}, partial=True)
    assert not serializer.is_valid()
    assert "comment_submit_shortcut" in serializer.errors


@pytest.mark.unit
def test_new_profile_follows_browser_timezone():
    profile = Profile()
    assert profile.timezone_auto_set is False
    assert profile.comment_submit_shortcut == "enter"
    assert profile.is_smooth_cursor_enabled is False
