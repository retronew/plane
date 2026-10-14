# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from plane.db.models import (
    APIToken,
    Cycle,
    CycleIssue,
    Issue,
    Label,
    Module,
    ModuleLink,
    Project,
    ProjectIdentifier,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="P1", identifier="PONE", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


def _base(workspace, project):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/"


def _member(workspace, project, role=15, email="m@plane.so"):
    user = User.objects.create(email=email, username=email.split("@")[0])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    ProjectMember.objects.create(project=project, member=user, role=role, is_active=True)
    token = APIToken.objects.create(user=user, label="t", token=f"token-{user.username}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client, user


@pytest.mark.contract
class TestCycleInsights:
    @pytest.fixture
    def cycle(self, project, workspace, create_user):
        today = date.today()
        cycle = Cycle.objects.create(
            name="Sprint",
            owned_by=create_user,
            project=project,
            workspace=workspace,
            start_date=today - timedelta(days=3),
            end_date=today + timedelta(days=4),
        )
        done = State.objects.create(name="Done", group="completed", project=project, workspace=workspace)
        doing = State.objects.create(name="Doing", group="started", project=project, workspace=workspace)
        for name, state in (("a", done), ("b", doing), ("c", doing)):
            issue = Issue.objects.create(name=name, project=project, workspace=workspace, state=state)
            CycleIssue.objects.create(cycle=cycle, issue=issue, project=project, workspace=workspace)
        return cycle

    @pytest.mark.django_db
    def test_progress(self, api_key_client, workspace, project, cycle):
        data = api_key_client.get(f"{_base(workspace, project)}cycles/{cycle.id}/progress/").data
        assert data["total_issues"] == 3
        assert data["completed_issues"] == 1
        assert data["started_issues"] == 2

    @pytest.mark.django_db
    def test_analytics_has_burndown(self, api_key_client, workspace, project, cycle):
        response = api_key_client.get(f"{_base(workspace, project)}cycles/{cycle.id}/analytics/")
        assert response.status_code == 200
        assert "completion_chart" in response.data

    @pytest.mark.django_db
    def test_date_check(self, api_key_client, workspace, project, cycle):
        url = f"{_base(workspace, project)}cycles/date-check/"
        overlap = {"start_date": str(cycle.start_date), "end_date": str(cycle.end_date)}
        assert api_key_client.post(url, overlap, format="json").data["status"] is False
        free = {
            "start_date": str(date.today() + timedelta(days=30)),
            "end_date": str(date.today() + timedelta(days=40)),
        }
        assert api_key_client.post(url, free, format="json").data["status"] is True

    @pytest.mark.django_db
    def test_non_member_denied(self, workspace, project, cycle):
        user = User.objects.create(email="x@plane.so", username="x")
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
        token = APIToken.objects.create(user=user, label="t", token="token-x")
        client = APIClient()
        client.credentials(HTTP_X_API_KEY=token.token)
        assert client.get(f"{_base(workspace, project)}cycles/{cycle.id}/progress/").status_code == 403

    @pytest.mark.django_db
    def test_requires_api_key(self, workspace, project, cycle):
        assert APIClient().get(f"{_base(workspace, project)}cycles/{cycle.id}/progress/").status_code == 401


@pytest.mark.contract
class TestModuleLinks:
    @pytest.mark.django_db
    def test_crud(self, api_key_client, workspace, project):
        module = Module.objects.create(name="M", project=project, workspace=workspace)
        url = f"{_base(workspace, project)}modules/{module.id}/links/"
        created = api_key_client.post(url, {"title": "Spec", "url": "https://example.com/spec"}, format="json")
        assert created.status_code == 201, created.data
        link_id = created.data["id"]
        assert [link["id"] for link in api_key_client.get(url).data] == [link_id]
        patched = api_key_client.patch(f"{url}{link_id}/", {"title": "Spec v2", "url": "https://example.com/spec"}, format="json")
        assert patched.status_code == 200, (patched.status_code, patched.data)
        assert ModuleLink.objects.get(pk=link_id).title == "Spec v2"
        assert api_key_client.delete(f"{url}{link_id}/").status_code == 204
        assert not ModuleLink.objects.filter(pk=link_id).exists()


@pytest.mark.contract
class TestStatesProjectsLabels:
    @pytest.mark.django_db
    def test_mark_default_admin_only(self, api_key_client, workspace, project):
        old = State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace, default=True)
        new = State.objects.create(name="Backlog", group="backlog", project=project, workspace=workspace)
        url = f"{_base(workspace, project)}states/{new.id}/mark-default/"

        member, _ = _member(workspace, project)
        assert member.post(url).status_code == 403

        assert api_key_client.post(url).status_code == 204
        old.refresh_from_db()
        new.refresh_from_db()
        assert new.default and not old.default

    @pytest.mark.django_db
    def test_identifier_check_and_no_delete(self, api_key_client, workspace, project):
        ProjectIdentifier.objects.create(name="PONE", project=project, workspace=workspace)
        url = f"/api/v1/workspaces/{workspace.slug}/project-identifiers/"
        assert api_key_client.get(url, {"name": "PONE"}).data["exists"] >= 1
        assert api_key_client.get(url, {"name": "FREE"}).data["exists"] == 0
        assert api_key_client.delete(url, {"name": "PONE"}, format="json").status_code == 405

    @pytest.mark.django_db
    def test_member_leaves(self, workspace, project):
        client, user = _member(workspace, project)
        assert client.post(f"{_base(workspace, project)}members/leave/").status_code == 204
        assert not ProjectMember.objects.filter(project=project, member=user, is_active=True).exists()

    @pytest.mark.django_db
    def test_bulk_labels(self, api_key_client, workspace, project):
        Label.objects.create(name="Bug", project=project, workspace=workspace)
        url = f"{_base(workspace, project)}labels/bulk/"
        response = api_key_client.post(
            url, {"labels": [{"name": "bug"}, {"name": "Feature", "color": "#00AA00"}, "Docs"]}, format="json"
        )
        assert response.status_code == 201, response.data
        assert {label["name"] for label in response.data["created"]} == {"Feature", "Docs"}
        assert response.data["skipped"] == ["bug"]
        assert Label.objects.get(project=project, name="Feature").color == "#00AA00"
        assert api_key_client.post(url, {"labels": []}, format="json").status_code == 400
