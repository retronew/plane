# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import pytest
from django.db import close_old_connections
from django.utils import timezone
from rest_framework.test import APIClient

from plane.db.models import Issue, Project, ProjectMember, State


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="External", identifier="EXT", workspace=workspace)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    State.objects.create(name="Backlog", group="backlog", default=True, project=project, workspace=workspace)
    return project


@pytest.fixture(autouse=True)
def mute_tasks():
    with patch("plane.api.views.issue.issue_activity.delay"), patch("plane.api.views.issue.model_activity.delay"):
        yield


def url(workspace, project):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/"


@pytest.mark.contract
@pytest.mark.django_db
class TestExternalUpsert:
    def test_retry_normalizes_identity_and_preserves_uuid(self, api_key_client, workspace, project):
        payload = {"name": "First", "external_source": " importer ", "external_id": " 42 "}
        first = api_key_client.put(url(workspace, project) + "upsert/", payload, format="json")
        assert first.status_code == 201, first.data
        second = api_key_client.put(url(workspace, project) + "upsert/", {**payload, "name": "Updated"}, format="json")
        assert second.status_code == 200, second.data
        assert second.data["id"] == first.data["id"]
        assert Issue.objects.filter(project=project, external_source="importer", external_id="42").count() == 1

    def test_archived_subtask_is_updated_and_readable(self, api_key_client, workspace, project):
        parent = Issue.objects.create(project=project, name="Parent")
        issue = Issue.objects.create(
            project=project,
            parent=parent,
            name="Archived",
            archived_at=timezone.now(),
            external_source="importer",
            external_id="42",
        )
        response = api_key_client.put(
            url(workspace, project) + "upsert/",
            {"external_source": "importer", "external_id": "42", "name": "Updated"},
            format="json",
        )
        assert response.status_code == 200, response.data
        assert response.json()["id"] == str(issue.id)
        issue.refresh_from_db()
        assert issue.archived_at is not None
        assert issue.parent_id == parent.id
        assert issue.name == "Updated"
        assert api_key_client.get(url(workspace, project) + f"{issue.id}/").status_code == 404
        detail = api_key_client.get(url(workspace, project) + f"{issue.id}/?include_archived=true")
        assert detail.status_code == 200
        assert detail.json()["id"] == str(issue.id)
        lookup = api_key_client.get(url(workspace, project), {"external_source": "importer", "external_id": "42"})
        assert lookup.status_code == 200
        assert lookup.json()["id"] == str(issue.id)

    def test_duplicate_identity_is_conflict(self, api_key_client, workspace, project):
        for name in ("One", "Two"):
            Issue.objects.create(project=project, name=name, external_source="importer", external_id="42")
        response = api_key_client.put(
            url(workspace, project) + "upsert/",
            {"external_source": "importer", "external_id": "42", "name": "Changed"},
            format="json",
        )
        assert response.status_code == 409
        assert not Issue.objects.filter(project=project, name="Changed").exists()

    def test_same_identity_in_other_project_is_not_updated(self, api_key_client, workspace, project):
        other = Project.objects.create(name="Other", identifier="OTHER", workspace=workspace)
        issue = Issue.objects.create(project=other, name="Untouched", external_source="importer", external_id="42")
        response = api_key_client.put(
            url(workspace, project) + "upsert/",
            {"external_source": "importer", "external_id": "42", "name": "New"},
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.json()["id"] != str(issue.id)
        issue.refresh_from_db()
        assert issue.name == "Untouched"

    @pytest.mark.parametrize("payload", [{}, {"external_id": "42"}, {"external_source": "importer"}])
    def test_requires_identity(self, api_key_client, workspace, project, payload):
        response = api_key_client.put(url(workspace, project) + "upsert/", {"name": "New", **payload}, format="json")
        assert response.status_code == 400
        assert not Issue.objects.filter(project=project).exists()

    def test_lookup_missing_and_duplicate(self, api_key_client, workspace, project):
        query = {"external_source": "importer", "external_id": "42"}
        assert api_key_client.get(url(workspace, project), query).status_code == 404
        for name in ("One", "Two"):
            Issue.objects.create(project=project, name=name, **query)
        assert api_key_client.get(url(workspace, project), query).status_code == 409

    def test_create_requires_name(self, api_key_client, workspace, project):
        response = api_key_client.put(
            url(workspace, project) + "upsert/",
            {"external_source": "importer", "external_id": "42"},
            format="json",
        )
        assert response.status_code == 400
        assert not Issue.objects.filter(project=project).exists()

    def test_non_member_cannot_upsert(self, api_key_client, workspace, project):
        ProjectMember.objects.filter(project=project).update(is_active=False)
        response = api_key_client.put(
            url(workspace, project) + "upsert/",
            {"external_source": "importer", "external_id": "42", "name": "Denied"},
            format="json",
        )
        assert response.status_code == 403
        assert not Issue.objects.filter(project=project).exists()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
def test_concurrent_upserts_share_one_uuid(workspace, project, api_token):
    barrier = Barrier(2)
    endpoint = url(workspace, project) + "upsert/"

    def upsert():
        close_old_connections()
        try:
            client = APIClient()
            client.credentials(HTTP_X_API_KEY=api_token.token)
            barrier.wait(timeout=10)
            response = client.put(
                endpoint,
                {"name": "Concurrent", "external_source": "importer", "external_id": "42"},
                format="json",
            )
            return response.status_code, response.data
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: upsert(), range(2)))
    assert sorted(code for code, _ in results) == [200, 201], results
    assert results[0][1]["id"] == results[1][1]["id"]
    assert Issue.objects.filter(project=project, external_source="importer", external_id="42").count() == 1
