from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from django.utils import timezone

from plane.db.models import (
    Issue,
    IssueType,
    Label,
    Module,
    Page,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
    WorkspaceTemplate,
)
from plane.db.models.workflow import ProjectWorkflow

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def ctx(workspace, create_user, monkeypatch):
    from plane.app.views.issue import base as issue_views
    from plane.app.views.page import base as page_views

    for task in (issue_views.issue_activity, issue_views.model_activity, issue_views.recent_visited_task):
        monkeypatch.setattr(task, "delay", Mock())
    monkeypatch.setattr(page_views.page_transaction, "delay", Mock())
    monkeypatch.setattr(page_views.track_page_version, "delay", Mock())
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Templates", identifier="TPL")
    other = Project.objects.create(workspace=workspace, name="Other", identifier="OTH")
    membership = ProjectMember.objects.create(project=project, member=create_user, role=20)
    ProjectMember.objects.create(project=other, member=create_user, role=20)
    state = State.objects.create(project=project, name="Ready", group="unstarted", default=True)
    foreign_state = State.objects.create(project=other, name="Foreign", group="unstarted", default=True)
    label = Label.objects.create(project=project, name="Local")
    foreign_label = Label.objects.create(project=other, name="Foreign")
    module = Module.objects.create(project=project, name="Local")
    foreign_module = Module.objects.create(project=other, name="Foreign")
    issue_type = IssueType.objects.create(workspace=workspace, name="Task")
    foreign_type = IssueType.objects.create(workspace=workspace, name="Foreign type")
    ProjectIssueType.objects.create(project=project, issue_type=issue_type, is_default=True)
    ProjectIssueType.objects.create(project=other, issue_type=foreign_type)
    outsider = User.objects.create(email="template-outsider@example.com", username="template-outsider")
    WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15)
    ProjectMember.objects.create(project=other, member=outsider, role=15)
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
    return SimpleNamespace(
        workspace=workspace,
        project=project,
        other=other,
        user=create_user,
        membership=membership,
        state=state,
        foreign_state=foreign_state,
        label=label,
        foreign_label=foreign_label,
        module=module,
        foreign_module=foreign_module,
        issue_type=issue_type,
        foreign_type=foreign_type,
        outsider=outsider,
        base=base,
        url=base + "templates/",
    )


def test_state_template_preview_apply_retains_ids_and_rejects_stale(session_client, ctx):
    from plane.services.state_templates import initialize_project_states

    template = WorkspaceTemplate.objects.create(
        workspace=ctx.workspace,
        kind="project",
        name="Default states",
        is_default_state_template=True,
        configuration={
            "states": [
                {"name": "Ready", "group": "unstarted", "color": "#60646C", "default": True},
                {"name": "Done", "group": "completed", "color": "#46A758", "allow_new_work_items": False},
            ]
        },
    )
    unique = State.objects.create(project=ctx.project, name="Custom", group="started", color="#112233")
    issue = Issue.objects.create(project=ctx.project, name="Keep state", state=unique)
    endpoint = ctx.base + "state-template/"
    response = session_client.post(endpoint, {}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["matched"][0]["id"] == str(ctx.state.pk)
    assert response.data["retained"][0]["id"] == str(unique.pk)
    token = response.data["token"]
    unique.color = "#445566"
    unique.save()
    stale = session_client.post(endpoint, {"apply": True, "token": token}, format="json")
    assert stale.status_code == 409
    fresh = session_client.post(endpoint, {}, format="json")
    applied = session_client.post(endpoint, {"apply": True, "token": fresh.data["token"]}, format="json")
    assert applied.status_code == 200, applied.data
    issue.refresh_from_db()
    assert issue.state_id == unique.pk
    assert State.objects.filter(pk=ctx.state.pk).exists()
    assert State.objects.filter(pk=unique.pk).exists()
    assert not State.objects.get(project=ctx.project, name="Done").allow_new_work_items
    count = State.objects.filter(project=ctx.project).count()
    fresh = session_client.post(endpoint, {}, format="json")
    assert not fresh.data["added"]
    assert (
        session_client.post(endpoint, {"apply": True, "token": fresh.data["token"]}, format="json").status_code == 200
    )
    assert State.objects.filter(project=ctx.project).count() == count
    new_project = Project.objects.create(workspace=ctx.workspace, name="New", identifier="NEW")
    initialize_project_states(new_project, ctx.user)
    assert State.objects.filter(project=new_project, name="Ready", default=True).exists()
    assert State.triage_objects.filter(project=new_project, is_triage=True).exists()
    explicit = Project.objects.create(workspace=ctx.workspace, name="Explicit", identifier="EXP")
    initialize_project_states(
        explicit, ctx.user, {"states": [{"name": "Explicit", "color": "#123456", "group": "backlog"}]}
    )
    assert State.objects.get(project=explicit).name == "Explicit"
    template.delete(soft=False)
    fallback = Project.objects.create(workspace=ctx.workspace, name="Fallback", identifier="FAL")
    initialize_project_states(fallback, ctx.user)
    assert State.objects.filter(project=fallback, name="Backlog", default=True).exists()


def test_state_template_preview_expires_when_group_creation_settings_change(session_client, ctx):
    WorkspaceTemplate.objects.create(
        workspace=ctx.workspace,
        kind="project",
        name="States",
        is_default_state_template=True,
        configuration={"states": [{"name": "Ready", "group": "unstarted", "color": "#123456", "default": True}]},
    )
    endpoint = ctx.base + "state-template/"
    preview = session_client.post(endpoint, {}, format="json")
    assert preview.status_code == 200, preview.data
    Project.objects.filter(pk=ctx.project.pk).update(disabled_state_groups=["completed"])
    response = session_client.post(endpoint, {"apply": True, "token": preview.data["token"]}, format="json")
    assert response.status_code == 409, response.data
    ctx.state.refresh_from_db()
    assert ctx.state.color != "#123456"


def test_state_template_group_settings_round_trip_and_inheritance(session_client, ctx):
    from plane.services.state_templates import initialize_project_states

    url = f"/api/workspaces/{ctx.workspace.slug}/templates/"
    response = session_client.post(
        url,
        {
            "kind": "project",
            "name": "Group defaults",
            "is_default_state_template": True,
            "configuration": {
                "disabled_state_groups": ["completed"],
                "states": [
                    {"name": "Ready", "group": "unstarted", "color": "#123456", "default": True},
                    {"name": "Done", "group": "completed", "color": "#46A758"},
                ],
            },
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["configuration"]["disabled_state_groups"] == ["completed"]
    new_project = Project.objects.create(workspace=ctx.workspace, name="Inherited", identifier="INH")
    initialize_project_states(new_project, ctx.user)
    new_project.refresh_from_db()
    assert new_project.disabled_state_groups == ["completed"]
    endpoint = ctx.base + "state-template/"
    preview = session_client.post(endpoint, {}, format="json")
    assert preview.status_code == 200, preview.data
    assert preview.data["disabled_state_groups"] == {"before": [], "after": ["completed"]}
    applied = session_client.post(endpoint, {"apply": True, "token": preview.data["token"]}, format="json")
    assert applied.status_code == 200, applied.data
    ctx.project.refresh_from_db()
    assert ctx.project.disabled_state_groups == ["completed"]
    invalid = session_client.patch(
        url + str(response.data["id"]) + "/",
        {
            "configuration": {
                "states": [{"name": "Ready", "group": "unstarted", "default": True}],
                "disabled_state_groups": ["unstarted"],
            },
        },
        format="json",
    )
    assert invalid.status_code == 400, invalid.data


def test_state_template_same_group_mapping_and_permissions(session_client, ctx):
    WorkspaceTemplate.objects.create(
        workspace=ctx.workspace,
        kind="project",
        name="States",
        is_default_state_template=True,
        configuration={"states": [{"name": "Renamed", "group": "unstarted", "color": "#123456", "default": True}]},
    )
    previous_updated_at = ctx.state.updated_at
    endpoint = ctx.base + "state-template/"
    mapping = {"0": str(ctx.state.pk)}
    preview = session_client.post(endpoint, {"mapping": mapping}, format="json")
    assert preview.status_code == 200, preview.data
    assert preview.data["matched"][0]["changes"]["name"] == {"before": "Ready", "after": "Renamed"}
    assert (
        session_client.post(
            endpoint, {"mapping": mapping, "apply": True, "token": preview.data["token"]}, format="json"
        ).status_code
        == 200
    )
    ctx.state.refresh_from_db()
    assert ctx.state.name == "Renamed"
    assert ctx.state.slug == "renamed"
    assert ctx.state.updated_by_id == ctx.user.pk
    assert ctx.state.updated_at > previous_updated_at
    unchanged_updated_at = ctx.state.updated_at
    fresh = session_client.post(endpoint, {"mapping": mapping}, format="json")
    assert (
        session_client.post(
            endpoint, {"mapping": mapping, "apply": True, "token": fresh.data["token"]}, format="json"
        ).status_code
        == 200
    )
    ctx.state.refresh_from_db()
    assert ctx.state.updated_at == unchanged_updated_at
    wrong = State.objects.create(project=ctx.project, name="Wrong group", group="started")
    assert session_client.post(endpoint, {"mapping": {"0": str(wrong.pk)}}, format="json").status_code == 400
    ProjectMember.objects.filter(pk=ctx.membership.pk).update(role=15)
    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(role=15)
    assert session_client.post(endpoint, {}, format="json").status_code == 403


def create_template(client, ctx, **overrides):
    return client.post(ctx.url, {"kind": "work_item", "name": "Starter", **overrides}, format="json")


@pytest.mark.parametrize(
    "workspace_role,project_role,active,read,write",
    [
        (15, 20, True, 200, 201),
        (15, 15, True, 200, 403),
        (15, 5, True, 403, 403),
        (20, 5, True, 200, 201),
        (20, 20, False, 403, 403),
        (20, None, True, 403, 403),
    ],
)
def test_project_permissions(session_client, ctx, workspace_role, project_role, active, read, write):
    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(role=workspace_role)
    ProjectMember.objects.filter(pk=ctx.membership.pk).update(role=project_role or 20, is_active=active)
    if project_role is None:
        ProjectMember.objects.filter(pk=ctx.membership.pk).delete()
    template = WorkspaceTemplate.objects.create(workspace=ctx.workspace, project=ctx.project, kind="page", name="Page")
    detail = f"{ctx.url}{template.id}/"
    assert session_client.get(ctx.url).status_code == read
    assert session_client.get(detail).status_code == read
    assert session_client.get(ctx.base + "template-options/").status_code == read
    assert create_template(session_client, ctx).status_code == write
    update = session_client.patch(detail, {"title": "Updated"}, format="json")
    assert update.status_code == (200 if write == 201 else 403)
    assert session_client.delete(detail).status_code == (204 if write == 201 else 403)
    if workspace_role == 15:
        workspace_url = f"/api/workspaces/{ctx.workspace.slug}/"
        denied = session_client.post(workspace_url + "templates/", {"kind": "page", "name": "No"}, format="json")
        assert denied.status_code == 403
        assert session_client.get(workspace_url + "template-options/").status_code == 403


def test_crud_and_isolated_names(session_client, ctx):
    response = create_template(
        session_client,
        ctx,
        title="Parent title",
        priority="high",
        short_description="Description",
        description_html='<p>Safe</p><img src="private"><script>bad()</script>',
        configuration={
            "type_id": str(ctx.issue_type.id),
            "state_id": str(ctx.state.id),
            "label_ids": [str(ctx.label.id)],
            "module_ids": [str(ctx.module.id)],
            "assignee_ids": [str(ctx.user.id)],
            "children": [
                {
                    "name": "Child",
                    "description_html": '<p onclick="bad()">Text</p><script>bad()</script>',
                    "type_id": None,
                    "state_id": None,
                    "priority": "urgent",
                    "label_ids": [str(ctx.label.id)],
                    "assignee_ids": [str(ctx.user.id)],
                }
            ],
        },
    )
    assert response.status_code == 201, response.data
    body = response.json()
    assert body["project"] == str(ctx.project.id)
    assert body["description_html"] == "<p>Safe</p>"
    assert body["configuration"]["children"][0]["description_html"] == "<p>Text</p>"
    assert body["configuration"]["type_id"] == str(ctx.issue_type.id)
    assert body["configuration"]["children"][0]["type_id"] is None
    assert session_client.get(ctx.url).json() == [body]
    assert session_client.get(ctx.url, {"kind": "page"}).json() == []
    detail = f"{ctx.url}{body['id']}/"
    assert session_client.patch(detail, {"title": "Renamed"}, format="json").status_code == 200
    assert session_client.get(detail).json()["configuration"] == body["configuration"]
    assert create_template(session_client, ctx, name="STARTER").status_code == 400
    other_url = ctx.url.replace(str(ctx.project.id), str(ctx.other.id))
    response = session_client.post(other_url, {"kind": "work_item", "name": "Starter"}, format="json")
    assert response.status_code == 201, response.data
    workspace_url = f"/api/workspaces/{ctx.workspace.slug}/templates/"
    response = session_client.post(workspace_url, {"kind": "work_item", "name": "Starter"}, format="json")
    assert response.status_code == 201, response.data
    response = session_client.post(workspace_url, {"kind": "work_item", "name": "STARTER"}, format="json")
    assert response.status_code == 400
    assert session_client.delete(detail).status_code == 204
    assert session_client.get(detail).status_code == 404
    assert create_template(session_client, ctx, name="Starter").status_code == 201


def test_scope_and_kind_cannot_escape_project(session_client, ctx):
    other_workspace = Workspace.objects.create(name="Foreign", slug="foreign-templates", owner=ctx.user)
    foreign = Project.objects.create(workspace=other_workspace, name="Foreign", identifier="FOR")
    templates = [
        WorkspaceTemplate.objects.create(workspace=ctx.workspace, project=ctx.other, kind="page", name="Other"),
        WorkspaceTemplate.objects.create(workspace=ctx.workspace, kind="page", name="Global"),
        WorkspaceTemplate.objects.create(workspace=other_workspace, project=foreign, kind="page", name="Foreign"),
        WorkspaceTemplate.objects.create(
            workspace=ctx.workspace, project=ctx.project, kind="project", name="Blueprint"
        ),
    ]
    assert session_client.get(ctx.url).json() == []
    for template in templates:
        detail = f"{ctx.url}{template.id}/"
        assert session_client.get(detail).status_code == 404
        assert session_client.patch(detail, {"title": "Stolen"}, format="json").status_code == 404
        assert session_client.delete(detail).status_code == 404
    template = create_template(session_client, ctx).json()
    invalid_payloads = [
        {"project": str(ctx.other.id)},
        {"project": str(foreign.id)},
        {"project": None},
        {"kind": "project"},
    ]
    for payload in invalid_payloads:
        assert create_template(session_client, ctx, name="Invalid", **payload).status_code == 400
        assert session_client.patch(f"{ctx.url}{template['id']}/", payload, format="json").status_code == 400
    assert session_client.patch(f"{ctx.url}{template['id']}/", {"kind": "page"}, format="json").status_code == 400
    assert create_template(session_client, ctx, name="Valid", project=str(ctx.project.id)).status_code == 201


@pytest.mark.parametrize("child", [False, True])
@pytest.mark.parametrize("field", ["type_id", "state_id", "label_ids", "module_ids", "assignee_ids"])
def test_foreign_references_rejected(session_client, ctx, child, field):
    if child and field == "module_ids":
        return  # Modules are only supported on the parent configuration.
    invalid = {
        "type_id": str(ctx.foreign_type.id),
        "state_id": str(ctx.foreign_state.id),
        "label_ids": [str(ctx.foreign_label.id)],
        "module_ids": [str(ctx.foreign_module.id)],
        "assignee_ids": [str(ctx.outsider.id)],
    }
    entry = {field: invalid[field]}
    config = {"children": [{"name": "Invalid", **entry}]} if child else entry
    assert create_template(session_client, ctx, configuration=config).status_code == 400
    template = create_template(session_client, ctx, name="Valid").json()
    response = session_client.patch(f"{ctx.url}{template['id']}/", {"configuration": config}, format="json")
    assert response.status_code == 400
    if child:
        before = Issue.objects.count()
        response = session_client.post(
            ctx.base + "issues/", {"name": "Invalid", "template_children": config["children"]}, format="json"
        )
        assert response.status_code == 400, response.data
        assert Issue.objects.count() == before


@pytest.mark.parametrize(
    "invalid_kind",
    [
        "inactive_type",
        "deleted_type",
        "deleted_binding",
        "inactive_assignee",
        "guest_assignee",
        "deleted_state",
        "missing_label",
    ],
)
@pytest.mark.parametrize("child", [False, True])
def test_unavailable_references_rejected(session_client, ctx, invalid_kind, child):
    if invalid_kind.endswith("type") or invalid_kind == "deleted_binding":
        if invalid_kind == "inactive_type":
            IssueType.objects.filter(pk=ctx.issue_type.id).update(is_active=False)
        elif invalid_kind == "deleted_type":
            IssueType.objects.filter(pk=ctx.issue_type.id).update(deleted_at=timezone.now())
        else:
            ProjectIssueType.objects.filter(project=ctx.project).update(deleted_at=timezone.now())
        entry = {"type_id": str(ctx.issue_type.id)}
    elif invalid_kind.endswith("assignee"):
        values = {"is_active": False} if invalid_kind == "inactive_assignee" else {"role": 5}
        ProjectMember.objects.filter(pk=ctx.membership.pk).update(**values)
        admin = User.objects.create(email="template-admin@example.com", username="template-admin")
        WorkspaceMember.objects.create(workspace=ctx.workspace, member=admin, role=15)
        ProjectMember.objects.create(project=ctx.project, member=admin, role=20)
        session_client.force_authenticate(admin)
        entry = {"assignee_ids": [str(ctx.user.id)]}
    elif invalid_kind == "deleted_state":
        State.objects.filter(pk=ctx.state.id).update(deleted_at=timezone.now())
        entry = {"state_id": str(ctx.state.id)}
    else:
        entry = {"label_ids": [str(uuid4())]}
    config = {"children": [{"name": "Invalid", **entry}]} if child else entry
    assert create_template(session_client, ctx, configuration=config).status_code == 400


def test_options_only_contain_selected_project(session_client, ctx):
    inactive = IssueType.objects.create(workspace=ctx.workspace, name="Inactive", is_active=False)
    ProjectIssueType.objects.create(project=ctx.project, issue_type=inactive)
    response = session_client.get(ctx.base + "template-options/", {"project": str(ctx.other.id)})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"states", "labels", "modules", "assignees", "types"}
    for key, identifier in [
        ("states", ctx.state.id),
        ("labels", ctx.label.id),
        ("modules", ctx.module.id),
        ("types", ctx.issue_type.id),
    ]:
        assert [item["id"] for item in body[key]] == [str(identifier)]
    assert [item["member_id"] for item in body["assignees"]] == [str(ctx.user.id)]


def test_application_creates_children_with_fields_and_workflow_rules(session_client, ctx):
    typed_state = State.objects.create(project=ctx.project, name="Typed start", group="unstarted")
    ProjectWorkflow.objects.create(project=ctx.project, initial_state=ctx.state, enabled=True)
    typed_workflow = ProjectWorkflow.objects.create(
        project=ctx.project, name="Typed", initial_state=typed_state, is_default=False
    )
    typed_workflow.states.add(typed_state)
    ProjectIssueType.objects.filter(project=ctx.project).update(workflow=typed_workflow)
    response = create_template(
        session_client,
        ctx,
        configuration={
            "type_id": None,
            "children": [
                {
                    "name": "Explicit typed",
                    "type_id": str(ctx.issue_type.id),
                    "state_id": str(typed_state.id),
                    "priority": "high",
                    "assignee_ids": [str(ctx.user.id)],
                    "label_ids": [str(ctx.label.id)],
                },
                {"name": "Default typed"},
                {"name": "Explicit null", "type_id": None},
            ],
        },
    )
    assert response.status_code == 201, response.data
    config = response.json()["configuration"]
    result = session_client.post(
        ctx.base + "issues/",
        {"name": "Parent", "type_id": config["type_id"], "template_children": config["children"]},
        format="json",
    )
    assert result.status_code == 201, result.data
    parent = Issue.objects.get(pk=result.data["id"])
    assert parent.type_id is None
    assert parent.state_id == ctx.state.id
    explicit = parent.parent_issue.get(name="Explicit typed")
    assert explicit.type_id == ctx.issue_type.id
    assert explicit.state_id == typed_state.id
    assert explicit.priority == "high"
    assert list(explicit.assignees.values_list("id", flat=True)) == [ctx.user.id]
    assert list(explicit.labels.values_list("id", flat=True)) == [ctx.label.id]
    assert explicit.created_by_id == parent.created_by_id
    assert parent.parent_issue.get(name="Default typed").type_id == ctx.issue_type.id
    assert parent.parent_issue.get(name="Default typed").state_id == typed_state.id
    assert parent.parent_issue.get(name="Explicit null").type_id is None
    assert parent.parent_issue.get(name="Explicit null").state_id == ctx.state.id
    typed_workflow.restricted_creation_states.add(typed_state)
    count = Issue.objects.count()
    blocked = session_client.post(
        ctx.base + "issues/",
        {"name": "Blocked parent", "type_id": None, "template_children": config["children"]},
        format="json",
    )
    assert blocked.status_code == 400, blocked.data
    assert "WORKFLOW_CREATION_NOT_ALLOWED" in str(blocked.data)
    assert Issue.objects.count() == count


def test_page_logo_configuration_round_trip_and_application(session_client, ctx):
    response = create_template(
        session_client,
        ctx,
        kind="page",
        title="Page title",
        description_html="<p>Body</p>",
        configuration={
            "logo_props": {
                "in_use": "icon",
                "icon": {"name": "description", "color": "#123456", "private_asset": "secret"},
            },
            "private_project_id": str(ctx.other.id),
        },
    )
    assert response.status_code == 201, response.data
    body = response.json()
    logo = {"in_use": "icon", "icon": {"name": "description", "color": "#123456"}}
    assert body["configuration"] == {"logo_props": logo}
    detail = f"{ctx.url}{body['id']}/"
    updated = session_client.patch(detail, {"title": "Updated"}, format="json")
    assert updated.json()["configuration"] == {"logo_props": logo}
    for invalid_logo in [
        {"in_use": "image"},
        {"in_use": "icon", "icon": {"color": "javascript:bad"}},
        {"in_use": "icon", "icon": {"color": "#12345"}},
    ]:
        invalid = session_client.patch(detail, {"configuration": {"logo_props": invalid_logo}}, format="json")
        assert invalid.status_code == 400
    response = session_client.post(
        ctx.base + "pages/",
        {
            "name": body["title"],
            "description_html": body["description_html"],
            "logo_props": body["configuration"]["logo_props"],
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    assert Page.objects.get(pk=response.data["id"]).logo_props == logo
    cleared = session_client.patch(detail, {"configuration": {"legacy": "discard"}}, format="json")
    assert cleared.json()["configuration"] == {}


@pytest.mark.parametrize("payload", [[], "invalid", 1])
def test_non_object_payloads_return_validation_error(session_client, ctx, payload):
    assert session_client.post(ctx.url, payload, format="json").status_code == 400
    template = create_template(session_client, ctx).json()
    assert session_client.patch(f"{ctx.url}{template['id']}/", payload, format="json").status_code == 400
