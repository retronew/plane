import pytest
from plane.db.models import ProjectCategory, WorkspaceTemplate, Workspace, WorkspaceMember, Project
from plane.app.serializers.project import ProjectSerializer

pytestmark = [pytest.mark.django_db, pytest.mark.contract]


@pytest.fixture
def project(workspace):
    return Project.objects.create(workspace=workspace, name="Config project", identifier="CFG")


def test_template_round_trip_and_sanitization(session_client, workspace):
    url = f"/api/workspaces/{workspace.slug}/templates/"
    response = session_client.post(
        url,
        {
            "kind": "work_item",
            "name": "Bug report",
            "title": "Bug",
            "description_html": '<p>Steps</p><img src="private-file"><script>bad()</script>',
        },
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["description_html"] == "<p>Steps</p>"
    assert session_client.get(url).json()[0]["id"] == body["id"]
    detail = f"{url}{body['id']}/"
    assert session_client.patch(detail, {"title": "Bug title"}, format="json").status_code == 200
    assert session_client.get(detail).json()["title"] == "Bug title"
    assert session_client.post(url, {"kind": "work_item", "name": "BUG REPORT"}, format="json").status_code == 400
    assert session_client.delete(detail).status_code == 204
    assert session_client.get(detail).status_code == 404


def test_member_can_read_but_not_manage(session_client, workspace, create_user):
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    for resource, payload in [
        ("templates", {"kind": "page", "name": "Plan"}),
        ("project-categories/status", {"name": "Active"}),
    ]:
        url = f"/api/workspaces/{workspace.slug}/{resource}/"
        assert session_client.get(url).status_code == 200
        assert session_client.post(url, payload, format="json").status_code == 403
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
    assert session_client.get(f"/api/workspaces/{workspace.slug}/templates/").status_code == 403


def test_cross_workspace_detail_and_references_are_rejected(session_client, workspace, project):
    other = Workspace.objects.create(name="Other", slug="other-configuration", owner=workspace.owner)
    template = WorkspaceTemplate.objects.create(workspace=other, kind="page", name="Private")
    assert session_client.get(f"/api/workspaces/{workspace.slug}/templates/{template.id}/").status_code == 404
    foreign_status = ProjectCategory.objects.create(workspace=other, kind="status", name="Active")
    local_label = ProjectCategory.objects.create(workspace=workspace, kind="label", name="Backend")
    for payload in [
        {"status": str(foreign_status.id)},
        {"status": str(local_label.id)},
        {"labels": [str(foreign_status.id)]},
    ]:
        serializer = ProjectSerializer(project, data=payload, partial=True, context={"workspace_id": workspace.id})
        assert not serializer.is_valid()


def test_categories_assignment_and_delete_protection(session_client, workspace, project):
    root = f"/api/workspaces/{workspace.slug}/project-categories/"
    status = session_client.post(f"{root}status/", {"name": "Active", "color": "#123456"}, format="json").json()
    label = session_client.post(f"{root}label/", {"name": "Backend"}, format="json").json()
    serializer = ProjectSerializer(
        project,
        data={"status": status["id"], "labels": [label["id"]]},
        partial=True,
        context={"workspace_id": workspace.id},
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    project.refresh_from_db()
    assert str(project.status_id) == status["id"]
    assert list(project.labels.values_list("name", flat=True)) == ["Backend"]
    assert session_client.delete(f"{root}status/{status['id']}/").status_code == 409
    assert session_client.delete(f"{root}label/{label['id']}/").status_code == 409
    project.status = None
    project.save()
    project.labels.clear()
    assert session_client.delete(f"{root}status/{status['id']}/").status_code == 204
    assert session_client.delete(f"{root}label/{label['id']}/").status_code == 204
    assert session_client.post(f"{root}status/", {"name": "Bad", "color": "invalid"}, format="json").status_code == 400
    assert session_client.post(f"{root}status/", {"name": "   "}, format="json").status_code == 400


def test_project_endpoint_persists_categories(session_client, workspace):
    status = ProjectCategory.objects.create(workspace=workspace, kind="status", name="Active")
    label = ProjectCategory.objects.create(workspace=workspace, kind="label", name="Platform")
    root = f"/api/workspaces/{workspace.slug}/projects/"
    response = session_client.post(
        root,
        {"name": "Categorized project", "identifier": "CAT", "status": str(status.id), "labels": [str(label.id)]},
        format="json",
    )
    assert response.status_code == 201, response.data
    detail = f"{root}{response.data['id']}/"
    response = session_client.get(detail)
    assert response.status_code == 200
    assert response.data["status"] == status.id or str(response.data["status"]) == str(status.id)
    assert [str(value) for value in response.data["labels"]] == [str(label.id)]
    response = session_client.patch(detail, {"status": None, "labels": []}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["status"] is None
    assert response.data["labels"] == []


def test_project_state_phases_defaults_and_disable(session_client, workspace, project):
    settings = f"/api/workspaces/{workspace.slug}/project-state-settings/"
    assert session_client.get(settings).json() == {"enabled": False}
    assert session_client.patch(settings, {"enabled": True}, format="json").status_code == 200
    states = ProjectCategory.objects.filter(workspace=workspace, kind="status")
    assert set(states.values_list("group", flat=True)) == {
        "draft",
        "planning",
        "execution",
        "monitoring",
        "completed",
        "cancelled",
    }
    draft = states.get(is_default=True)
    project.refresh_from_db()
    assert project.status_id == draft.id
    planning = states.get(group="planning")
    root = f"/api/workspaces/{workspace.slug}/project-categories/status/"
    assert session_client.patch(f"{root}{planning.id}/", {"is_default": True}, format="json").status_code == 200
    assert states.filter(is_default=True).count() == 1
    assert session_client.delete(f"{root}{planning.id}/").status_code == 409
    assert session_client.delete(f"{root}{draft.id}/").status_code == 409
    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/", {"name": "Default state", "identifier": "DFT"}, format="json"
    )
    assert response.status_code == 201, response.data
    assert Project.objects.get(id=response.data["id"]).status_id == planning.id
    assert session_client.patch(settings, {"enabled": False}, format="json").status_code == 200
    assert states.count() == 6
    project.refresh_from_db()
    assert project.status_id == draft.id
    assert session_client.patch(settings, {"enabled": True}, format="json").status_code == 200
    assert states.count() == 6


def test_category_order_requires_exact_workspace_list(session_client, workspace):
    a = ProjectCategory.objects.create(workspace=workspace, kind="label", name="A")
    b = ProjectCategory.objects.create(workspace=workspace, kind="label", name="B")
    url = f"/api/workspaces/{workspace.slug}/project-categories/label/order/"
    assert session_client.post(url, {"ids": [str(b.id), str(a.id)]}, format="json").status_code == 204
    assert list(ProjectCategory.objects.filter(workspace=workspace).values_list("id", flat=True)) == [b.id, a.id]
    assert session_client.post(url, {"ids": [str(a.id)]}, format="json").status_code == 409
    assert session_client.post(url, {"ids": [str(a.id), str(a.id)]}, format="json").status_code == 409


def test_template_configuration_validation_and_project_application(session_client, workspace):
    config = {
        "states": [{"name": "Ready", "group": "unstarted", "default": True}],
        "labels": [{"name": "Platform"}],
        "work_items": [{"name": "Setup", "description_html": "<script>bad()</script><p>Start</p>"}],
    }
    templates = f"/api/workspaces/{workspace.slug}/templates/"
    response = session_client.post(
        templates, {"kind": "project", "name": "Starter", "configuration": config}, format="json"
    )
    assert response.status_code == 201, response.data
    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/",
        {"name": "From template", "identifier": "TPL", "template_configuration": response.data["configuration"]},
        format="json",
    )
    assert response.status_code == 201, response.data
    from plane.db.models import State, Label, Issue

    project_id = response.data["id"]
    assert list(State.objects.filter(project_id=project_id).values_list("name", flat=True)) == ["Ready"]
    assert Label.objects.filter(project_id=project_id, name="Platform").exists()
    assert Issue.objects.filter(project_id=project_id, name="Setup").get().description_html == "<p>Start</p>"
    invalid = session_client.post(
        templates,
        {"kind": "project", "name": "Invalid", "configuration": {"states": [{"name": "Same"}, {"name": "same"}]}},
        format="json",
    )
    assert invalid.status_code == 400


def test_state_settings_admin_only(session_client, workspace, create_user):
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    url = f"/api/workspaces/{workspace.slug}/project-state-settings/"
    assert session_client.get(url).status_code == 200
    assert session_client.patch(url, {"enabled": True}, format="json").status_code == 403


def test_work_item_template_children_are_created_atomically(session_client, workspace):
    from plane.db.models import Issue

    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/",
        {"name": "Child template project", "identifier": "CHD"},
        format="json",
    )
    assert response.status_code == 201
    project_id = response.data["id"]
    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/{project_id}/issues/",
        {"name": "Parent", "template_children": [{"name": "Child", "description_html": "<p>Nested</p>"}]},
        format="json",
    )
    assert response.status_code == 201, response.data
    child = Issue.objects.get(parent_id=response.data["id"])
    assert child.name == "Child"
    assert str(child.project_id) == str(project_id)
    assert child.workspace_id == workspace.id
    count = Issue.objects.filter(project_id=project_id).count()
    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/{project_id}/issues/",
        {"name": "Invalid", "template_children": [{"name": ""}]},
        format="json",
    )
    assert response.status_code == 400
    assert Issue.objects.filter(project_id=project_id).count() == count
