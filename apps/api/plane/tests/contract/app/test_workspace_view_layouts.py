import io
import json
from unittest.mock import patch

import pytest
from plane.db.models import ExporterHistory, Issue, IssueAssignee, Project, ProjectMember, State, WorkspaceMember
from plane.bgtasks.export_task import issue_export_task

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def view_items(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Views", identifier="VWS")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, workspace=workspace, name="Ready", group="unstarted")
    first = Issue.objects.create(project=project, name="First", state=state, priority="high", target_date="2026-10-15")
    second = Issue.objects.create(
        project=project, name="Second", state=state, priority="high", target_date="2026-10-16"
    )
    Issue.objects.create(project=project, name="Low", state=state, priority="low")
    private = Project.objects.create(workspace=workspace, name="Private", identifier="PRV")
    hidden = Issue.objects.create(project=private, name="Hidden", priority="high")
    return project, first, second, hidden


@pytest.mark.parametrize(
    "group_by", ["state__group", "priority", "project_id", "target_date", "labels__id", "assignees__id", "created_by"]
)
def test_workspace_views_group_and_preserve_permissions(session_client, workspace, view_items, group_by):
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/issues/",
        {
            "group_by": group_by,
            "per_page": 1,
            "order_by": "-created_at",
            "filters": json.dumps({"priority__in": "high"}),
        },
    )
    assert response.status_code == 200, response.data
    assert response.data["grouped_by"] == group_by
    assert response.data["total_count"] == 2
    assert isinstance(response.data["results"], dict)
    for group in response.data["results"].values():
        assert len(group["results"]) <= 1
        assert all(item["id"] != str(view_items[3].id) for item in group["results"])
    assert str(view_items[3].project_id) not in response.data["results"]


def test_calendar_groups_work_items_by_date_within_the_visible_range(session_client, workspace, view_items):
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/issues/",
        {
            "group_by": "target_date",
            "target_date": "2026-10-01;after,2026-10-31;before",
            "per_page": 4,
        },
    )
    assert response.status_code == 200, response.data
    assert response.data["total_count"] == 2
    assert set(response.data["results"]) == {"2026-10-15", "2026-10-16"}
    assert all(len(group["results"]) == 1 for group in response.data["results"].values())


def test_workspace_views_subgroups_and_group_pagination(session_client, workspace, view_items):
    endpoint = f"/api/workspaces/{workspace.slug}/issues/"
    response = session_client.get(endpoint, {"group_by": "state__group", "sub_group_by": "priority", "per_page": 1})
    assert response.status_code == 200, response.data
    assert response.data["sub_grouped_by"] == "priority"
    group = response.data["results"]["unstarted"]["results"]["high"]
    assert group["total_results"] == 2
    assert len(group["results"]) == 1
    page = session_client.get(
        endpoint, {"state_group": "unstarted", "priority": "high", "per_page": 1, "cursor": "1:1:0"}
    )
    assert page.status_code == 200
    assert len(page.data["results"]) == 1
    assert page.data["results"][0]["id"] != group["results"][0]["id"]


@pytest.mark.parametrize(
    "params",
    [
        {"group_by": "workspace__owner__email"},
        {"group_by": "priority", "sub_group_by": "priority"},
        {"sub_group_by": "priority"},
    ],
)
def test_workspace_views_reject_invalid_grouping(session_client, workspace, view_items, params):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/issues/", params)
    assert response.status_code == 400


def test_view_export_excludes_children_archives_and_drafts(session_client, workspace, create_user, view_items):
    project, wanted, _, _ = view_items
    IssueAssignee.objects.create(issue=wanted, assignee=create_user, project=project, workspace=workspace)
    for extra in [{"parent": wanted}, {"is_draft": True}, {"archived_at": "2026-10-15"}]:
        issue = Issue.objects.create(project=project, name="Excluded", **extra)
        IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=workspace)
    filters = {
        "and": [
            {"assignee_id__in": str(create_user.id)},
            {"is_archived__exact": False, "is_draft__exact": False},
            {"parent_id__isnull": True},
        ]
    }
    with patch("plane.app.views.exporter.base.issue_export_task.delay"):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/export-issues/",
            {"provider": "json", "rich_filters": filters},
            format="json",
        )
    assert response.status_code == 200, response.data
    history = ExporterHistory.objects.get()
    captured = []
    with patch("plane.bgtasks.export_task.DataExporter") as exporter, patch("plane.bgtasks.export_task.upload_to_s3"):
        exporter.return_value.export.side_effect = lambda name, items: (
            captured.extend(items.values_list("id", flat=True)) or "view.json",
            "[]",
        )
        issue_export_task("json", workspace.id, [str(project.id)], history.token, False, workspace.slug)
    assert captured == [wanted.id]


def test_completed_export_download_uses_authenticated_api(session_client, workspace, create_user):
    export = ExporterHistory.objects.create(
        workspace=workspace,
        initiated_by=create_user,
        provider="json",
        type="issue_exports",
        status="completed",
        key=f"{workspace.id}/export.zip",
        url="http://internal-storage.invalid/export.zip",
    )
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/export-issues/", {"per_page": 5, "cursor": "5:0:0"}
    )
    url = response.data["results"][0]["url"]
    assert url.endswith(f"/api/workspaces/{workspace.slug}/export-issues/{export.id}/download/")
    assert "internal-storage" not in url
    assert session_client.post(url, {}, format="json").status_code == 405
    with patch("plane.app.views.exporter.base.S3Storage") as storage:
        storage.return_value.s3_client.get_object.return_value = {
            "Body": io.BytesIO(b"export-zip"),
            "ContentLength": 10,
        }
        response = session_client.get(url)
        assert response.status_code == 200
        assert b"".join(response.streaming_content) == b"export-zip"
        assert "attachment" in response["Content-Disposition"]
        assert response["Content-Length"] == "10"
        storage.return_value.s3_client.get_object.assert_called_once_with(
            Bucket=storage.return_value.aws_storage_bucket_name, Key=export.key
        )
    with patch("plane.app.views.exporter.base.S3Storage") as storage:
        assert session_client.get(f"/api/workspaces/not-a-member/export-issues/{export.id}/download/").status_code in {
            403,
            404,
        }
        storage.assert_not_called()


def test_unready_or_cross_workspace_file_is_not_downloaded(session_client, workspace, create_user):
    export = ExporterHistory.objects.create(
        workspace=workspace, initiated_by=create_user, provider="csv", type="issue_exports", status="processing"
    )
    url = f"/api/workspaces/{workspace.slug}/export-issues/{export.id}/download/"
    with patch("plane.app.views.exporter.base.S3Storage") as storage:
        assert session_client.get(url).status_code == 409
        export.status = "completed"
        export.key = "another-workspace/export.zip"
        export.save()
        assert session_client.get(url).status_code == 404
        storage.assert_not_called()


def test_export_download_requires_membership_and_existing_file(api_client, session_client, workspace, create_user):
    from botocore.exceptions import ClientError

    export = ExporterHistory.objects.create(
        workspace=workspace,
        initiated_by=create_user,
        provider="csv",
        type="issue_exports",
        status="completed",
        key=f"{workspace.id}/deleted.zip",
    )
    url = f"/api/workspaces/{workspace.slug}/export-issues/{export.id}/download/"
    from rest_framework.test import APIClient

    assert APIClient().get(url).status_code in {401, 403}
    with patch("plane.app.views.exporter.base.S3Storage") as storage:
        storage.return_value.s3_client.get_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey"}}, "GetObject"
        )
        assert session_client.get(url).status_code == 404
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
    with patch("plane.app.views.exporter.base.S3Storage") as storage:
        assert session_client.get(url).status_code == 403
        storage.assert_not_called()
