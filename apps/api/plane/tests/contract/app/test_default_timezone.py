import pytest
from django.test import override_settings

from plane.db.models import Project, Workspace

pytestmark = [pytest.mark.django_db, pytest.mark.contract]


@override_settings(DEFAULT_TIMEZONE="Asia/Shanghai")
@pytest.mark.parametrize("explicit_timezone", [None, "UTC", "Europe/Paris"])
def test_workspace_creation_timezone(session_client, explicit_timezone):
    payload = {"name": "Timezone workspace", "slug": "timezone-workspace"}
    if explicit_timezone is not None:
        payload["timezone"] = explicit_timezone
    response = session_client.post("/api/workspaces/", payload, format="json")
    assert response.status_code == 201, response.data
    expected = explicit_timezone or "Asia/Shanghai"
    assert response.data["timezone"] == expected
    assert Workspace.objects.get(id=response.data["id"]).timezone == expected


@pytest.mark.parametrize("explicit_timezone", [None, "UTC", "Europe/Paris"])
def test_project_inherits_workspace_timezone_and_keeps_it_on_edit(session_client, workspace, explicit_timezone):
    workspace.timezone = "Asia/Shanghai"
    workspace.save()
    payload = {"name": "Timezone project", "identifier": "TZ"}
    if explicit_timezone is not None:
        payload["timezone"] = explicit_timezone
    url = f"/api/workspaces/{workspace.slug}/projects/"
    response = session_client.post(url, payload, format="json")
    assert response.status_code == 201, response.data
    expected = explicit_timezone or "Asia/Shanghai"
    assert response.data["timezone"] == expected
    project = Project.objects.get(id=response.data["id"])
    assert project.timezone == expected
    workspace.timezone = "Asia/Tokyo"
    workspace.save()
    edited = session_client.patch(f"{url}{project.id}/", {"description": "Updated"}, format="json")
    assert edited.status_code == 200, edited.data
    project.refresh_from_db()
    assert project.timezone == expected
