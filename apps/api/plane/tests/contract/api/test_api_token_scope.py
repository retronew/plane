# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import APIToken, Project, ProjectMember


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Scope", identifier="SCP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def read_only_client(db, create_user):
    token = APIToken.objects.create(user=create_user, label="ro", token="read-only-token", scope=APIToken.SCOPE_READ)
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client


def _labels_url(workspace, project):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/labels/"


@pytest.mark.contract
class TestApiTokenScope:
    @pytest.mark.django_db
    def test_existing_tokens_default_to_write(self, api_token):
        assert api_token.scope == APIToken.SCOPE_WRITE

    @pytest.mark.django_db
    def test_read_only_token_can_read(self, read_only_client, workspace, project):
        assert read_only_client.get(_labels_url(workspace, project)).status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    @pytest.mark.parametrize("method", ["post", "patch", "put", "delete"])
    def test_read_only_token_cannot_write(self, read_only_client, workspace, project, method):
        response = getattr(read_only_client, method)(_labels_url(workspace, project), {"name": "x"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_write_token_can_write(self, api_key_client, workspace, project):
        response = api_key_client.post(_labels_url(workspace, project), {"name": "x"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.contract
class TestApiTokenCreateScope:
    url = "/api/users/api-tokens/"

    @pytest.mark.django_db
    def test_create_read_only_token(self, session_client):
        response = session_client.post(self.url, {"label": "ro", "scope": "read"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert APIToken.objects.get(pk=response.data["id"]).scope == APIToken.SCOPE_READ

    @pytest.mark.django_db
    def test_create_defaults_to_write(self, session_client):
        response = session_client.post(self.url, {"label": "rw"}, format="json")
        assert response.data["scope"] == APIToken.SCOPE_WRITE

    @pytest.mark.django_db
    def test_invalid_scope_rejected(self, session_client):
        response = session_client.post(self.url, {"label": "x", "scope": "admin"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
