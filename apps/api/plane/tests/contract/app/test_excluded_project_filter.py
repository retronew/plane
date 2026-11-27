import json

import pytest

from plane.db.models import Issue, IssueAssignee, Project, ProjectMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def project_items(workspace, create_user):
    items = []
    for identifier in ("ONE", "TWO", "THREE", "PRIVATE"):
        project = Project.objects.create(workspace=workspace, name=identifier, identifier=identifier, network=0)
        if identifier != "PRIVATE":
            ProjectMember.objects.create(project=project, member=create_user, role=20)
        issue = Issue.objects.create(project=project, name=identifier)
        IssueAssignee.objects.create(project=project, issue=issue, assignee=create_user)
        items.append(issue)
    return items[:3]


@pytest.mark.parametrize("scope", ["workspace", "profile"])
def test_excluded_projects_query(session_client, workspace, create_user, project_items, scope):
    base = f"/api/workspaces/{workspace.slug}/"
    url = base + ("issues/" if scope == "workspace" else f"user-issues/{create_user.id}/")
    first, second, third = project_items
    ids = [str(item.project_id) for item in project_items]
    for filters, expected in [
        ({}, project_items),
        ({"excluded_project_id__in": ""}, project_items),
        ({"excluded_project_id__in": ids[0]}, [second, third]),
        ({"excluded_project_id": ids[0]}, [second, third]),
        ({"excluded_project_id__exact": ids[1]}, [first, third]),
        ({"excluded_project_id__in": ids[:2]}, [third]),
        ({"and": [{"project_id__in": ",".join(ids[:2])}, {"excluded_project_id__in": ",".join(ids[1:])}]}, [first]),
    ]:
        response = session_client.get(url, {"filters": json.dumps(filters)})
        assert response.status_code == 200, (filters, response.data)
        assert response.data["total_count"] == len(expected), filters
        assert {str(item["id"]) for item in response.data["results"]} == {str(item.id) for item in expected}, filters


def test_saved_workspace_view_reloads_project_exclusions(session_client, workspace, project_items):
    base = f"/api/workspaces/{workspace.slug}/"
    first, second, third = project_items
    filters = {"and": [{"excluded_project_id__in": f"{first.project_id},{second.project_id}"}]}
    created = session_client.post(f"{base}views/", {"name": "Filtered", "rich_filters": filters}, format="json")
    assert created.status_code == 201, created.data
    saved = session_client.get(f"{base}views/{created.data['id']}/")
    assert saved.status_code == 200, saved.data
    assert saved.data["rich_filters"] == filters
    result = session_client.get(f"{base}issues/", {"filters": json.dumps(saved.data["rich_filters"])})
    assert result.status_code == 200, result.data
    assert [str(item["id"]) for item in result.data["results"]] == [str(third.id)]
