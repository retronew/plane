# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.
import pytest

from plane.app.serializers import WorkSpaceSerializer
from plane.license.api.serializers.workspace import WorkspaceSerializer
from plane.db.models import Workspace


@pytest.mark.contract
@pytest.mark.django_db
def test_company_size_is_removed_from_workspace_contract(workspace):
    assert "organization_size" not in {field.name for field in Workspace._meta.fields}
    for serializer in (WorkSpaceSerializer, WorkspaceSerializer):
        assert "organization_size" not in serializer(workspace).data
        assert "company_size" not in serializer(workspace).data


@pytest.mark.contract
@pytest.mark.django_db
def test_workspace_settings_still_save_without_company_size(session_client, workspace):
    response = session_client.patch(
        f"/api/workspaces/{workspace.slug}/", {"name": "Updated workspace", "timezone": "Asia/Shanghai"}, format="json"
    )
    assert response.status_code == 200
    workspace.refresh_from_db()
    assert workspace.name == "Updated workspace"
    assert workspace.timezone == "Asia/Shanghai"
    assert "organization_size" not in response.json()


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("role,enabled,expected", [(20, False, 201), (15, False, 403), (15, True, 201), (5, True, 403)])
@pytest.mark.parametrize("external", [False, True])
def test_project_creation_policy(
    session_client, api_key_client, workspace, create_user, role, enabled, expected, external
):
    from plane.db.models import WorkspaceMember

    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role)
    workspace.allow_member_project_creation = enabled
    workspace.save()
    client = api_key_client if external else session_client
    prefix = "/api/v1" if external else "/api"
    response = client.post(
        f"{prefix}/workspaces/{workspace.slug}/projects/", {"name": "Policy", "identifier": "POL"}, format="json"
    )
    assert response.status_code == expected


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("field", ["ai_enabled", "allow_member_project_creation"])
def test_only_admin_can_change_workspace_features(session_client, workspace, create_user, field):
    from plane.db.models import WorkspaceMember

    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    response = session_client.patch(f"/api/workspaces/{workspace.slug}/", {field: False}, format="json")
    assert response.status_code == 403
    workspace.refresh_from_db()
    assert getattr(workspace, field) is True


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("stream", [False, True])
def test_disabled_workspace_ai_never_calls_provider(session_client, workspace, stream):
    from unittest.mock import patch
    from django.core.cache import cache
    from plane.app.views.external.base import WorkspaceGPTIntegrationEndpoint
    from rest_framework.test import APIRequestFactory, force_authenticate

    workspace.ai_enabled = False
    workspace.save()
    request = APIRequestFactory().post("/", {"task": "Improve", "prompt": "Draft", "stream": stream}, format="json")
    force_authenticate(request, user=workspace.owner)
    cache.clear()
    with patch("plane.app.views.external.base.get_llm_config") as config:
        response = WorkspaceGPTIntegrationEndpoint.as_view()(request, slug=workspace.slug)
    assert response.status_code == 403
    config.assert_not_called()


@pytest.mark.contract
@pytest.mark.django_db
def test_project_ai_endpoint_honors_workspace_toggle(session_client, workspace, create_user):
    from unittest.mock import patch
    from django.core.cache import cache
    from plane.db.models import Project, ProjectMember

    project = Project.objects.create(workspace=workspace, name="AI scope", identifier="AIS")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    workspace.ai_enabled = False
    workspace.save()
    cache.clear()
    with patch("plane.app.views.external.base.get_llm_config") as provider:
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/ai-assistant/", {"task": "Improve"}, format="json"
        )
    assert response.status_code == 403
    provider.assert_not_called()


@pytest.mark.contract
@pytest.mark.django_db
def test_webhook_title_update_and_secret_not_returned(session_client, workspace):
    from plane.db.models import Webhook

    webhook = Webhook.objects.create(workspace=workspace, url="https://example.com/test", is_active=False)
    endpoint = f"/api/workspaces/{workspace.slug}/webhooks/{webhook.id}/"
    response = session_client.patch(endpoint, {"name": "Build events"}, format="json")
    assert response.status_code == 200
    assert response.data["name"] == "Build events"
    assert "secret_key" not in response.data
    assert session_client.get(endpoint).data["name"] == "Build events"
