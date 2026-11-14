"""Contracts for public adapters of reminder, member work and comment reviews."""

from unittest.mock import patch
from uuid import uuid4

import pytest

from plane.db.models import (
    APIToken,
    Issue,
    IssueAssignee,
    IssueComment,
    IssueCommentReview,
    Project,
    ProjectActivity,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def records(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Public business", identifier="PB")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    author = User.objects.create(email="public-author@example.com", username="public-author")
    WorkspaceMember.objects.create(workspace=workspace, member=author, role=15)
    ProjectMember.objects.create(project=project, member=author, role=15)
    state = State.objects.create(project=project, name="Started", group="started")
    issue = Issue.objects.create(project=project, name="Assigned", state=state)
    IssueAssignee.objects.create(project=project, issue=issue, assignee=create_user)
    comment = IssueComment.objects.create(project=project, issue=issue, actor=author, comment_html="Reason")
    return project, issue, comment


def urls(workspace, records):
    project, issue, comment = records
    root = f"/api/v1/workspaces/{workspace.slug}"
    project_url = f"{root}/projects/{project.id}/"
    return root, project_url, f"{project_url}work-items/{issue.id}/", str(comment.id)


def test_reminder_patch_and_activities(api_key_client, workspace, records):
    _, url, _, _ = urls(workspace, records)
    payload = {
        "remind_in": 3,
        "remind_email_enabled": False,
        "remind_feishu_enabled": False,
        "timezone": "Asia/Shanghai",
    }
    with patch("plane.api.views.project.model_activity.delay"):
        response = api_key_client.patch(url, payload, format="json")
    assert response.status_code == 200, response.data
    assert {key: response.data[key] for key in payload} == payload
    events = ProjectActivity.objects.filter(project=records[0])
    assert set(events.values_list("field", flat=True)) == set(payload)
    response = api_key_client.get(url + "activities/", {"per_page": 2})
    assert response.status_code == 200, response.data
    assert response.data["total_results"] == 4
    assert len(response.data["results"]) == 2


@pytest.mark.parametrize(
    "payload", [{"remind_in": -1}, {"remind_in": 8}, {"timezone": "Mars/Unknown"}, {"remind_email_enabled": "bad"}]
)
def test_invalid_reminders(api_key_client, workspace, records, payload):
    _, url, _, _ = urls(workspace, records)
    response = api_key_client.patch(url, payload, format="json")
    assert response.status_code == 400, response.data
    assert not ProjectActivity.objects.filter(project=records[0]).exists()


def test_reminder_audit_failure_is_atomic(api_key_client, workspace, records):
    _, url, _, _ = urls(workspace, records)
    with patch("plane.app.views.project.overview.record_project_activity", side_effect=RuntimeError("audit failed")):
        response = api_key_client.patch(url, {"remind_in": 5}, format="json")
    assert response.status_code == 500
    records[0].refresh_from_db()
    assert records[0].remind_in == 0


def test_member_work(api_key_client, workspace, create_user, records):
    root, _, _, _ = urls(workspace, records)
    response = api_key_client.get(root + "/member-work/")
    assert response.status_code == 200, response.data
    assert next(row for row in response.data["rows"] if row["id"] == str(create_user.id))["assigned"] == 1
    url = root + f"/member-work/{create_user.id}/items/"
    response = api_key_client.get(url)
    assert response.status_code == 200, response.data
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == str(records[1].id)
    assert api_key_client.get(url, {"status": "invalid"}).status_code == 400
    assert api_key_client.get(root + "/member-work/", {"project_ids": "invalid"}).status_code == 400
    ProjectMember.objects.filter(project=records[0], member=create_user).update(is_active=False)
    assert api_key_client.get(url).data["count"] == 0


def test_review_contract(api_key_client, workspace, create_user, records):
    _, _, issue_url, comment_id = urls(workspace, records)
    url = issue_url + f"comments/{comment_id}/review/"
    response = api_key_client.post(url, {"status": "justified"}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["status"] == "justified"
    response = api_key_client.get(issue_url + "comment-reviews/")
    assert response.status_code == 200, response.data
    assert response.data["can_review"] is True
    assert response.data["reviews"][0]["status"] == "justified"
    IssueComment.objects.filter(pk=comment_id).update(comment_html="Edited")
    assert api_key_client.get(issue_url + "comment-reviews/").data["reviews"][0]["is_stale"]
    IssueComment.objects.filter(pk=comment_id).update(created_by=create_user)
    assert api_key_client.post(url, {"status": "justified"}, format="json").status_code == 403
    assert IssueCommentReview.objects.count() == 1
    assert (
        api_key_client.post(url.replace(comment_id, str(uuid4())), {"status": "justified"}, format="json").status_code
        == 404
    )


@pytest.mark.parametrize("role", [5, 15])
def test_review_requires_admin(api_key_client, workspace, create_user, records, role):
    _, _, issue_url, comment_id = urls(workspace, records)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    ProjectMember.objects.filter(project=records[0], member=create_user).update(role=role)
    assert (
        api_key_client.post(
            issue_url + f"comments/{comment_id}/review/", {"status": "justified"}, format="json"
        ).status_code
        == 403
    )


def test_read_only_token(api_key_client, api_token, workspace, records):
    root, url, issue_url, comment_id = urls(workspace, records)
    api_token.scope = APIToken.SCOPE_READ
    api_token.save()
    for read_url in [root + "/member-work/", url + "activities/", issue_url + "comment-reviews/"]:
        assert api_key_client.get(read_url).status_code == 200
    assert api_key_client.patch(url, {"remind_in": 2}, format="json").status_code == 403
    assert (
        api_key_client.post(
            issue_url + f"comments/{comment_id}/review/", {"status": "justified"}, format="json"
        ).status_code
        == 403
    )


def test_removed_membership(api_key_client, workspace, create_user, records):
    root, url, issue_url, _ = urls(workspace, records)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(is_active=False)
    for read_url in [root + "/member-work/", url + "activities/", issue_url + "comment-reviews/"]:
        assert api_key_client.get(read_url).status_code == 403


def test_oauth_read_only(api_client, workspace, create_user, records):
    from datetime import timedelta

    from django.utils import timezone

    from plane.db.models import MCPOAuthClient, MCPOAuthGrant, MCPOAuthToken
    from plane.mcp.oauth import digest, resource

    expiry = timezone.now() + timedelta(hours=1)
    client = MCPOAuthClient.objects.create(name="Public contract", redirect_uris=["http://localhost/callback"])
    grant = MCPOAuthGrant.objects.create(
        client=client,
        user=create_user,
        workspace=workspace,
        scope="plane:read",
        resource=resource(),
        redirect_uri="http://localhost/callback",
        code_hash=digest("code"),
        code_challenge="a" * 43,
        code_expires_at=expiry,
        expires_at=expiry,
    )
    MCPOAuthToken.objects.create(
        grant=grant,
        access_hash=digest("public-contract-token"),
        refresh_hash=digest("refresh"),
        access_expires_at=expiry,
    )
    from django.test import RequestFactory
    from plane.mcp.gateway import ApiGateway

    gateway = ApiGateway(RequestFactory().get("/mcp"), "public-contract-token", oauth=True)
    root, url, issue_url, comment_id = urls(workspace, records)
    for read_url in [root + "/member-work/", url + "activities/", issue_url + "comment-reviews/"]:
        response = gateway.call("GET", read_url.removeprefix("/api/v1/"))
        assert response.status == 200, response.data
    assert gateway.call("PATCH", url.removeprefix("/api/v1/"), body={"remind_in": 2}).status == 403
    response = gateway.call(
        "POST", (issue_url + f"comments/{comment_id}/review/").removeprefix("/api/v1/"),
        body={"status": "justified"},
    )
    assert response.status == 403
