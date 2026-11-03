# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import json
import time
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlsplit

import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES, AuthenticationException
from plane.authentication.adapter.oauth import OauthAdapter, ensure_single_oidc_identity
from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
from plane.authentication.utils.oidc_email_bind import OIDCEmailBindAdapter
from plane.authentication.utils import oidc_login_entries as entries
from plane.authentication.utils.oidc_state import SESSION_KEY, consume_oidc_transaction, start_oidc_transaction
from plane.license.api.views.configuration import InstanceConfigurationEndpoint
from plane.license.models import InstanceConfiguration
from plane.db.models import Account, User

pytestmark = pytest.mark.unit
ENTRY = {"id": "team-a", "name": "团队 A", "provider_hint": "飞书组织：成都水月雨科技", "enabled": True}


@pytest.mark.parametrize(
    "raw",
    [
        None,
        [],
        "{}",
        "null",
        "broken",
        "[1]",
        json.dumps([ENTRY, ENTRY]),
        *[
            json.dumps([{**ENTRY, key: value}])
            for key, value in [
                ("id", "a/b"),
                ("id", ""),
                ("name", " "),
                ("name", "a" * 101),
                ("provider_hint", "x\nclient_id=evil"),
                ("provider_hint", ""),
                ("enabled", 1),
                ("enabled", "true"),
                ("icon_url", "javascript:alert(1)"),
                ("icon_url", "//evil.test/a"),
                ("icon_url", "https://user:secret@example.com/a"),
                ("icon_url", "https://example.com/\nx"),
                ("icon_url", "https://example.com:broken/a"),
                ("extra", "client_id"),
            ]
        ],
    ],
)
def test_invalid_entry_configuration(raw):
    with pytest.raises(ValueError):
        entries.parse_login_entries(raw)


def test_unicode_hint_and_safe_icon_are_valid():
    entry = {**ENTRY, "icon_url": "https://example.com/icon.png?size=64"}
    assert entries.parse_login_entries(json.dumps([entry])) == [entry]


def test_public_entries_include_disabled_but_never_hint():
    with patch.object(entries, "get_login_entries", return_value=[ENTRY, {**ENTRY, "id": "b", "enabled": False}]):
        assert entries.public_login_entries() == [
            {"id": "team-a", "name": "团队 A", "enabled": True},
            {"id": "b", "name": "团队 A", "enabled": False},
        ]


@pytest.mark.parametrize(
    "configured, entry_id, expected", [([], None, None), ([ENTRY], "team-a", ENTRY["provider_hint"])]
)
def test_resolve_allowed_entry(configured, entry_id, expected):
    with patch.object(entries, "get_login_entries", return_value=configured):
        assert entries.resolve_provider_hint(entry_id) == expected


@pytest.mark.parametrize(
    "configured, entry_id",
    [([], "unknown"), ([ENTRY], None), ([ENTRY], "unknown"), ([{**ENTRY, "enabled": False}], "team-a"), ([], "")],
)
def test_invalid_disabled_or_missing_entry_never_falls_back(configured, entry_id):
    with patch.object(entries, "get_login_entries", return_value=configured):
        with pytest.raises(AuthenticationException) as exc:
            entries.resolve_provider_hint(entry_id)
    assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_LOGIN_ENTRY_INVALID"]


def test_authorization_query_preserves_discovery_and_protects_protocol_parameters():
    request = MagicMock()
    request.is_secure.return_value = True
    request.get_host.return_value = "plane.test"
    discovery = {
        "authorization_endpoint": "https://idp.test/auth?tenant=one&state=evil&client_id=evil&provider_hint=evil",
        "token_endpoint": "https://idp.test/token",
        "userinfo_endpoint": "https://idp.test/userinfo",
    }
    with (
        patch.object(entries, "get_login_entries", return_value=[ENTRY]),
        patch(
            "plane.authentication.provider.oauth.oidc.get_configuration_value",
            return_value=("https://idp.test", "client", "secret", "0"),
        ),
        patch("plane.authentication.provider.oauth.oidc.requests.get") as get,
    ):
        get.return_value.json.return_value = discovery
        provider = OIDCOAuthProvider(request, state="safe", entry="team-a")
    query = parse_qs(urlsplit(provider.get_auth_url()).query)
    assert query["tenant"] == ["one"]
    assert query["client_id"] == ["client"]
    assert query["state"] == ["safe"]
    assert query["provider_hint"] == [ENTRY["provider_hint"]]
    assert query["redirect_uri"] == ["https://plane.test/auth/oidc/callback/"]


def test_two_states_keep_their_context_and_are_single_use():
    request = SimpleNamespace(session={})
    first = start_oidc_transaction(request, host="https://app.test", next_path="/a", purpose="link", user_id="u")
    second = start_oidc_transaction(request, host="https://space.test", next_path="/b", audience="space")
    stale_session = dict(request.session)
    linked = consume_oidc_transaction(request, first, audience="app")
    assert linked["purpose"] == "link" and linked["user_id"] == "u" and linked["next_path"] == "/a"
    assert second in request.session[SESSION_KEY]
    assert consume_oidc_transaction(request, first, audience="app") is None
    # Even an overlapping callback with an old session snapshot cannot replay the state.
    assert consume_oidc_transaction(SimpleNamespace(session=stale_session), first, audience="app") is None
    assert consume_oidc_transaction(request, second, audience="space")["next_path"] == "/b"


def test_state_requires_matching_audience_and_expiry():
    request = SimpleNamespace(session={})
    state = start_oidc_transaction(request, host="https://app.test")
    assert consume_oidc_transaction(request, state, audience="admin") is None
    state = start_oidc_transaction(request, host="https://app.test")
    request.session[SESSION_KEY][state]["created"] = time.time() - 601
    assert consume_oidc_transaction(request, state, audience="app") is None
    assert consume_oidc_transaction(request, None, audience="app") is None


def config_patch(data):
    view = InstanceConfigurationEndpoint
    request = APIRequestFactory().patch("/api/instances/configurations/", data, format="json")
    force_authenticate(
        request, user=SimpleNamespace(pk="admin", is_authenticated=True, is_anonymous=False, user_timezone="UTC")
    )
    with (
        patch.object(view, "check_permissions"),
        patch.object(view, "check_throttles"),
        patch("plane.utils.cache.invalidate_cache_directly"),
    ):
        return view.as_view()(request)


@pytest.mark.django_db
def test_configuration_patch_creates_missing_key_and_rejects_invalid_updates():
    InstanceConfiguration.objects.filter(key="OIDC_LOGIN_ENTRIES").delete()
    value = json.dumps([ENTRY])
    assert config_patch({"OIDC_LOGIN_ENTRIES": value}).status_code == 200
    assert InstanceConfiguration.objects.get(key="OIDC_LOGIN_ENTRIES").value == value
    assert config_patch({"OIDC_LOGIN_ENTRIES": json.dumps([ENTRY, ENTRY])}).status_code == 400
    assert InstanceConfiguration.objects.get(key="OIDC_LOGIN_ENTRIES").value == value


@pytest.mark.django_db
def test_single_identity_guard_allows_same_sub_and_rejects_second():
    user = User.objects.create(email="one-oidc@example.com", username="oidc-one")
    Account.objects.create(user=user, provider="oidc", provider_account_id="original", access_token="")
    ensure_single_oidc_identity(user, "original")
    with pytest.raises(AuthenticationException) as exc:
        ensure_single_oidc_identity(user, "second")
    assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_IDENTITY_ALREADY_BOUND"]
    assert list(Account.objects.filter(user=user, provider="oidc").values_list("provider_account_id", flat=True)) == [
        "original"
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("email_bind", [False, True])
def test_login_and_email_verification_reject_second_identity_before_user_workflow(email_bind):
    user = User.objects.create(email="single@example.com", username="single")
    Account.objects.create(user=user, provider="oidc", provider_account_id="first", access_token="")
    pending = {"user": {"provider_id": "second"}, "token_data": {}}
    adapter = OIDCEmailBindAdapter(SimpleNamespace(), pending, user.email)
    if not email_bind:
        adapter = OauthAdapter(SimpleNamespace(), "oidc", None, None, None, None, None, None)
        adapter.user_data = {"email": user.email, "user": {"provider_id": "second"}}
    with patch("plane.authentication.adapter.base.Adapter.complete_login_or_signup") as workflow:
        with pytest.raises(AuthenticationException) as exc:
            adapter.complete_login_or_signup()
    assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_IDENTITY_ALREADY_BOUND"]
    workflow.assert_not_called()


@pytest.mark.parametrize("surface", ["app", "space", "admin", "link"])
def test_every_initiation_passes_only_the_selected_entry(surface):
    from plane.authentication.views.app import oidc as app_oidc, oidc_link
    from plane.authentication.views.space import oidc as space_oidc
    from plane.license.api.views import admin_sso

    modules = {
        "app": (app_oidc, app_oidc.OIDCOauthInitiateEndpoint),
        "space": (space_oidc, space_oidc.OIDCOauthInitiateSpaceEndpoint),
        "admin": (admin_sso, admin_sso.InstanceAdminOIDCInitiateEndpoint),
        "link": (oidc_link, oidc_link.OIDCLinkInitiateEndpoint),
    }
    module, endpoint = modules[surface]
    request = SimpleNamespace(
        GET={"entry": "team-a", "provider_hint": "attacker", "client_id": "attacker"},
        session={},
        user=SimpleNamespace(is_authenticated=True, id="user"),
    )
    with (
        patch.object(module, "base_host", return_value="https://plane.test/"),
        patch.object(module, "OIDCOAuthProvider") as provider,
    ):
        provider.return_value.get_auth_url.return_value = "https://idp.test/auth"
        if surface == "link":
            response = endpoint().get(request)
        else:
            with patch.object(module.Instance.objects, "first", return_value=SimpleNamespace(is_setup_done=True)):
                response = endpoint().get(request)
    assert response.url == "https://idp.test/auth"
    assert provider.call_args.kwargs["entry"] == "team-a"
    assert "provider_hint" not in provider.call_args.kwargs
    if surface == "space":
        assert provider.call_args.kwargs["redirect_path"] == "/auth/spaces/oidc/callback/"
    pending = next(iter(request.session[SESSION_KEY].values()))
    assert pending["purpose"] == ("link" if surface == "link" else "login")
    assert pending["audience"] == (surface if surface in {"space", "admin"} else "app")


@pytest.mark.django_db
def test_profile_relink_replaces_identity_and_preserves_previous_on_foreign_claim():
    from plane.authentication.views.app import oidc_link

    user = User.objects.create(email="relink@example.com", username="relink")
    other = User.objects.create(email="foreign@example.com", username="foreign")
    Account.objects.create(user=user, provider="oidc", provider_account_id="previous", access_token="")
    Account.objects.create(user=other, provider="oidc", provider_account_id="foreign", access_token="")
    request = SimpleNamespace(user=user, session={})
    with patch.object(oidc_link, "OIDCOAuthProvider") as provider:
        provider.return_value.token_data = {}
        provider.return_value.fetch_identity.return_value = ("replacement", None)
        response = oidc_link.complete_oidc_link(request, "code", "https://plane.test", user_id=str(user.pk))
        assert "oidc_linked=1" in response.url
        provider.return_value.fetch_identity.return_value = ("foreign", None)
        response = oidc_link.complete_oidc_link(request, "code", "https://plane.test", user_id=str(user.pk))
    assert str(AUTHENTICATION_ERROR_CODES["OIDC_ACCOUNT_ALREADY_LINKED"]) in response.url
    assert list(Account.objects.filter(user=user, provider="oidc").values_list("provider_account_id", flat=True)) == [
        "replacement"
    ]


@pytest.mark.django_db
def test_admin_email_fallback_rejects_other_oidc_identity():
    from plane.license.api.views.admin_sso import resolve_admin_user

    user = User.objects.create(email="admin-single@example.com", username="admin-single")
    Account.objects.create(user=user, provider="oidc", provider_account_id="bound-admin", access_token="")
    with pytest.raises(AuthenticationException) as exc:
        resolve_admin_user("other-admin", user.email)
    assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_IDENTITY_ALREADY_BOUND"]


def test_oidc_account_persistence_conflict_is_not_silently_accepted():
    from django.db import IntegrityError

    adapter = OauthAdapter(SimpleNamespace(), "oidc", None, None, None, None, None, None)
    adapter.user_data = {"user": {"provider_id": "sub"}}
    with patch.object(Account.objects, "filter", side_effect=IntegrityError("conflict")):
        with pytest.raises(AuthenticationException):
            adapter.create_update_account(SimpleNamespace())


@pytest.mark.parametrize("surface", ["app", "space"])
def test_callback_requires_owned_state_and_consumes_it_once(surface):
    from plane.authentication.views.app import oidc as app_oidc
    from plane.authentication.views.space import oidc as space_oidc

    module = app_oidc if surface == "app" else space_oidc
    endpoint = module.OIDCCallbackEndpoint if surface == "app" else module.OIDCCallbackSpaceEndpoint
    request = SimpleNamespace(session={}, GET={})
    first = start_oidc_transaction(request, host="https://plane.test/", audience=surface, next_path="/first/")
    second = start_oidc_transaction(request, host="https://plane.test/", audience=surface, next_path="/second/")
    request.GET = {"state": first, "code": "code"}
    with (
        patch.object(module, "OIDCOAuthProvider") as provider,
        patch.object(module, "base_host", return_value="https://plane.test/"),
        patch.object(module, "user_login") as login,
    ):
        assert endpoint().get(request).url == "https://plane.test/first/"
        assert second in request.session[SESSION_KEY]
        if surface == "space":
            assert provider.call_args.kwargs["redirect_path"] == "/auth/spaces/oidc/callback/"
        provider.reset_mock()
        response = endpoint().get(request)
        assert str(AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"]) in response.url
        provider.assert_not_called()
        request.GET = {"state": second, "code": "code"}
        assert endpoint().get(request).url == "https://plane.test/second/"
        assert login.call_count == 2


@pytest.mark.django_db
def test_relink_race_rolls_back_previous_identity():
    from django.db import IntegrityError
    from plane.authentication.views.app import oidc_link

    user = User.objects.create(email="race@example.com", username="race")
    Account.objects.create(user=user, provider="oidc", provider_account_id="before-race", access_token="")
    request = SimpleNamespace(user=user, session={})
    with (
        patch.object(oidc_link, "OIDCOAuthProvider") as provider,
        patch.object(Account.objects, "update_or_create", side_effect=IntegrityError("claim race")),
    ):
        provider.return_value.token_data = {}
        provider.return_value.fetch_identity.return_value = ("after-race", None)
        response = oidc_link.complete_oidc_link(request, "code", "https://plane.test/", user_id=str(user.pk))
    assert str(AUTHENTICATION_ERROR_CODES["OIDC_ACCOUNT_ALREADY_LINKED"]) in response.url
    assert Account.objects.filter(user=user, provider_account_id="before-race").exists()


@pytest.mark.django_db
def test_admin_first_email_login_persists_identity_and_rejects_second_sub():
    from django.utils import timezone
    from plane.license.models import Instance, InstanceAdmin
    from plane.license.api.views.admin_sso import resolve_admin_user

    user = User.objects.create(email="first-admin@example.com", username="first-admin")
    instance = Instance.objects.create(
        instance_name="SSO test",
        instance_id="oidc-admin-persistence",
        current_version="test",
        last_checked_at=timezone.now(),
        is_setup_done=True,
    )
    InstanceAdmin.objects.create(instance=instance, user=user)
    token_data = {"access_token": "test-access", "id_token": "test-id"}
    assert resolve_admin_user("admin-A", user.email, token_data=token_data) == user
    account = Account.objects.get(user=user, provider="oidc")
    assert account.provider_account_id == "admin-A"
    assert account.access_token == "test-access"
    assert account.id_token == "test-id"
    assert resolve_admin_user("admin-A", None) == user
    with pytest.raises(AuthenticationException) as exc:
        resolve_admin_user("admin-B", user.email)
    assert exc.value.error_code == AUTHENTICATION_ERROR_CODES["OIDC_IDENTITY_ALREADY_BOUND"]
    assert Account.objects.filter(user=user, provider="oidc").count() == 1
    account.refresh_from_db()
    assert account.provider_account_id == "admin-A"


@pytest.mark.django_db
@pytest.mark.parametrize("active, bot", [(True, False), (False, False), (True, True)])
def test_ineligible_admin_email_fallback_does_not_create_identity(active, bot):
    from plane.license.api.views.admin_sso import resolve_admin_user

    user = User.objects.create(
        email="ineligible-admin@example.com",
        username="ineligible-admin",
        is_active=active,
        is_bot=bot,
    )
    assert resolve_admin_user("unclaimed-admin", user.email) is None
    assert not Account.objects.filter(user=user, provider="oidc").exists()
