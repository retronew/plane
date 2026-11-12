from unittest.mock import patch

import pytest

from plane.db.models import Project, ProjectActivity, ProjectMember, Workspace, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def reminder_project(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Reminder audit", identifier="RMA", timezone="UTC")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


def detail(project):
    return f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/"


@pytest.mark.parametrize(
    "field,new_value",
    [
        ("remind_in", 3),
        ("remind_email_enabled", False),
        ("remind_feishu_enabled", False),
        ("timezone", "Asia/Shanghai"),
    ],
)
def test_reminder_changes_are_audited_once(session_client, reminder_project, create_user, field, new_value):
    project = reminder_project
    old_value = getattr(project, field)
    response = session_client.patch(detail(project), {field: new_value}, format="json")
    assert response.status_code == 200, response.data
    event = ProjectActivity.objects.get(project=project, field=field)
    assert event.actor_id == create_user.id and event.verb == "updated"
    assert event.old_value == old_value and event.new_value == new_value
    assert event.created_at is not None
    assert session_client.patch(detail(project), {field: new_value}, format="json").status_code == 200
    assert ProjectActivity.objects.filter(project=project, field=field).count() == 1
    activities = session_client.get(detail(project) + "activities/")
    assert activities.status_code == 200
    assert activities.data["results"][0]["field"] == field


def test_configuration_rolls_back_when_audit_write_fails(session_client, reminder_project):
    with patch(
        "plane.app.views.project.overview.record_project_activity", side_effect=RuntimeError("audit unavailable")
    ):
        response = session_client.patch(detail(reminder_project), {"remind_in": 2}, format="json")
        assert response.status_code == 500
    reminder_project.refresh_from_db()
    assert reminder_project.remind_in == 0
    assert not ProjectActivity.objects.filter(project=reminder_project).exists()


@pytest.mark.parametrize("role", [5, 15])
def test_member_cannot_change_or_forge_reminder_audit(session_client, reminder_project, create_user, role):
    project = reminder_project
    ProjectMember.objects.filter(project=project, member=create_user).update(role=role)
    WorkspaceMember.objects.filter(workspace=project.workspace, member=create_user).update(role=role)
    assert session_client.patch(detail(project), {"remind_in": 1}, format="json").status_code == 403
    assert not ProjectActivity.objects.filter(project=project).exists()


def test_invalid_config_and_foreign_workspace_leave_no_activity(session_client, reminder_project, create_user):
    project = reminder_project
    assert session_client.patch(detail(project), {"remind_in": 9}, format="json").status_code == 400
    other = Workspace.objects.create(name="Other", slug="reminder-other", owner=create_user)
    response = session_client.patch(
        f"/api/workspaces/{other.slug}/projects/{project.id}/", {"remind_in": 1}, format="json"
    )
    assert response.status_code in (403, 404)
    assert not ProjectActivity.objects.filter(project=project).exists()
