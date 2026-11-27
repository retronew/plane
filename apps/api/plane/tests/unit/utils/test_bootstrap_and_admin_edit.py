# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.utils import timezone
import pytest
from rest_framework.test import APIClient

from plane.db.models import FileAsset, Project, ProjectMember, User, Workspace, WorkspaceMember


@pytest.mark.unit
@pytest.mark.django_db
class TestWorkspaceAdminUnjoinedProjectEdit:
    def _setup_workspace_and_project(self):
        admin_user = User.objects.create_user(
            email="ws-admin@example.com",
            username="ws-admin",
            password="test-password-123",
            is_active=True,
        )
        member_user = User.objects.create_user(
            email="ws-member@example.com",
            username="ws-member",
            password="test-password-123",
            is_active=True,
        )
        owner_user = User.objects.create_user(
            email="proj-owner@example.com",
            username="proj-owner",
            password="test-password-123",
            is_active=True,
        )
        workspace = Workspace.objects.create(name="Test WS", slug="test-ws-admin-edit", owner=owner_user)
        WorkspaceMember.objects.create(workspace=workspace, member=owner_user, role=20, is_active=True)
        WorkspaceMember.objects.create(workspace=workspace, member=admin_user, role=20, is_active=True)
        WorkspaceMember.objects.create(workspace=workspace, member=member_user, role=15, is_active=True)

        project = Project.objects.create(
            workspace=workspace,
            name="Unjoined Project",
            identifier="UNJOIN",
            created_by=owner_user,
        )
        ProjectMember.objects.create(workspace=workspace, project=project, member=owner_user, role=20, is_active=True)
        return admin_user, member_user, workspace, project

    def test_workspace_admin_can_patch_unjoined_project(self):
        admin_user, _, workspace, project = self._setup_workspace_and_project()
        client = APIClient()
        client.force_authenticate(user=admin_user)

        resp = client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/",
            {
                "logo_props": {
                    "in_use": "icon",
                    "icon": {"name": "rocket_launch", "color": "#818cf8", "background_color": "#1e264a"},
                }
            },
            format="json",
        )
        assert resp.status_code == 200
        project.refresh_from_db()
        assert project.logo_props["icon"]["name"] == "rocket_launch"
        assert project.logo_props["icon"]["background_color"] == "#1e264a"
        assert not ProjectMember.objects.filter(project=project, member=admin_user).exists()

    def test_workspace_member_cannot_patch_unjoined_project(self):
        _, member_user, workspace, project = self._setup_workspace_and_project()
        client = APIClient()
        client.force_authenticate(user=member_user)

        resp = client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/",
            {"name": "Should Fail"},
            format="json",
        )
        assert resp.status_code == 403

    def test_archived_project_remains_read_only_for_workspace_admin(self):
        admin_user, _, workspace, project = self._setup_workspace_and_project()
        project.archived_at = timezone.now()
        project.save(update_fields=["archived_at"])

        client = APIClient()
        client.force_authenticate(user=admin_user)
        resp = client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/",
            {"name": "Archived Edit"},
            format="json",
        )
        assert resp.status_code == 400

    def test_workspace_admin_can_confirm_unjoined_project_cover_asset(self):
        admin_user, member_user, workspace, project = self._setup_workspace_and_project()
        cover_asset = FileAsset.objects.create(
            workspace=workspace,
            project=project,
            created_by=admin_user,
            entity_type=FileAsset.EntityTypeContext.PROJECT_COVER,
            asset=f"{workspace.id}/cover-test.jpg",
            attributes={"name": "cover-test.jpg", "type": "image/jpeg", "size": 1024},
            size=1024,
            storage_metadata={"verified": True},
        )
        issue_asset = FileAsset.objects.create(
            workspace=workspace,
            project=project,
            created_by=admin_user,
            entity_type=FileAsset.EntityTypeContext.ISSUE_DESCRIPTION,
            asset=f"{workspace.id}/issue-test.jpg",
            attributes={"name": "issue-test.jpg", "type": "image/jpeg", "size": 1024},
            size=1024,
            storage_metadata={"verified": True},
        )

        # Non-admin non-member cannot confirm PROJECT_COVER
        member_client = APIClient()
        member_client.force_authenticate(user=member_user)
        assert member_client.patch(f"/api/assets/v2/workspaces/{workspace.slug}/{cover_asset.id}/").status_code == 403

        # Workspace admin CAN confirm PROJECT_COVER without joining
        admin_client = APIClient()
        admin_client.force_authenticate(user=admin_user)
        resp = admin_client.patch(f"/api/assets/v2/workspaces/{workspace.slug}/{cover_asset.id}/")
        assert resp.status_code == 204
        project.refresh_from_db()
        assert project.cover_image_asset_id == cover_asset.id

        # Workspace admin still cannot confirm non-cover project assets (ISSUE_DESCRIPTION) without joining
        assert admin_client.patch(f"/api/assets/v2/workspaces/{workspace.slug}/{issue_asset.id}/").status_code == 403


@pytest.mark.unit
@pytest.mark.django_db
class TestBootstrapEndpoints:
    def test_app_bootstrap_unauthenticated_and_authenticated(self):
        client = APIClient()
        anon_resp = client.get("/api/bootstrap/")
        assert anon_resp.status_code == 200
        assert anon_resp.data["authenticated"] is False
        assert anon_resp.data["user"] is None

        user = User.objects.create_user(
            email="boot@example.com",
            username="boot-user",
            password="test-password-123",
            is_active=True,
        )
        client.force_authenticate(user=user)
        auth_resp = client.get("/api/bootstrap/")
        assert auth_resp.status_code == 200
        auth_json = auth_resp.json()
        assert auth_json["authenticated"] is True
        assert auth_json["user"]["id"] == str(user.id)
        assert "workspaces" in auth_json
        assert "instance_admin" in auth_json

    def test_workspace_view_and_project_bootstrap(self):
        user = User.objects.create_user(
            email="wsboot@example.com",
            username="wsboot-user",
            password="test-password-123",
            is_active=True,
        )
        outsider = User.objects.create_user(
            email="outsider@example.com",
            username="outsider-user",
            password="test-password-123",
            is_active=True,
        )
        workspace = Workspace.objects.create(name="Boot WS", slug="boot-ws", owner=user)
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=20, is_active=True)
        project = Project.objects.create(workspace=workspace, name="Boot Proj", identifier="BOOT", created_by=user)
        ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=20, is_active=True)

        outsider_client = APIClient()
        outsider_client.force_authenticate(user=outsider)
        assert outsider_client.get(f"/api/workspaces/{workspace.slug}/bootstrap/").status_code == 403
        assert outsider_client.get(f"/api/workspaces/{workspace.slug}/view-bootstrap/").status_code == 403

        client = APIClient()
        client.force_authenticate(user=user)

        ws_resp = client.get(f"/api/workspaces/{workspace.slug}/bootstrap/?projects=full")
        assert ws_resp.status_code == 200
        assert ws_resp.data["projects_mode"] == "full"
        assert isinstance(ws_resp.data["projects"], list)
        assert ws_resp.data["workspace_member_me"]["role"] == 20
        assert "members" in ws_resp.data
        assert "states" in ws_resp.data
        assert "sidebar_preferences" in ws_resp.data

        view_resp = client.get(f"/api/workspaces/{workspace.slug}/view-bootstrap/")
        assert view_resp.status_code == 200
        for key in ("views", "modules", "cycles", "labels", "estimates"):
            assert key in view_resp.data

        proj_resp = client.get(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/bootstrap/?include=core,user_properties,cycles,modules,views"
        )
        assert proj_resp.status_code == 200
        proj_json = proj_resp.json()
        assert proj_json["project"]["id"] == str(project.id)
        assert proj_json["project_member_me"]["role"] == 20
        assert "states" in proj_json
        assert "labels" in proj_json
        assert "members" in proj_json
