# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from plane.db.models import (
    APIToken,
    CommentReaction,
    Issue,
    IssueComment,
    IssueDescriptionVersion,
    IssueReaction,
    IssueSubscriber,
    Project,
    ProjectMember,
    User,
    WorkspaceMember,
)


@pytest.fixture(autouse=True)
def _no_activity():
    with patch("plane.api.views.work_item_engagement.issue_activity.delay"):
        yield


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Eng", identifier="ENG", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def issue(project):
    return Issue.objects.create(name="Task", project=project, workspace=project.workspace)


def _base(workspace, project, issue):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/{issue.id}/"


def _guest(workspace, project, email="guest@plane.so", open_features=True):
    project.guest_view_all_features = open_features
    project.save(update_fields=["guest_view_all_features"])
    user = User.objects.create(email=email, username=email.split("@")[0])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=5)
    ProjectMember.objects.create(project=project, member=user, role=5, is_active=True)
    token = APIToken.objects.create(user=user, label="t", token=f"token-{user.username}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client, user


@pytest.mark.contract
class TestSubscriptions:
    @pytest.mark.django_db
    def test_subscribe_cycle(self, api_key_client, workspace, project, issue, create_user):
        url = _base(workspace, project, issue)
        assert api_key_client.get(f"{url}subscribe/").data == {"subscribed": False}
        assert api_key_client.post(f"{url}subscribe/").data == {"subscribed": True}
        assert api_key_client.post(f"{url}subscribe/").data == {"subscribed": True}  # idempotent
        assert IssueSubscriber.objects.filter(issue=issue, subscriber=create_user).count() == 1
        assert [s["id"] for s in api_key_client.get(f"{url}subscribers/").data] == [str(create_user.id)]
        assert api_key_client.delete(f"{url}subscribe/").data == {"subscribed": False}

    @pytest.mark.django_db
    def test_guest_can_subscribe_visible_item(self, workspace, project, issue):
        client, guest = _guest(workspace, project)
        assert client.post(f"{_base(workspace, project, issue)}subscribe/").status_code == 200

    @pytest.mark.django_db
    def test_restricted_guest_cannot_see_others_item(self, workspace, project, issue):
        client, _ = _guest(workspace, project, open_features=False)
        assert client.post(f"{_base(workspace, project, issue)}subscribe/").status_code == 404

    @pytest.mark.django_db
    def test_non_member_404(self, workspace, project, issue):
        user = User.objects.create(email="out@plane.so", username="out")
        token = APIToken.objects.create(user=user, label="t", token="token-out")
        client = APIClient()
        client.credentials(HTTP_X_API_KEY=token.token)
        assert client.get(f"{_base(workspace, project, issue)}subscribers/").status_code == 404


@pytest.mark.contract
class TestReactions:
    @pytest.mark.django_db
    def test_work_item_reactions(self, api_key_client, workspace, project, issue, create_user):
        url = f"{_base(workspace, project, issue)}reactions/"
        assert api_key_client.post(url, {"reaction": "👍"}, format="json").status_code == 201
        api_key_client.post(url, {"reaction": "👍"}, format="json")
        assert IssueReaction.objects.filter(issue=issue).count() == 1
        data = api_key_client.get(url).data
        assert data[0]["reaction"] == "👍" and data[0]["count"] == 1 and data[0]["mine"] is True

        assert api_key_client.post(url, {"reaction": ""}, format="json").status_code == 400
        assert api_key_client.delete(f"{url}👍/").status_code == 204
        assert not IssueReaction.objects.filter(issue=issue).exists()
        assert api_key_client.delete(f"{url}👍/").status_code == 404

    @pytest.mark.django_db
    def test_cannot_remove_others_reaction(self, workspace, project, issue, create_user):
        IssueReaction.objects.create(
            issue=issue, actor=create_user, reaction="🎉", project=project, workspace=workspace
        )
        client, _ = _guest(workspace, project)
        assert client.delete(f"{_base(workspace, project, issue)}reactions/🎉/").status_code == 404
        assert IssueReaction.objects.filter(issue=issue).exists()

    @pytest.mark.django_db
    def test_comment_reactions(self, api_key_client, workspace, project, issue):
        comment = IssueComment.objects.create(
            issue=issue, project=project, workspace=workspace, comment_html="<p>x</p>"
        )
        url = f"{_base(workspace, project, issue)}comments/{comment.id}/reactions/"
        assert api_key_client.post(url, {"reaction": "❤️"}, format="json").status_code == 201
        assert CommentReaction.objects.filter(comment=comment).count() == 1
        assert api_key_client.get(url).data[0]["count"] == 1
        assert api_key_client.delete(f"{url}❤️/").status_code == 204

        other = Issue.objects.create(name="Other", project=project, workspace=workspace)
        wrong = f"{_base(workspace, project, other)}comments/{comment.id}/reactions/"
        assert api_key_client.get(wrong).status_code == 404


@pytest.mark.contract
class TestDescriptionVersions:
    @pytest.mark.django_db
    def test_list_and_detail(self, api_key_client, workspace, project, issue, create_user):
        version = IssueDescriptionVersion.objects.create(
            issue=issue, project=project, workspace=workspace, owned_by=create_user, description_html="<p><b>v1</b></p>"
        )
        url = f"{_base(workspace, project, issue)}description-versions/"
        results = api_key_client.get(url).data["results"]
        assert [v["id"] for v in results] == [str(version.id)]
        assert "description_html" not in results[0]

        detail = api_key_client.get(f"{url}{version.id}/").data
        assert detail["description"] == "**v1**"
