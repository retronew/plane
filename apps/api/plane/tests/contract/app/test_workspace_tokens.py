from datetime import timedelta
import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from plane.db.models import APIToken, Workspace, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def url(workspace, token=None):
    return f"/api/workspaces/{workspace.slug}/api-tokens/" + (f"{token.id}/" if token else "")


def test_workspace_token_lifecycle_and_personal_isolation(session_client, workspace):
    response = session_client.post(url(workspace), {"label": "Automation", "scope": "read"}, format="json")
    assert response.status_code == 201
    token = APIToken.objects.get(pk=response.data["id"])
    assert token.workspace == workspace
    assert response.data["token"]
    listed = session_client.get(url(workspace)).data
    assert len(listed) == 1 and "token" not in listed[0]
    detail = session_client.get(url(workspace, token))
    assert detail.status_code == 200 and "token" not in detail.data
    assert not session_client.get("/api/users/api-tokens/").data
    assert session_client.delete(f"/api/users/api-tokens/{token.id}/").status_code == 404
    assert session_client.delete(url(workspace, token)).status_code == 204
    assert not APIToken.objects.filter(pk=token.id).exists()


@pytest.mark.parametrize("role", [15, 5])
def test_non_admin_cannot_manage_tokens(session_client, workspace, create_user, role):
    token = APIToken.objects.create(workspace=workspace, user=create_user)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role)
    assert session_client.get(url(workspace)).status_code == 403
    assert session_client.post(url(workspace), {"label": "No"}, format="json").status_code == 403
    assert session_client.delete(url(workspace, token)).status_code == 403


@pytest.mark.parametrize(
    "payload", [{"label": ""}, {"label": "Bad", "scope": "admin"}, {"label": "Bad", "expired_at": "invalid"}]
)
def test_invalid_tokens_are_rejected(session_client, workspace, payload):
    assert session_client.post(url(workspace), payload, format="json").status_code == 400
    assert not APIToken.objects.filter(workspace=workspace).exists()


def test_past_expiration_is_rejected(session_client, workspace):
    assert (
        session_client.post(
            url(workspace),
            {"label": "Old", "expired_at": (timezone.now() - timedelta(days=1)).isoformat()},
            format="json",
        ).status_code
        == 400
    )


def test_scoped_authentication_and_revocation(session_client, workspace, create_user):
    other = Workspace.objects.create(name="Other", slug="other", owner=create_user)
    WorkspaceMember.objects.create(workspace=other, member=create_user, role=20)
    token = APIToken.objects.create(workspace=workspace, user=create_user, scope="read")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    endpoint = f"/api/v1/workspaces/{workspace.slug}/projects/"
    assert client.get(endpoint).status_code == 200
    token.refresh_from_db()
    assert token.last_used is not None
    assert client.get(f"/api/v1/workspaces/{other.slug}/projects/").status_code == 403
    assert client.post(endpoint, {}, format="json").status_code == 403
    assert session_client.delete(url(other, token)).status_code == 404
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    assert client.get(endpoint).status_code == 403
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=20)
    token.expired_at = timezone.now() - timedelta(seconds=1)
    token.save()
    assert client.get(endpoint).status_code in (401, 403)
    token.expired_at = None
    token.save()
    assert session_client.delete(url(workspace, token)).status_code == 204
    assert client.get(endpoint).status_code in (401, 403)


def test_workspace_token_cannot_access_unscoped_endpoints(workspace, create_user):
    from types import SimpleNamespace
    from plane.api.middleware.api_authentication import APIKeyAuthentication
    from rest_framework.exceptions import PermissionDenied

    token = APIToken.objects.create(workspace=workspace, user=create_user)
    with pytest.raises(PermissionDenied):
        APIKeyAuthentication().validate_api_token(
            token.token, SimpleNamespace(method="GET", resolver_match=SimpleNamespace(kwargs={}))
        )


def test_inactive_token_is_not_reported_active(session_client, workspace, create_user):
    APIToken.objects.create(workspace=workspace, user=create_user, is_active=False)
    assert session_client.get(url(workspace)).data[0]["is_active"] is False
