from pathlib import Path
from unittest.mock import patch

import pytest
from django.test import override_settings

from plane.db.models import Workspace
from plane.utils.server_timezone import detect_server_timezone

pytestmark = pytest.mark.unit


@pytest.mark.parametrize("value", ["Asia/Shanghai", ":Asia/Shanghai", ":/usr/share/zoneinfo/Asia/Shanghai"])
def test_detect_timezone_from_environment(monkeypatch, value):
    monkeypatch.setenv("TZ", value)
    with (
        patch.object(Path, "read_text", return_value="Europe/Paris"),
        patch.object(Path, "resolve", return_value=Path("/etc/localtime")),
    ):
        assert detect_server_timezone() == "Asia/Shanghai"


@pytest.mark.parametrize("value", ["", "Invalid/Timezone", "CST"])
def test_invalid_environment_uses_timezone_file(monkeypatch, value):
    monkeypatch.setenv("TZ", value)
    with (
        patch.object(Path, "read_text", return_value="Europe/Paris\n"),
        patch.object(Path, "resolve", return_value=Path("/etc/localtime")),
    ):
        assert detect_server_timezone() == "Europe/Paris"


def test_localtime_symlink(monkeypatch):
    monkeypatch.delenv("TZ", raising=False)
    with (
        patch.object(Path, "read_text", side_effect=FileNotFoundError),
        patch.object(Path, "resolve", return_value=Path("/usr/share/zoneinfo/Asia/Tokyo")),
    ):
        assert detect_server_timezone() == "Asia/Tokyo"


def test_missing_server_configuration_falls_back_to_utc(monkeypatch):
    monkeypatch.delenv("TZ", raising=False)
    with (
        patch.object(Path, "read_text", side_effect=PermissionError),
        patch.object(Path, "resolve", side_effect=OSError),
    ):
        assert detect_server_timezone() == "UTC"


@override_settings(DEFAULT_TIMEZONE="Asia/Shanghai")
def test_workspace_default_and_explicit_timezone():
    assert Workspace().timezone == "Asia/Shanghai"
    assert Workspace(timezone="UTC").timezone == "UTC"
