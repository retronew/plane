"""Narrow MCP OAuth authorization-code flow for public clients (S256 only).

No client-supplied URLs are fetched. DCR only admits HTTPS callbacks and loopback
HTTP callbacks. The exact registered redirect is bound to each code, as are the
client, PKCE challenge, resource, user, workspace and approved scope.
"""

import base64
import hashlib
import json
import re
import secrets
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from plane.db.models import MCPOAuthClient, MCPOAuthGrant, MCPOAuthToken, WorkspaceMember

READ = "plane:read"
WRITE = "plane:write"
SCOPES = [READ, WRITE]


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def issuer():
    # Never trust Host/X-Forwarded-Host for discovery or audience validation.
    value = settings.MCP_OAUTH_ISSUER.rstrip("/")
    parsed = urlsplit(value)
    if (
        not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path
        or (
            parsed.scheme != "https"
            and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1", "::1"))
        )
    ):
        raise ImproperlyConfigured("MCP_OAUTH_ISSUER must be an HTTPS origin (HTTP is allowed only for loopback tests)")
    return value


def resource():
    return issuer() + "/mcp"


def secure(response):
    response["Cache-Control"] = "no-store"
    response["Pragma"] = "no-cache"
    response["Referrer-Policy"] = "same-origin"
    response["Content-Security-Policy"] = (
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
    )
    return response


def error(name="invalid_request", status=400):
    return secure(JsonResponse({"error": name}, status=status))


def session_origin_allowed(request):
    # Keep session/consent responses private even if global API CORS is permissive.
    # Cross-origin top-level OAuth navigations have no Origin and remain supported.
    origin = request.headers.get("Origin")
    return not origin or origin in {
        issuer(),
        settings.WEB_URL.rstrip("/"),
        (settings.APP_BASE_URL or settings.WEB_URL).rstrip("/"),
    }


def limited(request, bucket, limit=60):
    key = f"mcp-oauth:{bucket}:{digest(request.META.get('REMOTE_ADDR', ''))}"
    cache.add(key, 0, 60)
    try:
        return cache.incr(key) > limit
    except ValueError:
        return False


def valid_redirect(value):
    if not isinstance(value, str) or len(value) > 2048 or re.search(r"[\s\\\x00-\x1f]", value):
        return False
    try:
        url = urlsplit(value)
        _ = url.port
        return bool(
            url.hostname
            and not url.username
            and not url.password
            and not url.fragment
            # Claude Code uses localhost; never permit suffixes or arbitrary local hostnames.
            and (url.scheme == "https" or (url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1", "::1")))
        )
    except ValueError:
        return False


def client_by_id(value):
    try:
        return MCPOAuthClient.objects.filter(pk=value).first()
    except (ValueError, ValidationError):
        return None


@require_GET
def protected_metadata(request):
    return JsonResponse({"resource": resource(), "authorization_servers": [issuer()], "scopes_supported": SCOPES})


@require_GET
def authorization_metadata(request):
    return JsonResponse(
        {
            "issuer": issuer(),
            "authorization_endpoint": issuer() + "/auth/mcp/authorize/",
            "token_endpoint": issuer() + "/auth/mcp/token/",
            "registration_endpoint": issuer() + "/auth/mcp/register/",
            "revocation_endpoint": issuer() + "/auth/mcp/revoke/",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "token_endpoint_auth_methods_supported": ["none"],
            "code_challenge_methods_supported": ["S256"],
            "scopes_supported": SCOPES,
            "authorization_response_iss_parameter_supported": True,
        }
    )


@csrf_exempt
@require_POST
def register(request):
    if limited(request, "register", 10):
        return error("slow_down", 429)
    if len(request.body) > 8192:
        return error()
    try:
        body = json.loads(request.body)
    except ValueError:
        return error()
    if not isinstance(body, dict):
        return error()
    redirects = body.get("redirect_uris")
    name = body.get("client_name", "MCP client")
    if (
        not isinstance(redirects, list)
        or not 1 <= len(redirects) <= 10
        or not all(valid_redirect(uri) for uri in redirects)
        or not isinstance(name, str)
        or not 1 <= len(name) <= 100
    ):
        return error("invalid_client_metadata")
    if (
        body.get("token_endpoint_auth_method", "none") != "none"
        or body.get("response_types", ["code"]) != ["code"]
        or body.get("grant_types", ["authorization_code", "refresh_token"])
        not in (["authorization_code"], ["authorization_code", "refresh_token"])
    ):
        return error("invalid_client_metadata")
    client = MCPOAuthClient.objects.create(name=name, redirect_uris=redirects)
    return secure(
        JsonResponse(
            {
                "client_id": str(client.pk),
                "client_name": name,
                "redirect_uris": redirects,
                "token_endpoint_auth_method": "none",
                "response_types": ["code"],
                "grant_types": ["authorization_code", "refresh_token"],
            },
            status=201,
        )
    )


def valid_grant(grant):
    return (
        not grant.revoked
        and grant.expires_at > timezone.now()
        and grant.resource == resource()
        and grant.user.is_active
        and (
            grant.workspace_id is None
            or WorkspaceMember.objects.filter(
                workspace=grant.workspace,
                workspace__deleted_at__isnull=True,
                member=grant.user,
                is_active=True,
            ).exists()
        )
    )


def authenticate_access(value):
    token = (
        MCPOAuthToken.objects.select_related("grant__user", "grant__workspace")
        .filter(access_hash=digest(value))
        .first()
    )
    if not token or token.rotated or token.access_expires_at <= timezone.now() or not valid_grant(token.grant):
        raise AuthenticationFailed("Invalid or expired MCP OAuth token")
    return token.grant


def authenticate_gateway(request, value):
    grant = authenticate_access(value)
    match = request.resolver_match
    slug = match.kwargs.get("slug") if match else None
    identity = request.method == "GET" and request.path == "/api/v1/users/me/"
    if not identity and (
        not slug
        or (grant.workspace_id is not None and slug != grant.workspace.slug)
        or not WorkspaceMember.objects.filter(
            workspace__slug=slug,
            workspace__deleted_at__isnull=True,
            member=grant.user,
            is_active=True,
        ).exists()
    ):
        raise PermissionDenied("OAuth grant cannot access this workspace")
    if WRITE not in grant.scope.split() and request.method not in ("GET", "HEAD", "OPTIONS"):
        raise PermissionDenied("OAuth grant is read-only")
    return grant.user, "mcp-oauth:" + str(grant.pk)


def callback(params, *, request=None, **values):
    values.update(state=params.get("state", ""), iss=issuer())
    uri = params["redirect_uri"]
    target = uri + ("&" if "?" in uri else "?") + urlencode(values)
    if request is not None and request.headers.get("Accept") == "application/json":
        return secure(JsonResponse({"redirect_url": target}))
    return secure(HttpResponseRedirect(target))


@require_http_methods(["GET", "POST"])
def authorize(request):
    if not session_origin_allowed(request):
        return error("access_denied", 403)
    if limited(request, "authorize"):
        return error("slow_down", 429)
    if request.method == "GET":
        if len(request.META.get("QUERY_STRING", "")) > 8192 or any(
            len(request.GET.getlist(key)) != 1 for key in request.GET
        ):
            return error()
        params = request.GET.dict()
        if "flow" in params:
            flow_id = params["flow"]
            if not re.fullmatch(r"[A-Za-z0-9_-]{43}", flow_id):
                return error()
            params = cache.get("mcp-login:" + flow_id)
            if not params or not secrets.compare_digest(
                params.pop("session_nonce", ""), request.session.get("mcp_login_nonce", "missing")
            ):
                return error("invalid_request")
        client = client_by_id(params.get("client_id"))
        if not client or params.get("redirect_uri") not in client.redirect_uris:
            return error("invalid_client")
        scopes = set(params.get("scope", READ).split())
        if not scopes or not scopes <= set(SCOPES):
            return callback(params, error="invalid_scope")
        if (
            params.get("response_type") != "code"
            or params.get("resource") != resource()
            or params.get("code_challenge_method") != "S256"
            or not re.fullmatch(r"[A-Za-z0-9_-]{43}", params.get("code_challenge", ""))
            or len(params.get("state", "")) > 2048
        ):
            return callback(params, error="invalid_request")
        if not request.user.is_authenticated:
            login_url = (settings.APP_BASE_URL or settings.WEB_URL).rstrip("/") + "/?"
            # Use a short relative return path: Plane's login validates and limits next_path.
            flow_id = secrets.token_urlsafe(32)
            nonce = request.session.get("mcp_login_nonce") or secrets.token_urlsafe(32)
            request.session["mcp_login_nonce"] = nonce
            cache.set("mcp-login:" + flow_id, {**params, "session_nonce": nonce}, 600)
            return secure(HttpResponseRedirect(login_url + urlencode({"next_path": "/mcp-connect?flow=" + flow_id})))
        if not request.user.is_active:
            return error("access_denied", 403)
        params = {
            key: value
            for key, value in params.items()
            if key
            in {
                "client_id",
                "redirect_uri",
                "response_type",
                "resource",
                "scope",
                "state",
                "code_challenge",
                "code_challenge_method",
            }
        }
        params["scope"] = " ".join(sorted(scopes | {READ}))
        # Do not write a new nonce into the session: concurrent app requests with
        # sliding session expiry can overwrite that update. Bind to the existing
        # session key by digest; rotating/logging out of the session invalidates it.
        ticket = signing.dumps(
            {
                "params": params,
                "access": "account",
                "grant_days": settings.MCP_OAUTH_GRANT_DAYS,
                "user": str(request.user.pk),
                "session": digest(request.session.session_key or ""),
                "nonce": secrets.token_urlsafe(32),
            },
            salt="mcp-consent",
        )
        flow_id = secrets.token_urlsafe(32)
        cache.set("mcp-consent:" + flow_id, ticket, 600)
        frontend = (settings.APP_BASE_URL or settings.WEB_URL).rstrip("/")
        return secure(HttpResponseRedirect(frontend + "/mcp-connect?consent=" + flow_id))
    if not request.user.is_authenticated or not request.user.is_active:
        return error("access_denied", 403)
    try:
        ticket = signing.loads(request.POST.get("ticket", ""), salt="mcp-consent", max_age=600)
    except signing.BadSignature:
        return error()
    if ticket["user"] != str(request.user.pk) or not secrets.compare_digest(
        ticket.get("session", ""), digest(request.session.session_key or "")
    ):
        return error("access_denied", 403)
    params = ticket["params"]
    # An atomic claim prevents duplicate forms or parallel submissions from minting
    # additional grants, including after the first grant has been revoked.
    if not cache.add("mcp-consent-used:" + digest(request.POST["ticket"]), True, 600):
        return error()
    if request.POST.get("decision") != "allow":
        return callback(params, request=request, error="access_denied")
    # Tickets issued by the old workspace consent screen must not gain account access.
    workspace = None
    if ticket.get("access") != "account":
        member = WorkspaceMember.objects.filter(
            member=request.user,
            is_active=True,
            workspace__slug=request.POST.get("workspace"),
            workspace__deleted_at__isnull=True,
        ).first()
        if not member:
            return error("access_denied", 403)
        workspace = member.workspace
    scope = READ
    if request.POST.get("write") == "yes" and WRITE in params["scope"].split():
        scope += " " + WRITE
    code = secrets.token_urlsafe(32)
    MCPOAuthGrant.objects.create(
        client_id=params["client_id"],
        user=request.user,
        workspace=workspace,
        scope=scope,
        resource=resource(),
        redirect_uri=params["redirect_uri"],
        code_hash=digest(code),
        code_challenge=params["code_challenge"],
        code_expires_at=timezone.now() + timedelta(minutes=2),
        expires_at=timezone.now() + timedelta(days=ticket.get("grant_days", 30)),
    )
    return callback(params, request=request, code=code)


@require_GET
def consent(request):
    """Return a session-bound consent form to the first-party frontend only."""
    if not session_origin_allowed(request) or not request.user.is_authenticated or not request.user.is_active:
        return error("access_denied", 403)
    flow_id = request.GET.get("flow", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", flow_id):
        return error()
    ticket = cache.get("mcp-consent:" + flow_id)
    if not ticket:
        return error("expired_request", 410)
    try:
        data = signing.loads(ticket, salt="mcp-consent", max_age=600)
    except signing.BadSignature:
        return error("expired_request", 410)
    if data["user"] != str(request.user.pk) or not secrets.compare_digest(
        data.get("session", ""), digest(request.session.session_key or "")
    ):
        return error("access_denied", 403)
    if cache.get("mcp-consent-used:" + digest(ticket)):
        return error("expired_request", 410)
    client = client_by_id(data["params"]["client_id"])
    if not client:
        return error("invalid_client", 410)
    return secure(
        JsonResponse(
            {
                "ticket": ticket,
                "csrf_token": get_token(request),
                "client_name": client.name,
                "account_email": request.user.email,
                "redirect_uri": data["params"]["redirect_uri"],
                "write_requested": WRITE in data["params"]["scope"].split(),
                "grant_days": data.get("grant_days", 30),
            }
        )
    )


def issue_token(grant):
    access = "plane_mcp_" + secrets.token_urlsafe(32)
    refresh = secrets.token_urlsafe(48)
    now = timezone.now()
    expires_in = max(0, min(3600, int((grant.expires_at - now).total_seconds())))
    MCPOAuthToken.objects.create(
        grant=grant,
        access_hash=digest(access),
        refresh_hash=digest(refresh),
        access_expires_at=now + timedelta(seconds=expires_in),
    )
    return secure(
        JsonResponse(
            {
                "access_token": access,
                "token_type": "Bearer",
                "expires_in": expires_in,
                "refresh_token": refresh,
                "scope": grant.scope,
            }
        )
    )


@csrf_exempt
@require_POST
def token(request):
    if limited(request, "token"):
        return error("slow_down", 429)
    if any(len(request.POST.getlist(key)) != 1 for key in request.POST):
        return error()
    data = request.POST
    client = client_by_id(data.get("client_id"))
    if not client:
        return error("invalid_client", 401)
    if data.get("resource") != resource():
        return error("invalid_target")
    with transaction.atomic():
        if data.get("grant_type") == "authorization_code":
            grant = MCPOAuthGrant.objects.select_for_update().filter(code_hash=digest(data.get("code", ""))).first()
            verifier = data.get("code_verifier", "")
            challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
            if (
                not grant
                or grant.client_id != client.pk
                or grant.redirect_uri != data.get("redirect_uri")
                or grant.code_expires_at <= timezone.now()
                or not valid_grant(grant)
                or not re.fullmatch(r"[A-Za-z0-9._~-]{43,128}", verifier)
                or not secrets.compare_digest(challenge, grant.code_challenge)
            ):
                return error("invalid_grant")
            if grant.code_used:
                grant.revoked = True
                grant.save(update_fields=["revoked"])
                return error("invalid_grant")
            grant.code_used = True
            grant.save(update_fields=["code_used"])
            return issue_token(grant)
        if data.get("grant_type") == "refresh_token":
            old = MCPOAuthToken.objects.filter(refresh_hash=digest(data.get("refresh_token", ""))).first()
            if not old:
                return error("invalid_grant")
            grant = MCPOAuthGrant.objects.select_for_update().get(pk=old.grant_id)
            old.refresh_from_db()
            if grant.client_id != client.pk or not valid_grant(grant):
                return error("invalid_grant")
            if old.rotated:
                grant.revoked = True  # Reuse revokes the entire token family.
                grant.save(update_fields=["revoked"])
                return error("invalid_grant")
            if data.get("scope", grant.scope) != grant.scope:
                return error("invalid_scope")
            old.rotated = True
            old.save(update_fields=["rotated"])
            return issue_token(grant)
    return error("unsupported_grant_type")


@csrf_exempt
@require_POST
def revoke(request):
    if limited(request, "revoke"):
        return error("slow_down", 429)
    client = client_by_id(request.POST.get("client_id"))
    if not client:
        return error("invalid_client", 401)
    value = digest(request.POST.get("token", ""))
    found = MCPOAuthToken.objects.filter(Q(access_hash=value) | Q(refresh_hash=value), grant__client=client).first()
    if found:
        MCPOAuthGrant.objects.filter(pk=found.grant_id).update(revoked=True)
    return secure(HttpResponse(status=200))


@require_http_methods(["GET", "POST"])
def connections(request):
    """Session-only settings API. Secrets never leave the token endpoint."""
    if not session_origin_allowed(request) or not request.user.is_authenticated or not request.user.is_active:
        return error("access_denied", 403)
    # Include issued codes so users can revoke before the client redeems them.
    grants = (
        MCPOAuthGrant.objects.filter(user=request.user, revoked=False)
        .filter(Q(code_used=True) | Q(code_expires_at__gt=timezone.now()))
        .select_related("client", "workspace")
    )
    if request.method == "POST":
        try:
            updated = grants.filter(pk=request.POST.get("grant")).update(revoked=True)
        except (ValueError, ValidationError):
            return error()
        return secure(JsonResponse({"revoked": bool(updated)}, status=200 if updated else 404))
    return secure(
        JsonResponse(
            {
                "csrf_token": get_token(request),
                "connections": [
                    {
                        "id": str(grant.pk),
                        "client_name": grant.client.name,
                        "workspace_name": grant.workspace.name if grant.workspace_id else None,
                        "created_at": grant.created_at.isoformat(),
                        "status": "expired"
                        if grant.expires_at <= timezone.now()
                        else ("active" if grant.code_used else "pending"),
                        "scope": grant.scope,
                        "expires_at": grant.expires_at.isoformat(),
                    }
                    for grant in grants.order_by("-created_at")
                ],
            }
        )
    )
