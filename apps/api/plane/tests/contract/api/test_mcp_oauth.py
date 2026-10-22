"""OAuth boundaries tested through real Django endpoints and MCP gateway."""

import base64
import hashlib
import json
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from django.core.cache import cache
from django.test import Client
from django.utils import timezone

from plane.db.models import MCPOAuthClient, MCPOAuthGrant, MCPOAuthToken, Workspace, WorkspaceMember
from plane.mcp.gateway import ApiGateway
from plane.mcp.oauth import digest

pytestmark = [pytest.mark.contract, pytest.mark.django_db]
ORIGIN = "https://plane.test"
REDIRECT = "http://127.0.0.1:43210/callback"
VERIFIER = "a" * 64
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).decode().rstrip("=")


@pytest.fixture(autouse=True)
def config(settings):
    settings.MCP_OAUTH_ISSUER = ORIGIN
    settings.APP_BASE_URL = "http://localhost:3000"
    cache.clear()


def consent_page(browser, params):
    response = browser.get("/auth/mcp/authorize/", params)
    assert response.status_code == 302
    target = urlsplit(response["Location"])
    assert target.netloc == "localhost:3000" and target.path == "/mcp-connect"
    flow_id = parse_qs(target.query)["consent"][0]
    return browser.get("/auth/mcp/consent/", {"flow": flow_id})


@pytest.fixture
def flow(create_user, workspace):
    browser = Client()
    browser.force_login(create_user)
    registration = browser.post(
        "/auth/mcp/register/",
        json.dumps(
            {
                "client_name": "Local test client",
                "redirect_uris": [REDIRECT],
            }
        ),
        content_type="application/json",
    )
    assert registration.status_code == 201
    client_id = registration.json()["client_id"]
    params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "response_type": "code",
        "code_challenge": CHALLENGE,
        "code_challenge_method": "S256",
        "resource": ORIGIN + "/mcp",
        "scope": "plane:read plane:write",
        "state": "preserved-state",
    }

    def consent(*, write=False, overrides=None):
        response = consent_page(browser, {**params, **(overrides or {})})
        assert response.status_code == 200, response.content
        result = browser.post(
            "/auth/mcp/authorize/",
            {
                "ticket": response.json()["ticket"],
                "decision": "allow",
                "workspace": workspace.slug,
                "write": "yes" if write else "no",
            },
        )
        assert result.status_code == 302
        query = parse_qs(urlsplit(result["Location"]).query)
        assert query["state"] == ["preserved-state"]
        assert query["iss"] == [ORIGIN]
        return query["code"][0]

    def exchange(code=None, **overrides):
        return browser.post(
            "/auth/mcp/token/",
            {
                "grant_type": "authorization_code",
                "client_id": client_id,
                "resource": ORIGIN + "/mcp",
                "redirect_uri": REDIRECT,
                "code": code or consent(),
                "code_verifier": VERIFIER,
                **overrides,
            },
        )

    return browser, params, consent, exchange


def call_mcp(client, token, method="tools/call", arguments=None):
    return client.post(
        "/mcp",
        json.dumps(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": method,
                "params": {"name": "workspace", "arguments": arguments or {"action": "list"}},
            }
        ),
        content_type="application/json",
        HTTP_AUTHORIZATION="Bearer " + token,
    )


def test_discovery_and_401():
    client = Client()
    metadata = client.get("/.well-known/oauth-authorization-server").json()
    assert metadata["code_challenge_methods_supported"] == ["S256"]
    assert metadata["token_endpoint_auth_methods_supported"] == ["none"]
    assert metadata["registration_endpoint"] == ORIGIN + "/auth/mcp/register/"
    assert client.get("/.well-known/oauth-protected-resource/mcp").json()["resource"] == ORIGIN + "/mcp"
    response = call_mcp(client, "")
    assert response.status_code == 401
    assert ORIGIN + "/.well-known/oauth-protected-resource" in response["WWW-Authenticate"]


@pytest.mark.parametrize(
    "uri",
    [
        "javascript:alert(1)",
        "http://example.com/cb",
        "https://user:pass@host/cb",
        "https://host/cb#x",
        "https://host/\\bad",
        "//host/cb",
        "https://host:bad/cb",
        "https://host/cb\n",
    ],
)
def test_dcr_rejects_unsafe_redirects(uri):
    result = Client().post("/auth/mcp/register/", json.dumps({"redirect_uris": [uri]}), content_type="application/json")
    assert result.status_code == 400
    assert not MCPOAuthClient.objects.exists()


def test_registration_rate_limit():
    client = Client()
    for _ in range(10):
        assert (
            client.post(
                "/auth/mcp/register/", json.dumps({"redirect_uris": [REDIRECT]}), content_type="application/json"
            ).status_code
            == 201
        )
    assert client.post("/auth/mcp/register/", "{}", content_type="application/json").status_code == 429


def test_consent_login_deny_csrf_and_account_binding(flow, create_user):
    browser, params, _, _ = flow
    anonymous = Client()
    response = anonymous.get("/auth/mcp/authorize/", params)
    assert response.status_code == 302
    assert response["Location"].startswith("http://localhost:3000/?next_path=")
    next_path = parse_qs(urlsplit(response["Location"]).query)["next_path"][0]
    assert next_path.startswith("/mcp-connect?flow=")
    flow_id = parse_qs(urlsplit(next_path).query)["flow"][0]
    assert Client().get("/auth/mcp/authorize/", {"flow": flow_id}).status_code == 400
    anonymous.force_login(create_user)
    assert consent_page(anonymous, {"flow": flow_id}).status_code == 200
    consent = consent_page(browser, params)
    ticket = consent.json()["ticket"]
    response = browser.post("/auth/mcp/authorize/", {"ticket": ticket, "decision": "deny"})
    assert parse_qs(urlsplit(response["Location"]).query)["error"] == ["access_denied"]
    assert not MCPOAuthGrant.objects.exists()
    assert browser.post("/auth/mcp/authorize/", {"ticket": ticket + "bad", "decision": "allow"}).status_code == 400
    strict = Client(enforce_csrf_checks=True)
    strict.force_login(create_user)
    assert strict.post("/auth/mcp/authorize/", {"ticket": ticket, "decision": "allow"}).status_code == 403
    from plane.db.models import User

    other = User.objects.create(email="other-oauth@test.invalid", username="oauth-other")
    browser.force_login(other)
    assert browser.post("/auth/mcp/authorize/", {"ticket": ticket, "decision": "allow"}).status_code == 403


@pytest.mark.parametrize(
    "changes",
    [
        {"redirect_uri": "https://attacker.invalid/cb"},
        {"client_id": "invalid"},
        {"code_challenge_method": "plain"},
        {"code_challenge": "short"},
        {"resource": "https://other.invalid/mcp"},
        {"scope": "admin"},
        {"response_type": "token"},
    ],
)
def test_authorization_rejects_invalid_request(flow, changes):
    browser, params, _, _ = flow
    response = browser.get("/auth/mcp/authorize/", {**params, **changes})
    assert response.status_code in (302, 400)
    if response.status_code == 302:
        assert response["Location"].startswith(REDIRECT)
        assert "error=" in response["Location"]
    assert not MCPOAuthGrant.objects.exists()


@pytest.mark.parametrize(
    "changes",
    [
        {"code_verifier": "b" * 64},
        {"code_verifier": "short"},
        {"redirect_uri": REDIRECT + "/other"},
        {"resource": "https://other.invalid/mcp"},
        {"client_id": "bad"},
    ],
)
def test_code_binding(flow, changes):
    _, _, consent, exchange = flow
    code = consent()
    assert exchange(code, **changes).status_code in (400, 401)
    assert not MCPOAuthToken.objects.exists()
    assert exchange(code).status_code == 200


def test_code_expiry_and_replay(flow):
    _, _, consent, exchange = flow
    code = consent()
    MCPOAuthGrant.objects.filter(code_hash=digest(code)).update(code_expires_at=timezone.now() - timedelta(seconds=1))
    assert exchange(code).status_code == 400
    code = consent()
    assert exchange(code).status_code == 200
    assert exchange(code).status_code == 400


def test_read_only_workspace_boundary_and_api_token_preserved(flow, workspace, create_user, api_token):
    browser, _, _, exchange = flow
    response = exchange()
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    tokens = response.json()
    assert tokens["scope"] == "plane:read"
    # Previously issued single-workspace grants must never expand on upgrade.
    MCPOAuthGrant.objects.update(workspace=workspace)
    row = MCPOAuthToken.objects.get()
    assert row.access_hash == digest(tokens["access_token"])
    assert row.refresh_hash == digest(tokens["refresh_token"])
    result = call_mcp(browser, tokens["access_token"]).json()["result"]
    assert not result["isError"]
    assert workspace.slug in result["content"][0]["text"]
    other = Workspace.objects.create(name="Other", slug="other-oauth", owner=create_user)
    WorkspaceMember.objects.create(workspace=other, member=create_user, role=20)
    result = call_mcp(browser, tokens["access_token"]).json()["result"]
    assert other.slug not in result["content"][0]["text"]
    result = call_mcp(browser, tokens["access_token"], arguments={"action": "me", "workspace_slug": other.slug}).json()[
        "result"
    ]
    assert result["isError"]
    result = call_mcp(
        browser, tokens["access_token"], arguments={"action": "me", "workspace_slug": workspace.slug}
    ).json()["result"]
    assert not result["isError"], result
    from django.test import RequestFactory

    gateway = ApiGateway(RequestFactory().get("/mcp"), tokens["access_token"], oauth=True)
    assert (
        gateway.call(
            "POST", f"workspaces/{workspace.slug}/projects/", body={"name": "Denied", "identifier": "NO"}
        ).status
        == 403
    )
    # The OAuth token has an MCP-only audience; public API cannot accept it.
    assert Client().get(
        f"/api/v1/workspaces/{workspace.slug}/projects/", HTTP_X_API_KEY=tokens["access_token"]
    ).status_code in (401, 403)
    assert call_mcp(browser, api_token.token, method="tools/list").status_code == 200


def test_write_scope_and_membership_revocation(flow, workspace, create_user):
    browser, _, consent, exchange = flow
    tokens = exchange(consent(write=True)).json()
    assert "plane:write" in tokens["scope"]
    from django.test import RequestFactory

    gateway = ApiGateway(RequestFactory().get("/mcp"), tokens["access_token"], oauth=True)
    response = gateway.call(
        "POST", f"workspaces/{workspace.slug}/projects/", body={"name": "OAuth test", "identifier": "OA"}
    )
    assert response.status == 201, response.data
    WorkspaceMember.objects.filter(member=create_user, workspace=workspace).update(is_active=False)
    result = call_mcp(
        browser, tokens["access_token"], arguments={"action": "me", "workspace_slug": workspace.slug}
    ).json()["result"]
    assert result["isError"]
    assert call_mcp(browser, tokens["access_token"]).status_code == 200


def test_refresh_rotation_reuse_and_client_binding(flow):
    browser, params, _, exchange = flow
    first = exchange().json()
    data = {
        "grant_type": "refresh_token",
        "client_id": params["client_id"],
        "resource": ORIGIN + "/mcp",
        "refresh_token": first["refresh_token"],
    }
    other = MCPOAuthClient.objects.create(name="Other", redirect_uris=[REDIRECT])
    assert browser.post("/auth/mcp/token/", {**data, "client_id": other.pk}).status_code == 400
    assert browser.post("/auth/mcp/token/", {**data, "scope": "plane:read plane:write"}).status_code == 400
    second = browser.post("/auth/mcp/token/", data)
    assert second.status_code == 200
    assert call_mcp(browser, first["access_token"]).status_code == 401
    assert call_mcp(browser, second.json()["access_token"]).status_code == 200
    assert browser.post("/auth/mcp/token/", data).status_code == 400
    assert call_mcp(browser, second.json()["access_token"]).status_code == 401


def test_expired_access_revocation_and_user_connections(flow):
    browser, params, _, exchange = flow
    tokens = exchange().json()
    MCPOAuthToken.objects.update(access_expires_at=timezone.now() - timedelta(seconds=1))
    assert call_mcp(browser, tokens["access_token"]).status_code == 401
    tokens = exchange().json()
    assert (
        browser.post(
            "/auth/mcp/revoke/", {"client_id": params["client_id"], "token": tokens["refresh_token"]}
        ).status_code
        == 200
    )
    assert call_mcp(browser, tokens["access_token"]).status_code == 401
    tokens = exchange().json()
    page = browser.get("/auth/mcp/connections/")
    assert page.status_code == 200
    assert page["Cache-Control"] == "no-store"
    assert set(page.json()["connections"][0]) == {
        "id",
        "client_name",
        "workspace_name",
        "scope",
        "expires_at",
        "created_at",
        "status",
    }
    assert page.json()["csrf_token"]
    grant = MCPOAuthToken.objects.get(access_hash=digest(tokens["access_token"])).grant
    assert browser.post("/auth/mcp/connections/", {"grant": grant.pk}).status_code == 200
    assert call_mcp(browser, tokens["access_token"]).status_code == 401


def test_real_login_preserves_pending_authorization(flow, create_user, settings):
    from unittest.mock import patch
    from plane.license.models import Instance

    settings.WEB_URL = "http://localhost:8000"
    Instance.objects.create(
        instance_name="OAuth test", instance_id="oauth-test", last_checked_at=timezone.now(), is_setup_done=True
    )
    _, params, _, _ = flow
    browser = Client()
    response = browser.get("/auth/mcp/authorize/", params)
    next_path = parse_qs(urlsplit(response["Location"]).query)["next_path"][0]
    flow_id = parse_qs(urlsplit(next_path).query)["flow"][0]
    with patch("plane.authentication.views.app.email.EmailProvider") as provider:
        provider.return_value.authenticate.return_value = create_user
        signed_in = browser.post(
            "/auth/sign-in/",
            {
                "email": create_user.email,
                "password": "test-only",
                "next_path": next_path,
            },
        )
    assert signed_in.status_code == 302
    assert parse_qs(urlsplit(signed_in["Location"]).query)["next_path"] == [next_path]
    response = consent_page(browser, {"flow": flow_id})
    assert response.status_code == 200
    assert response.json()["client_name"] == MCPOAuthClient.objects.get().name


def test_csrf_form_accepts_same_origin_and_rejects_foreign_origin(flow, create_user):
    _, params, _, _ = flow
    browser = Client(enforce_csrf_checks=True)
    browser.force_login(create_user)
    page = consent_page(browser, params)
    csrf = browser.cookies["csrftoken"].value
    data = {"csrfmiddlewaretoken": csrf, "ticket": page.json()["ticket"], "decision": "deny"}
    assert page["Referrer-Policy"] == "same-origin"
    assert browser.post("/auth/mcp/authorize/", data, HTTP_ORIGIN="https://evil.invalid").status_code == 403
    response = browser.post("/auth/mcp/authorize/", data, HTTP_ORIGIN=ORIGIN, HTTP_HOST="plane.test", secure=True)
    assert response.status_code == 302
    assert "error=access_denied" in response["Location"]


def test_grant_expiration_account_deactivation_and_revocation_ownership(flow, create_user):
    browser, _, _, exchange = flow
    tokens = exchange().json()
    grant = MCPOAuthGrant.objects.get()
    MCPOAuthGrant.objects.filter(pk=grant.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
    assert call_mcp(browser, tokens["access_token"]).status_code == 401
    tokens = exchange().json()
    grant = MCPOAuthToken.objects.get(access_hash=digest(tokens["access_token"])).grant
    from plane.db.models import User

    other = User.objects.create(email="revoke-other@test.invalid", username="revoke-other")
    browser.force_login(other)
    browser.post("/auth/mcp/connections/", {"grant": grant.pk})
    grant.refresh_from_db()
    assert not grant.revoked
    User.objects.filter(pk=create_user.pk).update(is_active=False)
    assert call_mcp(browser, tokens["access_token"]).status_code == 401


@pytest.mark.parametrize(
    "value",
    ["https://user:secret@plane.test", "http://remote.test", "https://plane.test/mcp", "https://plane.test?x=y"],
)
def test_issuer_rejects_unsafe_configuration(settings, value):
    from django.core.exceptions import ImproperlyConfigured
    from plane.mcp.oauth import issuer

    settings.MCP_OAUTH_ISSUER = value
    with pytest.raises(ImproperlyConfigured):
        issuer()


def test_connections_require_session_and_csrf(flow):
    from django.test import Client

    browser, _, _, exchange = flow
    exchange()
    grant = MCPOAuthGrant.objects.get()
    anonymous = Client()
    assert anonymous.get("/auth/mcp/connections/").status_code == 403
    assert anonymous.post("/auth/mcp/connections/", {"grant": grant.pk}).status_code == 403
    protected = Client(enforce_csrf_checks=True)
    protected.force_login(grant.user)
    assert protected.post("/auth/mcp/connections/", {"grant": grant.pk}).status_code == 403
    token = protected.get("/auth/mcp/connections/").json()["csrf_token"]
    assert protected.post("/auth/mcp/connections/", {"grant": grant.pk}, HTTP_X_CSRFTOKEN=token).status_code == 200


def test_consent_is_single_use_and_bound_to_browser_session(flow, create_user, workspace):
    browser, params, _, _ = flow
    previous_session = browser.session
    page = consent_page(browser, params)
    # Simulate an in-flight app request saving its older session snapshot.
    previous_session.save()
    data = {"ticket": page.json()["ticket"], "decision": "allow", "workspace": workspace.slug}
    another_session = Client()
    another_session.force_login(create_user)
    assert another_session.post("/auth/mcp/authorize/", data).status_code == 403
    assert browser.post("/auth/mcp/authorize/", data).status_code == 302
    MCPOAuthGrant.objects.update(revoked=True)
    assert browser.post("/auth/mcp/authorize/", data).status_code == 400
    assert MCPOAuthGrant.objects.count() == 1
    assert not MCPOAuthGrant.objects.filter(revoked=False).exists()


def test_pending_code_can_be_revoked_before_exchange(flow):
    browser, _, consent, exchange = flow
    code = consent()
    grant = MCPOAuthGrant.objects.get()
    assert not grant.code_used
    assert browser.get("/auth/mcp/connections/").json()["connections"][0]["id"] == str(grant.pk)
    assert browser.post("/auth/mcp/connections/", {"grant": grant.pk}).status_code == 200
    assert exchange(code).status_code == 400
    assert not MCPOAuthToken.objects.exists()


def test_session_oauth_endpoints_reject_foreign_origin_even_with_permissive_cors(flow, settings):
    settings.CORS_ALLOW_ALL_ORIGINS = True
    browser, params, _, _ = flow
    for path, data in [("/auth/mcp/authorize/", params), ("/auth/mcp/connections/", {})]:
        assert browser.get(path, data, HTTP_ORIGIN="https://evil.invalid").status_code == 403
        assert browser.get(path, data, HTTP_ORIGIN="null").status_code == 403
        assert browser.get(path, data, HTTP_ORIGIN=ORIGIN).status_code == (302 if "authorize" in path else 200)


def test_oauth_write_requires_transport_scope_challenge(flow, workspace):
    browser, _, _, exchange = flow
    tokens = exchange().json()
    response = browser.post(
        "/mcp",
        json.dumps(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "project",
                    "arguments": {
                        "action": "create",
                        "workspace_slug": workspace.slug,
                        "name": "Denied",
                        "identifier": "NO",
                    },
                },
            }
        ),
        content_type="application/json",
        HTTP_AUTHORIZATION="Bearer " + tokens["access_token"],
    )
    assert response.status_code == 403
    assert 'error="insufficient_scope"' in response["WWW-Authenticate"]
    assert 'scope="plane:read plane:write"' in response["WWW-Authenticate"]
    assert 'resource_metadata="' + ORIGIN in response["WWW-Authenticate"]


def test_authorization_query_size_is_bounded(flow):
    browser, params, _, _ = flow
    assert browser.get("/auth/mcp/authorize/", {**params, "unused": "x" * 8192}).status_code == 400


def test_consent_cannot_escalate_unrequested_scope(flow, workspace):
    _, _, consent, exchange = flow
    token = exchange(consent(write=True, overrides={"scope": "plane:read"})).json()
    assert token["scope"] == "plane:read"


def test_revoked_code_and_refresh_never_reactivate_grant(flow):
    browser, params, _, exchange = flow
    tokens = exchange().json()
    grant = MCPOAuthGrant.objects.get()
    assert browser.post("/auth/mcp/connections/", {"grant": grant.pk}).status_code == 200
    response = browser.post(
        "/auth/mcp/token/",
        {
            "grant_type": "refresh_token",
            "client_id": params["client_id"],
            "resource": ORIGIN + "/mcp",
            "refresh_token": tokens["refresh_token"],
        },
    )
    assert response.status_code == 400
    assert MCPOAuthToken.objects.count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("grant_type", ["authorization_code", "refresh_token"])
def test_parallel_exchange_is_single_use(flow, grant_type):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from django.db import close_old_connections

    _, params, consent, exchange = flow
    data = {"grant_type": grant_type, "client_id": params["client_id"], "resource": ORIGIN + "/mcp"}
    if grant_type == "authorization_code":
        data.update(code=consent(), code_verifier=VERIFIER, redirect_uri=REDIRECT)
    else:
        data["refresh_token"] = exchange().json()["refresh_token"]
    barrier = Barrier(2)

    def redeem():
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            return Client().post("/auth/mcp/token/", data).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: redeem(), range(2)))
    assert sorted(results) == [200, 400]
    assert MCPOAuthGrant.objects.get().revoked


def test_refresh_lifetime_is_capped_by_original_grant(flow):
    browser, params, _, exchange = flow
    tokens = exchange().json()
    MCPOAuthGrant.objects.update(expires_at=timezone.now() + timedelta(seconds=30))
    response = browser.post(
        "/auth/mcp/token/",
        {
            "grant_type": "refresh_token",
            "client_id": params["client_id"],
            "resource": ORIGIN + "/mcp",
            "refresh_token": tokens["refresh_token"],
        },
    )
    assert response.status_code == 200
    assert 0 < response.json()["expires_in"] <= 30
    token = MCPOAuthToken.objects.get(access_hash=digest(response.json()["access_token"]))
    assert token.access_expires_at <= token.grant.expires_at


@pytest.mark.parametrize("days", [1, 180, 365])
def test_configured_grant_lifetime_keeps_access_tokens_short(flow, settings, days):
    settings.MCP_OAUTH_GRANT_DAYS = days
    _, _, _, exchange = flow
    before = timezone.now()
    response = exchange()
    after = timezone.now()
    assert response.status_code == 200
    grant = MCPOAuthGrant.objects.get()
    assert before + timedelta(days=days) <= grant.expires_at <= after + timedelta(days=days)
    assert 0 < response.json()["expires_in"] <= 3600


def test_configuration_change_and_refresh_do_not_extend_existing_grants(flow, settings):
    settings.MCP_OAUTH_GRANT_DAYS = 30
    browser, params, _, exchange = flow
    tokens = exchange().json()
    grant = MCPOAuthGrant.objects.get()
    original_expiry = grant.expires_at
    settings.MCP_OAUTH_GRANT_DAYS = 180
    MCPOAuthToken.objects.update(access_expires_at=timezone.now() - timedelta(seconds=1))
    assert call_mcp(browser, tokens["access_token"]).status_code == 401
    refreshed = browser.post(
        "/auth/mcp/token/",
        {
            "grant_type": "refresh_token",
            "client_id": params["client_id"],
            "resource": ORIGIN + "/mcp",
            "refresh_token": tokens["refresh_token"],
        },
    )
    assert refreshed.status_code == 200
    assert call_mcp(browser, refreshed.json()["access_token"]).status_code == 200
    grant.refresh_from_db()
    assert grant.expires_at == original_expiry


def test_consent_lifetime_is_signed_and_cannot_change_after_display(flow, settings):
    settings.MCP_OAUTH_GRANT_DAYS = 180
    browser, params, _, exchange = flow
    form = consent_page(browser, params).json()
    assert form["grant_days"] == 180
    settings.MCP_OAUTH_GRANT_DAYS = 365
    before = timezone.now()
    response = browser.post(
        "/auth/mcp/authorize/",
        {"ticket": form["ticket"], "decision": "allow", "grant_days": "365"},
    )
    code = parse_qs(urlsplit(response["Location"]).query)["code"][0]
    assert exchange(code).status_code == 200
    grant = MCPOAuthGrant.objects.get()
    assert before + timedelta(days=180) <= grant.expires_at <= timezone.now() + timedelta(days=180)


@pytest.mark.parametrize("reason", ["expired", "revoked"])
def test_invalid_grant_requires_fresh_consent_with_same_registered_client(flow, reason):
    browser, params, _, exchange = flow
    tokens = exchange().json()
    grant = MCPOAuthGrant.objects.get()
    if reason == "expired":
        MCPOAuthGrant.objects.filter(pk=grant.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
    else:
        assert browser.post("/auth/mcp/connections/", {"grant": grant.pk}).status_code == 200
    response = call_mcp(browser, tokens["access_token"])
    assert response.status_code == 401
    assert 'error="invalid_token"' in response["WWW-Authenticate"]
    assert f'resource_metadata="{ORIGIN}/.well-known/oauth-protected-resource"' in response["WWW-Authenticate"]
    refreshed = browser.post(
        "/auth/mcp/token/",
        {
            "grant_type": "refresh_token",
            "client_id": params["client_id"],
            "resource": ORIGIN + "/mcp",
            "refresh_token": tokens["refresh_token"],
        },
    )
    assert refreshed.status_code == 400
    assert refreshed.json()["error"] == "invalid_grant"
    assert MCPOAuthToken.objects.count() == 1
    replacement = exchange()
    assert replacement.status_code == 200
    assert call_mcp(browser, replacement.json()["access_token"]).status_code == 200
    assert call_mcp(browser, tokens["access_token"]).status_code == 401
    assert MCPOAuthClient.objects.count() == 1
    assert MCPOAuthGrant.objects.count() == 2


def test_account_grants_follow_current_membership_without_workspace_selection(flow, workspace, create_user):
    browser, _, _, exchange = flow
    token = exchange().json()["access_token"]
    assert MCPOAuthGrant.objects.get().workspace_id is None
    other = Workspace.objects.create(name="Second", slug="second-oauth", owner=create_user)
    WorkspaceMember.objects.create(workspace=other, member=create_user, role=20)
    result = call_mcp(browser, token).json()["result"]
    assert workspace.slug in result["content"][0]["text"] and other.slug in result["content"][0]["text"]
    assert not call_mcp(browser, token, arguments={"action": "me", "workspace_slug": other.slug}).json()["result"][
        "isError"
    ]
    WorkspaceMember.objects.filter(member=create_user, workspace=other).update(is_active=False)
    assert call_mcp(browser, token, arguments={"action": "me", "workspace_slug": other.slug}).json()["result"][
        "isError"
    ]
    assert other.slug not in call_mcp(browser, token).json()["result"]["content"][0]["text"]


def test_multiple_clients_and_repeated_connections_revoke_independently(flow):
    browser, params, _, exchange = flow
    first = exchange().json()["access_token"]
    second_client = MCPOAuthClient.objects.create(name="Second client", redirect_uris=[REDIRECT])
    form = consent_page(browser, {**params, "client_id": str(second_client.pk)}).json()
    response = browser.post("/auth/mcp/authorize/", {"ticket": form["ticket"], "decision": "allow"})
    code = parse_qs(urlsplit(response["Location"]).query)["code"][0]
    second = exchange(code, client_id=str(second_client.pk)).json()["access_token"]
    third = exchange().json()["access_token"]
    assert len(browser.get("/auth/mcp/connections/").json()["connections"]) == 3
    first_grant = MCPOAuthToken.objects.get(access_hash=digest(first)).grant
    assert browser.post("/auth/mcp/connections/", {"grant": first_grant.pk}).status_code == 200
    assert call_mcp(browser, first).status_code == 401
    assert call_mcp(browser, second, method="tools/list").status_code == 200
    assert call_mcp(browser, third, method="tools/list").status_code == 200


def test_consent_details_are_private_expiring_and_single_use(flow, create_user):
    browser, params, _, _ = flow
    response = browser.get("/auth/mcp/authorize/", params)
    flow_id = parse_qs(urlsplit(response["Location"]).query)["consent"][0]
    path = "/auth/mcp/consent/"
    assert Client().get(path, {"flow": flow_id}).status_code == 403
    other_session = Client()
    other_session.force_login(create_user)
    assert other_session.get(path, {"flow": flow_id}).status_code == 403
    assert browser.get(path, {"flow": flow_id}, HTTP_ORIGIN="https://evil.invalid").status_code == 403
    page = browser.get(path, {"flow": flow_id})
    assert page["Cache-Control"] == "no-store"
    assert "frame-ancestors 'none'" in page["Content-Security-Policy"]
    data = page.json()
    assert data["write_requested"] is True and data["account_email"] == create_user.email
    response = browser.post(
        "/auth/mcp/authorize/", {"ticket": data["ticket"], "decision": "deny"}, HTTP_ACCEPT="application/json"
    )
    assert response.status_code == 200
    assert "error=access_denied" in response.json()["redirect_url"]
    assert not MCPOAuthGrant.objects.exists()
    assert browser.get(path, {"flow": flow_id}).status_code == 410
    cache.clear()
    assert browser.get(path, {"flow": flow_id}).status_code == 410


def test_json_consent_preserves_pkce_callback_and_defaults_to_read(flow):
    browser, params, _, exchange = flow
    data = consent_page(browser, params).json()
    response = browser.post(
        "/auth/mcp/authorize/", {"ticket": data["ticket"], "decision": "allow"}, HTTP_ACCEPT="application/json"
    )
    target = response.json()["redirect_url"]
    assert target.startswith(REDIRECT + "?")
    query = parse_qs(urlsplit(target).query)
    assert query["state"] == [params["state"]] and query["iss"] == [ORIGIN]
    assert exchange(query["code"][0]).json()["scope"] == "plane:read"


def test_in_flight_legacy_consent_does_not_silently_expand_access(flow, workspace):
    from django.core import signing

    browser, params, _, _ = flow
    form = consent_page(browser, params).json()
    legacy = signing.loads(form["ticket"], salt="mcp-consent")
    legacy.pop("access")
    ticket = signing.dumps(legacy, salt="mcp-consent")
    response = browser.post(
        "/auth/mcp/authorize/", {"ticket": ticket, "workspace": workspace.slug, "decision": "allow"}
    )
    assert response.status_code == 302
    assert MCPOAuthGrant.objects.get().workspace_id == workspace.pk
