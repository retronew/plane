# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue, Project, ProjectMember


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Old", identifier="OLD", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.mark.contract
class TestLegacyIssuePaths:
    @pytest.mark.django_db
    def test_legacy_route_works_and_points_to_successor(self, api_key_client, workspace, project):
        issue = Issue.objects.create(name="X", project=project, workspace=workspace)
        legacy = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/issues/{issue.id}/"

        response = api_key_client.get(legacy)

        assert response.status_code == 200
        assert response.data["id"] == issue.id
        assert response["Deprecation"] == "true"
        assert response["Link"] == f'<{legacy.replace("/issues/", "/work-items/")}>; rel="successor-version"'

    @pytest.mark.django_db
    def test_attachment_successor_is_renamed(self, api_key_client, workspace, project):
        issue = Issue.objects.create(name="X", project=project, workspace=workspace)
        base = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}"
        response = api_key_client.get(f"{base}/issues/{issue.id}/issue-attachments/")
        assert response["Link"] == f'<{base}/work-items/{issue.id}/attachments/>; rel="successor-version"'

    @pytest.mark.django_db
    def test_new_route_is_not_deprecated(self, api_key_client, workspace, project):
        issue = Issue.objects.create(name="X", project=project, workspace=workspace)
        response = api_key_client.get(
            f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/{issue.id}/"
        )
        assert response.status_code == 200
        assert "Deprecation" not in response
