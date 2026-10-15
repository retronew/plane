import pytest
from plane.db.models import Project, ProjectMember, User, Workspace, WorkspaceMember

pytestmark = [pytest.mark.django_db, pytest.mark.contract]


def test_create_and_edit_project_planning_fields(session_client, workspace):
    url = f"/api/workspaces/{workspace.slug}/projects/"
    response = session_client.post(
        url,
        {
            "name": "Planning",
            "identifier": "PLAN",
            "priority": "high",
            "start_date": "2026-10-15",
            "target_date": "2026-10-20",
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["priority"] == "high"
    assert response.data["start_date"] == "2026-10-15"
    detail = f"{url}{response.data['id']}/"
    assert session_client.get(detail).data["target_date"] == "2026-10-20"
    invalid = session_client.patch(detail, {"target_date": "2026-10-14"}, format="json")
    assert invalid.status_code == 400
    cleared = session_client.patch(detail, {"start_date": None, "target_date": None}, format="json")
    assert cleared.status_code == 200, cleared.data
    assert cleared.data["start_date"] is None and cleared.data["target_date"] is None


def test_invalid_planning_values_do_not_create_project(session_client, workspace):
    url = f"/api/workspaces/{workspace.slug}/projects/"
    for values in [{"priority": "critical"}, {"start_date": "2026-10-20", "target_date": "2026-10-15"}]:
        response = session_client.post(url, {"name": "Invalid", "identifier": "BAD", **values}, format="json")
        assert response.status_code == 400
    assert not Project.objects.filter(workspace=workspace, identifier="BAD").exists()


def test_initial_members_are_deduplicated_and_guests_are_not_promoted(session_client, workspace, create_user):
    member = User.objects.create(email="project-member@example.test", username="project-member")
    guest = User.objects.create(email="project-guest@example.test", username="project-guest")
    WorkspaceMember.objects.create(workspace=workspace, member=member, role=15)
    WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/",
        {
            "name": "Members",
            "identifier": "MEM",
            "project_lead": str(member.id),
            "member_ids": [str(create_user.id), str(member.id), str(member.id), str(guest.id)],
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    roster = dict(ProjectMember.objects.filter(project_id=response.data["id"]).values_list("member_id", "role"))
    assert roster == {create_user.id: 20, member.id: 20, guest.id: 5}
    assert set(map(str, response.data["members"])) == {str(create_user.id), str(member.id), str(guest.id)}


@pytest.mark.parametrize("scope", ["foreign", "inactive", "bot"])
def test_initial_members_require_active_workspace_membership(session_client, workspace, create_user, scope):
    member = User.objects.create(email=f"{scope}@example.test", username=scope, is_bot=scope == "bot")
    other = (
        Workspace.objects.create(name="Other", slug="other-members", owner=create_user)
        if scope == "foreign"
        else workspace
    )
    WorkspaceMember.objects.create(workspace=other, member=member, role=15, is_active=scope != "inactive")
    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/",
        {
            "name": "Invalid members",
            "identifier": "BADMEM",
            "member_ids": [str(member.id)],
        },
        format="json",
    )
    assert response.status_code == 400, response.data
    assert not Project.objects.filter(workspace=workspace, identifier="BADMEM").exists()
