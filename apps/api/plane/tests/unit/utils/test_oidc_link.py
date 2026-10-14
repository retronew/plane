# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES
from plane.authentication.views.app import oidc_link

HOST = "http://app.example.com"
USER_ID = "11111111-1111-1111-1111-111111111111"


def _request(user_id=USER_ID, linking_user_id=USER_ID):
    request = MagicMock()
    request.user.is_authenticated = True
    request.user.id = user_id
    request.session = {oidc_link.SESSION_KEY: linking_user_id} if linking_user_id else {}
    return request


def _query(response):
    return parse_qs(urlparse(response.url).query)


@pytest.fixture
def user():
    user = MagicMock()
    user.id = USER_ID
    user.email = "admin@old.example.com"
    with patch.object(oidc_link.User.objects, "get", return_value=user):
        yield user


@pytest.fixture
def provider():
    instance = MagicMock()
    instance.token_data = {"access_token": "at", "id_token": "it"}
    instance.fetch_identity.return_value = ("sub-1", "admin@company.com")
    with patch.object(oidc_link, "OIDCOAuthProvider", return_value=instance):
        yield instance


@pytest.fixture
def accounts():
    with patch.object(oidc_link, "Account") as account:
        account.objects.filter.return_value.first.return_value = None
        yield account


@pytest.fixture
def email_taken():
    queryset = MagicMock()
    queryset.exists.return_value = False
    with patch.object(oidc_link.User.objects, "filter", return_value=queryset):
        yield queryset


@pytest.mark.unit
class TestCompleteOIDCLink:
    def test_links_identity_and_suggests_different_email(self, user, provider, accounts, email_taken):
        response = oidc_link.complete_oidc_link(_request(), "code", host=HOST)

        accounts.objects.update_or_create.assert_called_once()
        kwargs = accounts.objects.update_or_create.call_args.kwargs
        assert kwargs["user"] is user
        assert kwargs["provider_account_id"] == "sub-1"
        assert response.url.startswith(f"{HOST}/settings/profile/general/")
        assert _query(response) == {"oidc_linked": ["1"], "oidc_email": ["admin@company.com"]}

    def test_does_not_suggest_email_used_by_another_account(self, user, provider, accounts, email_taken):
        email_taken.exists.return_value = True
        response = oidc_link.complete_oidc_link(_request(), "code", host=HOST)
        assert _query(response) == {"oidc_linked": ["1"]}

    def test_does_not_suggest_same_email(self, user, provider, accounts, email_taken):
        provider.fetch_identity.return_value = ("sub-1", "admin@old.example.com")
        response = oidc_link.complete_oidc_link(_request(), "code", host=HOST)
        assert _query(response) == {"oidc_linked": ["1"]}

    def test_identity_linked_to_someone_else_is_rejected(self, user, provider, accounts, email_taken):
        other = MagicMock()
        other.user_id = "22222222-2222-2222-2222-222222222222"
        accounts.objects.filter.return_value.first.return_value = other

        response = oidc_link.complete_oidc_link(_request(), "code", host=HOST)

        accounts.objects.update_or_create.assert_not_called()
        assert _query(response)["error_code"] == [str(AUTHENTICATION_ERROR_CODES["OIDC_ACCOUNT_ALREADY_LINKED"])]

    def test_link_must_finish_in_the_session_that_started_it(self, user, provider, accounts, email_taken):
        request = _request(linking_user_id="33333333-3333-3333-3333-333333333333")
        response = oidc_link.complete_oidc_link(request, "code", host=HOST)

        provider.fetch_identity.assert_not_called()
        accounts.objects.update_or_create.assert_not_called()
        assert response.url == HOST
        assert oidc_link.SESSION_KEY not in request.session
