# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import MagicMock, patch

import pytest

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES, AuthenticationException
from plane.authentication.provider.oauth.oidc import OIDCEmailMissing, OIDCOAuthProvider, large_avatar_url

ISSUER = "https://auth.example.com"
DISCOVERY = {
    "authorization_endpoint": f"{ISSUER}/login/oauth/authorize",
    "token_endpoint": f"{ISSUER}/api/login/oauth/access_token",
    "userinfo_endpoint": f"{ISSUER}/api/userinfo",
}


def _config(trust_email="0", issuer=ISSUER):
    return (issuer, "client-id", "client-secret", trust_email)


def _request():
    request = MagicMock()
    request.is_secure.return_value = True
    request.get_host.return_value = "plane.example.com"
    return request


def _discovery_response(payload=DISCOVERY):
    response = MagicMock()
    response.json.return_value = payload
    return response


def _linked_account(email=None):
    """Patch the Account lookup used to find an already linked OIDC identity."""
    account = MagicMock()
    account.user.email = email
    queryset = MagicMock()
    queryset.select_related.return_value.first.return_value = account if email else None
    return patch("plane.authentication.provider.oauth.oidc.Account.objects.filter", return_value=queryset)


@pytest.fixture(autouse=True)
def no_linked_account():
    with _linked_account() as mock_filter:
        yield mock_filter


@pytest.mark.unit
class TestOIDCOAuthProvider:
    @patch("plane.authentication.provider.oauth.oidc.requests.get")
    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_endpoints_resolved_from_discovery(self, mock_config, mock_get):
        mock_config.return_value = _config()
        mock_get.return_value = _discovery_response()

        provider = OIDCOAuthProvider(request=_request(), state="abc")

        mock_get.assert_called_once_with(f"{ISSUER}/.well-known/openid-configuration", timeout=10)
        assert provider.token_url == DISCOVERY["token_endpoint"]
        assert provider.userinfo_url == DISCOVERY["userinfo_endpoint"]
        auth_url = provider.get_auth_url()
        assert auth_url.startswith(DISCOVERY["authorization_endpoint"] + "?")
        assert "redirect_uri=https%3A%2F%2Fplane.example.com%2Fauth%2Foidc%2Fcallback%2F" in auth_url
        assert "scope=openid+email+profile" in auth_url

    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_missing_config_raises_not_configured(self, mock_config):
        mock_config.return_value = (None, "client-id", "client-secret", "0")
        with pytest.raises(AuthenticationException) as exc:
            OIDCOAuthProvider(request=_request())
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"]

    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_non_http_issuer_rejected(self, mock_config):
        mock_config.return_value = _config(issuer="file:///etc/passwd")
        with pytest.raises(AuthenticationException) as exc:
            OIDCOAuthProvider(request=_request())
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"]

    @patch("plane.authentication.provider.oauth.oidc.requests.get")
    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_incomplete_discovery_raises_provider_error(self, mock_config, mock_get):
        mock_config.return_value = _config()
        mock_get.return_value = _discovery_response({"authorization_endpoint": "x"})
        with pytest.raises(AuthenticationException) as exc:
            OIDCOAuthProvider(request=_request())
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"]

    def _provider(self, mock_config, mock_get, trust_email="0"):
        mock_config.return_value = _config(trust_email=trust_email)
        mock_get.return_value = _discovery_response()
        return OIDCOAuthProvider(request=_request(), code="code")

    @patch("plane.authentication.provider.oauth.oidc.requests.get")
    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_verified_email_maps_user_fields(self, mock_config, mock_get):
        provider = self._provider(mock_config, mock_get)
        userinfo = {
            "sub": "user-1",
            "email": "zhang.san@example.com",
            "email_verified": True,
            "name": "张三",
            "preferred_username": "zhangsan",
            "picture": "https://cdn.example.com/a.png",
        }
        with patch.object(provider, "get_user_response", return_value=userinfo):
            provider.set_user_data()

        data = provider.user_data
        assert data["email"] == "zhang.san@example.com"
        assert data["user"]["provider_id"] == "user-1"
        assert data["user"]["display_name"] == "张三"
        assert data["user"]["first_name"] == "张三"
        assert data["user"]["avatar"] == "https://cdn.example.com/a.png"

    @patch("plane.authentication.provider.oauth.oidc.requests.get")
    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_unverified_email_rejected_by_default(self, mock_config, mock_get):
        provider = self._provider(mock_config, mock_get)
        userinfo = {"sub": "user-1", "email": "victim@example.com"}
        with patch.object(provider, "get_user_response", return_value=userinfo):
            with pytest.raises(AuthenticationException) as exc:
                provider.set_user_data()
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OAUTH_PROVIDER_UNVERIFIED_EMAIL"]

    @patch("plane.authentication.provider.oauth.oidc.requests.get")
    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_unverified_email_accepted_when_trusted(self, mock_config, mock_get):
        provider = self._provider(mock_config, mock_get, trust_email="1")
        userinfo = {"sub": "user-1", "email": "li.si@example.com", "preferred_username": "lisi"}
        with patch.object(provider, "get_user_response", return_value=userinfo):
            provider.set_user_data()
        assert provider.user_data["email"] == "li.si@example.com"
        assert provider.user_data["user"]["display_name"] == "lisi"

    @patch("plane.authentication.provider.oauth.oidc.requests.get")
    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_missing_email_asks_user_to_bind_one(self, mock_config, mock_get):
        provider = self._provider(mock_config, mock_get, trust_email="1")
        provider.token_data = {"access_token": "at"}
        userinfo = {"sub": "user-1", "name": "孔维维"}
        with patch.object(provider, "get_user_response", return_value=userinfo):
            with pytest.raises(OIDCEmailMissing) as exc:
                provider.set_user_data()
        assert exc.value.user["provider_id"] == "user-1"
        assert exc.value.user["display_name"] == "孔维维"
        assert exc.value.token_data == {"access_token": "at"}

    @patch("plane.authentication.provider.oauth.oidc.requests.get")
    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_missing_email_and_sub_is_provider_error(self, mock_config, mock_get):
        provider = self._provider(mock_config, mock_get)
        with patch.object(provider, "get_user_response", return_value={}):
            with pytest.raises(AuthenticationException) as exc:
                provider.set_user_data()
        assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"]

    @patch("plane.authentication.provider.oauth.oidc.requests.get")
    @patch("plane.authentication.provider.oauth.oidc.get_configuration_value")
    def test_linked_identity_uses_bound_email(self, mock_config, mock_get):
        provider = self._provider(mock_config, mock_get)
        # Neither a missing nor an unverified IdP email matters once the sub is linked
        userinfo = {"sub": "user-1", "email": "other@example.com"}
        with _linked_account("bound@example.com"):
            with patch.object(provider, "get_user_response", return_value=userinfo):
                provider.set_user_data()
        assert provider.user_data["email"] == "bound@example.com"
        assert provider.user_data["user"]["provider_id"] == "user-1"


@pytest.mark.unit
class TestLargeAvatarURL:
    def test_lark_thumbnail_is_upsized(self):
        url = (
            "https://s3-imfile.feishucdn.com/static-resource/v1/v3_abc~"
            "?image_size=72x72&cut_type=&quality=&format=image&sticker_format=.webp"
        )
        assert large_avatar_url(url) == (
            "https://s3-imfile.feishucdn.com/static-resource/v1/v3_abc~"
            "?image_size=640x640&cut_type=&quality=&format=image&sticker_format=.webp"
        )

    @pytest.mark.parametrize(
        "url",
        [
            None,
            "",
            "https://cdn.example.com/a.png?image_size=72x72",
            "https://s3-imfile.feishucdn.com/static-resource/v1/v3_abc~",
            "https://evil-feishucdn.com/a.png?image_size=72x72",
        ],
    )
    def test_other_urls_untouched(self, url):
        assert large_avatar_url(url) == url
