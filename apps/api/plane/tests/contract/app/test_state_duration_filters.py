import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from plane.db.models import Issue, IssueView, Project, ProjectMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]
NOW = datetime(2026, 11, 11, 12, tzinfo=timezone.utc)


@pytest.fixture
def duration_data(workspace, create_user):
    project = Project.objects.create(name="Duration", identifier="DUR", workspace=workspace, issue_views_view=True)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    private = Project.objects.create(name="Private", identifier="PRV", workspace=workspace, network=0)
    items = {}
    for name, target, age, priority, legacy in [
        ("wanted", project, 2, "high", False),
        ("legacy", project, 2, "high", True),
        ("boundary", project, 1.5, "high", False),
        ("recent", project, 0, "high", False),
        ("low", project, 2, "low", False),
        ("hidden", private, 2, "high", False),
    ]:
        issue = Issue.objects.create(project=target, name=name, priority=priority)
        Issue.objects.filter(pk=issue.pk).update(
            state_changed_at=None if legacy else NOW - timedelta(days=age),
            created_at=NOW - timedelta(days=age if legacy else 30),
        )
        items[name] = issue
    return project, items


def endpoint(workspace, project, scope):
    base = f"/api/workspaces/{workspace.slug}/"
    return base + ("issues/" if scope == "workspace" else f"projects/{project.id}/issues/")


def tree():
    return {"and": [{"state_duration__gt": 1.5}, {"state_duration__lt": 2.5}, {"priority": "high"}]}


@pytest.mark.parametrize("scope", ["workspace", "project"])
def test_api_saved_view_executes_duration_filters(api_key_client, workspace, duration_data, scope):
    project, items = duration_data
    base = f"/api/v1/workspaces/{workspace.slug}/"
    views_url = base + ("views/" if scope == "workspace" else f"projects/{project.id}/views/")
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        created = api_key_client.post(views_url, {"name": "Duration", "rich_filters": tree()}, format="json")
        assert created.status_code == 201, created.data
        response = api_key_client.get(f"{views_url}{created.data['id']}/work-items/")
    assert response.status_code == 200, response.data
    assert {str(item["id"]) for item in response.data["results"]} == {str(items["wanted"].id), str(items["legacy"].id)}


@pytest.mark.parametrize("scope", ["workspace", "project"])
def test_get_json_filters_and_permission_scope(session_client, workspace, duration_data, scope):
    project, items = duration_data
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        response = session_client.get(endpoint(workspace, project, scope), {"filters": json.dumps(tree())})
    assert response.status_code == 200, response.data
    assert {str(item["id"]) for item in response.data["results"]} == {str(items["wanted"].id), str(items["legacy"].id)}
    assert response.data["total_count"] == 2


@pytest.mark.parametrize("scope", ["workspace", "project"])
@pytest.mark.parametrize("lookup,value,expected", [("gt", 0, 4), ("lt", 0, 0), ("lt", 365000, 5)])
def test_get_zero_and_maximum_days(session_client, workspace, duration_data, scope, lookup, value, expected):
    project, _ = duration_data
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        response = session_client.get(
            endpoint(workspace, project, scope), {"filters": json.dumps({f"state_duration__{lookup}": value})}
        )
    assert response.status_code == 200, response.data
    assert response.data["total_count"] == expected


@pytest.mark.parametrize("scope", ["workspace", "project"])
@pytest.mark.parametrize("lookup", ["gt", "lt"])
@pytest.mark.parametrize("value", [-0.1, "NaN", "Infinity", "-Infinity", "1e999", 365000.1, "garbage"])
def test_invalid_days_return_400(session_client, workspace, duration_data, scope, lookup, value):
    project, _ = duration_data
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        response = session_client.get(
            endpoint(workspace, project, scope), {"filters": json.dumps({f"state_duration__{lookup}": value})}
        )
    assert response.status_code == 400, response.data


@pytest.mark.parametrize("scope", ["workspace", "project"])
def test_saved_view_rich_filters_round_trip_then_actual_get(session_client, workspace, duration_data, scope):
    project, items = duration_data
    base = f"/api/workspaces/{workspace.slug}/"
    views_url = base + ("views/" if scope == "workspace" else f"projects/{project.id}/views/")
    created = session_client.post(views_url, {"name": "Duration", "rich_filters": tree()}, format="json")
    assert created.status_code == 201, created.data
    detail = f"{views_url}{created.data['id']}/"
    saved = session_client.get(detail)
    assert saved.status_code == 200, saved.data
    assert saved.data["rich_filters"] == tree()
    assert IssueView.objects.get(pk=created.data["id"]).rich_filters == tree()
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        response = session_client.get(
            endpoint(workspace, project, scope), {"filters": json.dumps(saved.data["rich_filters"])}
        )
    assert response.status_code == 200, response.data
    assert {str(item["id"]) for item in response.data["results"]} == {str(items["wanted"].id), str(items["legacy"].id)}
    updated_tree = {"state_duration__lt": 0.5}
    updated = session_client.patch(detail, {"rich_filters": updated_tree}, format="json")
    assert updated.status_code == 200, updated.data
    assert session_client.get(detail).data["rich_filters"] == updated_tree
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        response = session_client.get(
            endpoint(workspace, project, scope), {"filters": json.dumps(updated.data["rich_filters"])}
        )
    assert response.status_code == 200, response.data
    assert [str(item["id"]) for item in response.data["results"]] == [str(items["recent"].id)]
