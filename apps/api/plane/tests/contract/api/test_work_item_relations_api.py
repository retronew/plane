# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from plane.db.models import APIToken, Issue, IssueRelation, Project, ProjectMember, User, Workspace, WorkspaceMember


@pytest.fixture(autouse=True)
def no_activity():
    with patch("plane.api.views.work_item_relations.issue_activity.delay"):
        yield


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Relations", identifier="REL", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def issue(project, create_user):
    return item(project, name="Source", created_by=create_user)


def url(workspace, project, issue):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/{issue.id}/relations/"


def item(project, name="Target", **kwargs):
    issue = Issue(name=name, project=project, workspace=project.workspace, **kwargs)
    # BaseModel.save otherwise replaces the explicit creator with CRUM's current user.
    issue.save(disable_auto_set_user=True)
    return issue


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkItemRelationsAPI:
    @pytest.mark.parametrize("relation_type,inverse", [("blocking", "blocked_by"), ("blocked_by", "blocking")])
    def test_direction_idempotence_and_remove(self, api_key_client, workspace, project, issue, relation_type, inverse):
        target = item(project)
        endpoint = url(workspace, project, issue)
        payload = {"relation_type": relation_type, "issues": [str(target.id), str(target.id)]}
        for _ in range(2):
            response = api_key_client.post(endpoint, payload, format="json")
            assert response.status_code == 201
            assert [str(row["id"]) for row in response.data] == [str(target.id)]
        relation = IssueRelation.objects.get()
        assert relation.relation_type == "blocked_by"
        assert relation.issue_id == (target.id if relation_type == "blocking" else issue.id)
        assert api_key_client.get(endpoint).data[relation_type] == [
            {"project_id": str(project.id), "issue_id": str(target.id)}
        ]
        assert api_key_client.get(url(workspace, project, target)).data[inverse] == [
            {"project_id": str(project.id), "issue_id": str(issue.id)}
        ]
        for _ in range(2):
            response = api_key_client.delete(endpoint, payload, format="json")
            assert response.status_code == 200
            assert response.data[relation_type] == []
        assert not IssueRelation.objects.exists()

    @pytest.mark.parametrize("method", ["post", "delete"])
    @pytest.mark.parametrize("invalid", ["self", "missing", "malformed", "foreign", "private"])
    def test_invalid_batch_is_atomic(self, api_key_client, workspace, project, issue, create_user, method, invalid):
        target = item(project)
        other = Project.objects.create(name="Hidden", identifier="HID", workspace=workspace, network=0)
        bad_id = uuid4()
        expected = 404
        if invalid == "self":
            bad_id, expected = issue.id, 400
        elif invalid == "malformed":
            bad_id, expected = "invalid", 400
        elif invalid == "private":
            bad_id = item(other).id
        elif invalid == "foreign":
            foreign = Workspace.objects.create(name="Foreign", slug=f"foreign-{uuid4().hex}", owner=create_user)
            foreign_project = Project.objects.create(name="Foreign", identifier="FOR", workspace=foreign)
            bad_id = item(foreign_project).id
        relation = IssueRelation.objects.create(
            issue=issue, related_issue=target, relation_type="blocked_by", project=project, workspace=workspace
        )
        payload = {"relation_type": "blocked_by", "issues": [str(target.id), str(bad_id)]}
        response = getattr(api_key_client, method)(url(workspace, project, issue), payload, format="json")
        assert response.status_code == expected
        assert list(IssueRelation.objects.values_list("id", flat=True)) == [relation.id]

    def test_hidden_targets_are_filtered_and_cross_project_is_supported(
        self, api_key_client, workspace, project, issue, create_user
    ):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace, network=0)
        target = item(other)
        endpoint = url(workspace, project, issue)
        IssueRelation.objects.create(
            issue=issue, related_issue=target, relation_type="blocked_by", project=project, workspace=workspace
        )
        assert api_key_client.get(endpoint).data["blocked_by"] == []
        ProjectMember.objects.create(project=other, member=create_user, role=15, is_active=True)
        payload = {"relation_type": "blocked_by", "issues": [str(target.id)]}
        assert api_key_client.post(endpoint, payload, format="json").status_code == 201
        assert api_key_client.get(endpoint).data["blocked_by"][0]["issue_id"] == str(target.id)
        assert api_key_client.delete(endpoint, payload, format="json").status_code == 200

    @pytest.mark.parametrize("method", ["post", "delete"])
    def test_restricted_target_guest(self, api_key_client, workspace, project, issue, create_user, method):
        other = Project.objects.create(
            name="Restricted", identifier="RST", workspace=workspace, guest_view_all_features=False
        )
        ProjectMember.objects.create(project=other, member=create_user, role=5, is_active=True)
        target = item(other)
        payload = {"relation_type": "blocked_by", "issues": [str(target.id)]}
        endpoint = url(workspace, project, issue)
        assert getattr(api_key_client, method)(endpoint, payload, format="json").status_code == 404
        target.created_by = create_user
        target.save(update_fields=["created_by"], disable_auto_set_user=True)
        target.refresh_from_db()
        assert target.created_by_id == create_user.id
        assert getattr(api_key_client, method)(endpoint, payload, format="json").status_code == (
            201 if method == "post" else 200
        )

    def test_conflicting_type_preserves_existing_relation(self, api_key_client, workspace, project, issue):
        target = item(project)
        relation = IssueRelation.objects.create(
            issue=issue, related_issue=target, relation_type="relates_to", project=project, workspace=workspace
        )
        payload = {"relation_type": "blocked_by", "issues": [str(target.id)]}
        assert api_key_client.post(url(workspace, project, issue), payload, format="json").status_code == 400
        relation.refresh_from_db()
        assert relation.relation_type == "relates_to"

    def test_read_only_token(self, api_key_client, api_token, workspace, project, issue):
        api_token.scope = APIToken.SCOPE_READ
        api_token.save(update_fields=["scope"])
        endpoint = url(workspace, project, issue)
        target = item(project)
        payload = {"relation_type": "blocking", "issues": [str(target.id)]}
        assert api_key_client.get(endpoint).status_code == 200
        assert api_key_client.post(endpoint, payload, format="json").status_code == 403
        assert api_key_client.delete(endpoint, payload, format="json").status_code == 403
        assert not IssueRelation.objects.exists()

    def test_source_must_belong_to_path_project(self, api_key_client, workspace, project, issue):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
        assert api_key_client.get(url(workspace, other, issue)).status_code == 404
        assert api_key_client.get(url(workspace, project, uuid_item())).status_code == 404

    def test_restricted_guest_visibility_and_no_mutation(self, workspace, project, issue):
        guest = User.objects.create(email="relations-guest@example.com", username="relations-guest")
        WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
        ProjectMember.objects.create(project=project, member=guest, role=5, is_active=True)
        project.guest_view_all_features = False
        project.save(update_fields=["guest_view_all_features"])
        token = APIToken.objects.create(user=guest, label="guest", token="relations-guest-token")
        client = APIClient()
        client.credentials(HTTP_X_API_KEY=token.token)
        own = item(project, created_by=guest)
        IssueRelation.objects.create(
            issue=own, related_issue=issue, relation_type="blocked_by", project=project, workspace=workspace
        )
        assert client.get(url(workspace, project, issue)).status_code == 404
        own.refresh_from_db()
        assert own.created_by_id == guest.id
        response = client.get(url(workspace, project, own))
        assert response.status_code == 200, response.data
        assert response.data["blocked_by"] == []
        payload = {"relation_type": "blocking", "issues": [str(issue.id)]}
        assert client.post(url(workspace, project, own), payload, format="json").status_code == 403
        assert client.delete(url(workspace, project, own), payload, format="json").status_code == 403

    @pytest.mark.parametrize(
        "payload",
        [
            {"relation_type": "blocks", "issues": []},
            {"relation_type": "blocking", "issues": []},
            {"issues": [str(uuid4())]},
        ],
    )
    def test_invalid_payload(self, api_key_client, workspace, project, issue, payload):
        endpoint = url(workspace, project, issue)
        assert api_key_client.post(endpoint, payload, format="json").status_code == 400
        assert api_key_client.delete(endpoint, payload, format="json").status_code == 400


def uuid_item():
    # A path-shaped object without creating a database row.
    from types import SimpleNamespace

    return SimpleNamespace(id=uuid4())
