from types import SimpleNamespace
from unittest.mock import patch

import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from plane.license.api.serializers.configuration import InstanceConfigurationSerializer
from plane.license.api.views.configuration import InstanceConfigurationEndpoint
from plane.license.api.views.feishu import (
    InstanceFeishuCheckEndpoint,
    InstanceFeishuEndpoint,
    InstanceFeishuTestEndpoint,
)
from plane.license.models import InstanceConfiguration
from plane.license.utils.encryption import decrypt_data, encrypt_data
from plane.utils.feishu_client import FeishuError
from plane.utils.instance_config_variables.core import feishu_config_variables

pytestmark = pytest.mark.unit

SECRET_KEYS = ("FEISHU_APP_SECRET", "FEISHU_VERIFICATION_TOKEN", "FEISHU_ENCRYPT_KEY")


def request_view(view, method="post", data=None):
    request = getattr(APIRequestFactory(), method)("/api/instances/feishu/", data or {}, format="json")
    force_authenticate(
        request, user=SimpleNamespace(pk="user", is_authenticated=True, is_anonymous=False, user_timezone="UTC")
    )
    with (
        patch.object(view, "check_permissions"),
        patch.object(view, "check_throttles"),
        patch("plane.utils.cache.invalidate_cache_directly"),
    ):
        return view.as_view()(request)


@pytest.mark.parametrize("key", SECRET_KEYS)
def test_feishu_secret_is_never_returned_even_partially(key):
    secret = "very-long-sensitive-feishu-secret"
    row = InstanceConfiguration(key=key, value=encrypt_data(secret), is_encrypted=True)
    result = InstanceConfigurationSerializer(row).data
    assert result["value"] == ""
    assert result["is_configured"] is True
    assert secret not in str(result)


@pytest.mark.parametrize("key", ("FEISHU_ENABLED", "FEISHU_APP_ID", *SECRET_KEYS))
def test_env_managed_configuration_cannot_be_written(settings, key):
    settings.SKIP_ENV_VAR = False
    response = request_view(InstanceConfigurationEndpoint, "patch", {key: "1"})
    assert response.status_code == 400


@pytest.mark.parametrize(
    "data",
    [
        {"FEISHU_ENABLED": "yes"},
        {"FEISHU_APP_ID": "https://evil.test"},
        *({key: value} for key in SECRET_KEYS for value in ([], {}, None, 123, True)),
    ],
)
def test_invalid_configuration_rejected_before_database_write(settings, data):
    settings.SKIP_ENV_VAR = True
    assert request_view(InstanceConfigurationEndpoint, "patch", data).status_code == 400


@pytest.mark.parametrize("key", SECRET_KEYS)
def test_secret_configuration_registered_as_encrypted(key):
    configuration = next(item for item in feishu_config_variables if item["key"] == key)
    assert configuration["is_encrypted"] is True


@pytest.mark.parametrize("key", SECRET_KEYS)
@pytest.mark.parametrize("value", ("", "   ", "replacement-secret"))
def test_secret_patch_preserves_blank_values_and_encrypts_replacements(settings, key, value):
    settings.SKIP_ENV_VAR = True
    original = encrypt_data("saved-secret")
    row = InstanceConfiguration(key=key, value=original, is_encrypted=True)
    with (
        patch.object(InstanceConfiguration.objects, "filter", return_value=[row]),
        patch.object(InstanceConfiguration.objects, "bulk_update") as bulk_update,
        patch("plane.license.api.views.configuration.clear_session_config_cache"),
    ):
        response = request_view(InstanceConfigurationEndpoint, "patch", {key: value})
    assert response.status_code == 200
    assert response.data[0]["value"] == ""
    assert response.data[0]["is_configured"] is True
    if value.strip():
        assert row.value != value
        assert decrypt_data(row.value) == value
        assert bulk_update.call_args.args[0] == [row]
    else:
        assert row.value == original
        assert bulk_update.call_args.args[0] == []


@pytest.mark.parametrize("configured", (False, True))
def test_admin_configuration_reports_callback_status_without_secrets(settings, configured):
    settings.SKIP_ENV_VAR = not configured
    callback_secret = "sensitive-callback-secret" if configured else ""
    with (
        patch(
            "plane.license.api.views.feishu.get_feishu_config",
            return_value=SimpleNamespace(enabled=True, app_id="cli_test", app_secret="app-secret"),
        ),
        patch(
            "plane.license.api.views.feishu.get_feishu_callback_config",
            return_value=SimpleNamespace(verification_token=callback_secret, encrypt_key=callback_secret),
        ),
        patch("plane.license.api.views.feishu.web_url", side_effect=lambda path: f"https://plane.test/{path}"),
        patch("plane.license.api.views.feishu.FeishuBinding.objects.filter") as bindings,
        patch("plane.license.api.views.feishu.FeishuDelivery.objects.filter") as deliveries,
    ):
        bindings.return_value.exists.return_value = False
        deliveries.return_value.order_by.return_value.values.return_value.first.return_value = None
        response = request_view(InstanceFeishuEndpoint, "get")
    assert response.status_code == 200
    assert response.data["verification_token_configured"] is configured
    assert response.data["encrypt_key_configured"] is configured
    assert response.data["managed_by_env"] is configured
    assert response.data["card_callback_url"] == "https://plane.test/api/integrations/feishu/cards/"
    assert "sensitive-callback-secret" not in str(response.data)
    assert "app-secret" not in str(response.data)
    assert "verification_token" not in response.data
    assert "encrypt_key" not in response.data


def test_admin_check_only_validates_app_credentials():
    with (
        patch("plane.license.api.views.feishu.get_feishu_config") as config,
        patch("plane.license.api.views.feishu.get_feishu_callback_config") as callback_config,
        patch("plane.license.api.views.feishu.FeishuClient") as client,
    ):
        response = request_view(InstanceFeishuCheckEndpoint)
    assert response.status_code == 200
    assert response.data == {"success": True}
    client.assert_called_once_with(config.return_value)
    client.return_value.tenant_token.assert_called_once_with()
    callback_config.assert_not_called()


def test_admin_check_sanitizes_provider_errors():
    with (
        patch("plane.license.api.views.feishu.get_feishu_config"),
        patch("plane.license.api.views.feishu.FeishuClient") as client,
    ):
        client.return_value.tenant_token.side_effect = FeishuError("invalid_credentials")
        response = request_view(InstanceFeishuCheckEndpoint)
    assert response.status_code == 400
    assert response.data["code"] == "invalid_credentials"


def test_admin_test_requires_enabled_channel():
    with patch("plane.license.api.views.feishu.get_feishu_config", return_value=SimpleNamespace(enabled=False)):
        response = request_view(InstanceFeishuTestEndpoint)
    assert response.status_code == 400
    assert response.data["code"] == "feishu_disabled"
