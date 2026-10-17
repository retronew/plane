from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from rest_framework.exceptions import ValidationError

from plane.app.serializers.issue import IssueCreateSerializer
from plane.app.serializers.draft import DraftIssueCreateSerializer
from plane.db.models import (
    CustomPropertyOption,
    DraftIssue,
    Issue,
    IssueType,
    IssueTypeCustomProperty,
    Project,
    ProjectCustomProperty,
    ProjectIssueType,
    ProjectMember,
    State,
    WorkspaceMember,
)
from plane.services.custom_properties import issue_property_values, validate_config, validate_value

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def property_ctx(workspace, create_user, monkeypatch):
    from plane.app.views.issue import base

    for task in (
        base.issue_activity,
        base.model_activity,
        base.recent_visited_task,
        base.issue_description_version_task,
    ):
        monkeypatch.setattr(task, "delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Custom properties", identifier="PROP")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    issue_type = IssueType.objects.create(workspace=workspace, name="Task")
    binding = ProjectIssueType.objects.create(project=project, issue_type=issue_type, is_default=True)
    issue = Issue.objects.create(project=project, state=state, type=issue_type, name="Existing")
    return SimpleNamespace(
        project=project,
        state=state,
        issue_type=issue_type,
        binding=binding,
        issue=issue,
        user=create_user,
        workspace=workspace,
        base=f"/api/workspaces/{workspace.slug}/projects/{project.id}/",
        context={
            "project_id": project.pk,
            "workspace_id": workspace.pk,
            "default_assignee_id": None,
            "request": SimpleNamespace(user=create_user),
        },
    )


def make_property(ctx, kind="text", **kwargs):
    prop = ProjectCustomProperty.objects.create(
        project=ctx.project,
        name=str(uuid4()),
        property_type=kind,
        config=validate_config(kind, kwargs.pop("config", {})),
        **kwargs,
    )
    IssueTypeCustomProperty.objects.create(
        project=ctx.project,
        property=prop,
        project_issue_type=ctx.binding,
        is_active=True,
        is_required=prop.is_required,
    )
    return prop


def test_settings_crud_and_lossless_delete(session_client, property_ctx):
    ctx = property_ctx
    response = session_client.post(
        ctx.base + "custom-properties/",
        {
            "name": "Impact",
            "type_id": str(ctx.issue_type.pk),
            "property_type": "dropdown",
            "config": {"multiple": False},
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    prop_id = str(response.data["id"])
    url = ctx.base + f"custom-properties/{prop_id}/"
    option = session_client.post(url + "options/", {"name": "High"}, format="json")
    assert option.status_code == 201, option.data
    values_url = ctx.base + f"issues/{ctx.issue.id}/custom-properties/"
    assert (
        session_client.put(values_url, {"values": {prop_id: str(option.data["id"])}}, format="json").status_code == 200
    )
    assert session_client.delete(url).status_code == 400
    assert session_client.patch(url, {"is_active": False}, format="json").status_code == 200
    assert session_client.delete(url).status_code == 204
    assert ProjectCustomProperty.objects.get(pk=prop_id).is_archived
    assert CustomPropertyOption.objects.filter(pk=option.data["id"]).exists()
    assert session_client.get(values_url).data["values"][prop_id] == str(option.data["id"])
    assert session_client.get(ctx.base + "custom-properties/").data["count"] == 0


def test_real_issue_create_patch_detail_and_value_put(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, is_required=True)
    key = str(prop.pk)
    response = session_client.post(ctx.base + "issues/", {"name": "Missing"}, format="json")
    assert response.status_code == 400, response.data
    response = session_client.post(
        ctx.base + "issues/",
        {
            "name": "Custom",
            "custom_properties": {key: "First"},
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["custom_properties"][key] == "First"
    url = ctx.base + f"issues/{response.data['id']}/"
    assert session_client.get(url).data["custom_properties"][key] == "First"
    assert session_client.patch(url, {"custom_properties": {key: "Second"}}, format="json").status_code == 204
    assert session_client.get(url + "custom-properties/").data["values"][key] == "Second"
    assert session_client.put(url + "custom-properties/", {"values": {key: None}}, format="json").status_code == 400
    # Introducing required fields does not block unrelated edits of legacy items.
    assert (
        session_client.patch(ctx.base + f"issues/{ctx.issue.id}/", {"name": "Rename"}, format="json").status_code == 204
    )


@pytest.mark.parametrize(
    "kind,value",
    [
        ("text", "Notes"),
        ("number", 0),
        ("number", 1.25),
        ("boolean", False),
        ("date", "2026-10-18"),
        ("url", "https://example.com/path"),
    ],
)
def test_supported_scalar_values(property_ctx, kind, value):
    ctx = property_ctx
    prop = make_property(ctx, kind)
    assert validate_value(prop, value, ctx.project.pk) == value


@pytest.mark.parametrize(
    "kind,value",
    [
        ("text", 12),
        ("number", True),
        ("number", "1"),
        ("number", float("inf")),
        ("boolean", "false"),
        ("date", "2026-02-30"),
        ("date", "20261018"),
        ("url", "javascript:alert(1)"),
        ("url", "file:///etc/passwd"),
    ],
)
def test_invalid_scalar_values(property_ctx, kind, value):
    ctx = property_ctx
    with pytest.raises(ValidationError):
        validate_value(make_property(ctx, kind), value, ctx.project.pk)


@pytest.mark.parametrize("multiple", [False, True])
def test_options_members_are_project_scoped(property_ctx, multiple):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown", config={"multiple": multiple})
    option = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Valid")
    other = make_property(ctx, "dropdown")
    foreign_option = CustomPropertyOption.objects.create(project=ctx.project, property=other, name="Wrong field")

    def wrap(value):
        return [str(value)] if multiple else str(value)

    assert validate_value(prop, wrap(option.pk), ctx.project.pk) == wrap(option.pk)
    for value in (foreign_option.pk, uuid4()):
        with pytest.raises(ValidationError):
            validate_value(prop, wrap(value), ctx.project.pk)
    prop = make_property(ctx, "member", config={"multiple": multiple})
    assert validate_value(prop, wrap(ctx.user.pk), ctx.project.pk) == wrap(ctx.user.pk)
    ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(is_active=False)
    with pytest.raises(ValidationError):
        validate_value(prop, wrap(ctx.user.pk), ctx.project.pk)


def test_type_bindings_and_type_change_preserve_values(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx)
    url = ctx.base + f"issue-types/{ctx.issue_type.id}/custom-properties/"
    response = session_client.put(url + f"{prop.id}/", {"is_active": True, "is_required": True}, format="json")
    assert response.status_code == 200, response.data
    assert session_client.get(url).data["results"][0]["effective_is_required"] is True
    assert response.data["type_settings"][0]["type_id"] == ctx.issue_type.pk
    other_type = IssueType.objects.create(workspace=ctx.workspace, name="Other")
    other_binding = ProjectIssueType.objects.create(project=ctx.project, issue_type=other_type)
    other_prop = make_property(ctx, is_required=True)
    IssueTypeCustomProperty.objects.filter(property=other_prop, project_issue_type=ctx.binding).update(is_active=False)
    IssueTypeCustomProperty.objects.create(
        project=ctx.project, property=other_prop, project_issue_type=other_binding, is_required=True
    )
    ctx.issue.custom_properties = {str(prop.pk): "History"}
    ctx.issue.save()
    with pytest.raises(ValidationError):
        issue_property_values(ctx.project.pk, {"type": other_type}, ctx.issue)
    result = issue_property_values(
        ctx.project.pk,
        {
            "type": other_type,
            "custom_properties": {str(other_prop.pk): "New"},
        },
        ctx.issue,
    )
    assert result[str(prop.pk)] == "History"


def test_cross_project_and_inactive_property_rejected(session_client, property_ctx):
    ctx = property_ctx
    foreign = Project.objects.create(workspace=ctx.workspace, name="Foreign", identifier="FOR")
    prop = ProjectCustomProperty.objects.create(project=foreign, name="Foreign", property_type="text")
    url = ctx.base + f"issues/{ctx.issue.id}/custom-properties/"
    response = session_client.put(url, {"values": {str(prop.pk): "No"}}, format="json")
    assert response.status_code == 400
    assert (
        session_client.patch(ctx.base + f"custom-properties/{prop.id}/", {"name": "No"}, format="json").status_code
        == 404
    )
    foreign_type = IssueType.objects.create(workspace=ctx.workspace, name="Foreign type")
    ProjectIssueType.objects.create(project=foreign, issue_type=foreign_type)
    local = make_property(ctx, is_active=False)
    assert session_client.put(url, {"values": {str(local.pk): "No"}}, format="json").status_code == 400
    assert (
        session_client.put(
            ctx.base + f"issue-types/{foreign_type.id}/custom-properties/{local.id}/",
            {
                "is_active": True,
                "is_required": False,
            },
            format="json",
        ).status_code
        == 404
    )


def test_archived_option_remains_readable_and_unrelated_patch_preserves_it(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    option = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Old")
    ctx.issue.custom_properties = {str(prop.pk): str(option.pk)}
    ctx.issue.save()
    url = ctx.base + f"custom-properties/{prop.id}/options/{option.id}/"
    assert session_client.delete(url).status_code == 204
    assert (
        session_client.patch(
            ctx.base + f"issues/{ctx.issue.id}/", {"name": "Still readable"}, format="json"
        ).status_code
        == 204
    )
    ctx.issue.refresh_from_db()
    assert ctx.issue.custom_properties[str(prop.pk)] == str(option.pk)
    assert session_client.get(ctx.base + "custom-properties/").data["results"][0]["options"][0]["is_archived"]


def test_schema_permissions_and_shape_changes(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    url = ctx.base + f"custom-properties/{prop.id}/"
    for data in ({"property_type": "number"}, {"config": {"multiple": True}}, {"config": {"unknown": True}}):
        assert session_client.patch(url, data, format="json").status_code == 400
    for kind, config in (("boolean", {}), ("text", {"read_only": True, "default_value": "Fixed"})):
        with pytest.raises(ValidationError):
            validate_config(kind, config, required=True)
    with pytest.raises(ValidationError):
        validate_config("date", {"format": "arbitrary"})
    ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(role=15)
    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(role=15)
    assert session_client.get(ctx.base + "custom-properties/").status_code == 200
    assert session_client.patch(url, {"name": "Denied"}, format="json").status_code == 403
    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(is_active=False)
    assert session_client.get(ctx.base + f"issues/{ctx.issue.id}/custom-properties/").status_code == 403


def test_default_values_and_serializer_atomic_validation(property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "number", config={"default_value": 0}, is_required=True)
    boolean = make_property(ctx, "boolean")
    serializer = IssueCreateSerializer(data={"name": "Default values"}, context=ctx.context)
    assert serializer.is_valid(), serializer.errors
    issue = serializer.save()
    assert issue.custom_properties[str(prop.pk)] == 0
    assert issue.custom_properties[str(boolean.pk)] is False
    serializer = IssueCreateSerializer(
        issue,
        data={"name": "Must roll back", "custom_properties": {str(prop.pk): True}},
        partial=True,
        context=ctx.context,
    )
    assert serializer.is_valid(), serializer.errors
    with pytest.raises(ValidationError):
        serializer.save()
    issue.refresh_from_db()
    assert issue.name == "Default values"


def test_atomic_inline_options_and_explicit_type_binding(session_client, property_ctx):
    ctx = property_ctx
    response = session_client.post(
        ctx.base + "custom-properties/",
        {
            "name": "Atomic",
            "property_type": "dropdown",
            "type_id": str(ctx.issue_type.pk),
            "options": [{"name": "A"}, {"name": "B", "color": "#ff0000"}],
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    assert len(response.data["options"]) == 2
    key = str(response.data["id"])
    option = str(response.data["options"][0]["id"])
    url = ctx.base + f"custom-properties/{key}/"
    assert session_client.patch(url, {"config": {"default_value": option}}, format="json").status_code == 200
    response = session_client.post(ctx.base + "issues/", {"name": "Default option"}, format="json")
    assert response.status_code == 201, response.data
    assert response.data["custom_properties"][key] == option
    response = session_client.post(
        ctx.base + "custom-properties/",
        {
            "name": "Rolled back",
            "property_type": "dropdown",
            "options": [{"name": "Duplicate"}, {"name": "Duplicate"}],
        },
        format="json",
    )
    assert response.status_code == 400
    assert not ProjectCustomProperty.objects.filter(project=ctx.project, name="Rolled back").exists()
    unbound = session_client.post(
        ctx.base + "custom-properties/", {"name": "Unbound", "property_type": "text"}, format="json"
    )
    assert unbound.status_code == 201
    rows = session_client.get(ctx.base + f"issue-types/{ctx.issue_type.id}/custom-properties/").data["results"]
    assert next(row for row in rows if str(row["id"]) == str(unbound.data["id"]))["effective_is_active"] is False
    assert session_client.get(ctx.base + "issue-types/").data["results"][0]["properties_count"] == 1


def test_default_type_protection(session_client, property_ctx):
    ctx = property_ctx
    url = ctx.base + f"issue-types/{ctx.issue_type.pk}/"
    for payload in ({"is_active": False}, {"is_default": False}):
        assert (
            session_client.patch(url, {"version": ctx.project.workflow_version, **payload}, format="json").status_code
            == 400
        )
    assert session_client.delete(url, {"version": ctx.project.workflow_version}, format="json").status_code == 400


def test_draft_properties_round_trip_and_publish_required(session_client, property_ctx, monkeypatch):
    ctx = property_ctx
    from plane.app.views.workspace import draft as views

    monkeypatch.setattr(views.issue_activity, "delay", Mock())
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    required = make_property(ctx, is_required=True)
    number = make_property(ctx, "number")
    key = str(required.pk)
    draft_base = f"/api/workspaces/{ctx.workspace.slug}/draft-issues/"
    response = session_client.post(
        draft_base,
        {
            "project_id": str(ctx.project.pk),
            "name": "Draft",
            "custom_properties": {key: None, str(number.pk): 0},
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    draft_id = response.data["id"]
    assert response.data["custom_properties"][str(number.pk)] == 0
    url = draft_base + f"{draft_id}/"
    assert session_client.get(url).data["custom_properties"][key] is None
    publish = f"/api/workspaces/{ctx.workspace.slug}/draft-to-issue/{draft_id}/"
    response = session_client.post(publish, {"name": "Published"}, format="json")
    assert response.status_code == 400, response.data
    assert DraftIssue.objects.filter(pk=draft_id).exists()
    assert not Issue.objects.filter(project=ctx.project, name="Published").exists()
    assert session_client.patch(url, {"custom_properties": {key: "Ready"}}, format="json").status_code == 204
    response = session_client.post(publish, {"name": "Published"}, format="json")
    assert response.status_code == 201, response.data
    issue = Issue.objects.get(pk=response.data["id"])
    assert issue.custom_properties == {key: "Ready", str(number.pk): 0}
    assert not issue.is_draft
    assert not DraftIssue.objects.filter(pk=draft_id).exists()


def test_draft_value_validation_and_project_move(property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "number", is_required=True)
    serializer = DraftIssueCreateSerializer(data={"name": "Incomplete"}, context=ctx.context)
    assert serializer.is_valid(), serializer.errors
    draft = serializer.save()
    invalid = DraftIssueCreateSerializer(
        draft, data={"custom_properties": {str(prop.pk): "not numeric"}}, partial=True, context=ctx.context
    )
    assert invalid.is_valid(), invalid.errors
    with pytest.raises(ValidationError):
        invalid.save()
    draft.custom_properties = {str(prop.pk): 2}
    draft.save()
    other = Project.objects.create(workspace=ctx.workspace, name="Other draft project", identifier="ODP")
    with pytest.raises(ValidationError):
        issue_property_values(other.pk, {}, draft, draft=True)
    with pytest.raises(ValidationError):
        issue_property_values(ctx.project.pk, {"custom_properties": {str(uuid4()): "foreign"}}, draft, draft=True)


def test_null_clear_and_progressive_required_updates(session_client, property_ctx):
    ctx = property_ctx
    first = make_property(ctx, is_required=True)
    second = make_property(ctx, is_required=True)
    optional = make_property(ctx)
    values_url = ctx.base + f"issues/{ctx.issue.pk}/custom-properties/"
    assert session_client.put(values_url, {"values": {str(first.pk): "Filled A"}}, format="json").status_code == 200
    assert session_client.put(values_url, {"values": {str(second.pk): "Filled B"}}, format="json").status_code == 200
    assert session_client.put(values_url, {"values": {str(optional.pk): "Optional"}}, format="json").status_code == 200
    assert session_client.put(values_url, {"values": {str(optional.pk): None}}, format="json").status_code == 200
    assert session_client.get(values_url).data["values"][str(optional.pk)] is None
    assert (
        session_client.patch(
            ctx.base + f"issues/{ctx.issue.pk}/", {"custom_properties": {str(optional.pk): None}}, format="json"
        ).status_code
        == 204
    )
    assert session_client.put(values_url, {"values": {str(first.pk): None}}, format="json").status_code == 400


@pytest.mark.parametrize("kind", ["dropdown", "member"])
def test_multiselect_retains_invalid_existing_references(property_ctx, create_bot_user, kind):
    ctx = property_ctx
    prop = make_property(ctx, kind, config={"multiple": True})
    if kind == "dropdown":
        old = CustomPropertyOption.objects.create(
            project=ctx.project, property=prop, name="Old", is_active=False, is_archived=True
        ).pk
        new = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="New").pk
    else:
        old = create_bot_user.pk
        new = ctx.user.pk
    ctx.issue.custom_properties = {str(prop.pk): [str(old)]}
    result = issue_property_values(
        ctx.project.pk, {"custom_properties": {str(prop.pk): [str(old), str(new)]}}, ctx.issue
    )
    assert result[str(prop.pk)] == [str(old), str(new)]
    with pytest.raises(ValidationError):
        issue_property_values(
            ctx.project.pk, {"custom_properties": {str(prop.pk): [str(old), str(uuid4())]}}, ctx.issue
        )


def test_dropdown_defaults_are_canonical_and_removed_on_archive(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    option = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Default")
    url = ctx.base + f"custom-properties/{prop.pk}/"
    response = session_client.patch(url, {"config": {"default_value": option.pk.hex.upper()}}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["config"]["default_value"] == str(option.pk)
    assert session_client.delete(url + f"options/{option.pk}/").status_code == 204
    prop.refresh_from_db()
    assert prop.config["default_value"] is None


def test_draft_readonly_defaults_publish_but_explicit_writes_are_rejected(session_client, property_ctx, monkeypatch):
    ctx = property_ctx
    from plane.app.views.workspace import draft as views

    monkeypatch.setattr(views.issue_activity, "delay", Mock())
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    prop = make_property(ctx, config={"read_only": True, "default_value": "Original default"})
    key = str(prop.pk)
    serializer = DraftIssueCreateSerializer(data={"name": "Readonly draft"}, context=ctx.context)
    assert serializer.is_valid(), serializer.errors
    draft = serializer.save()
    DraftIssue.objects.filter(pk=draft.pk).update(created_by=ctx.user)
    assert draft.custom_properties[key] == "Original default"
    prop.config["default_value"] = "Current default"
    prop.save()
    url = f"/api/workspaces/{ctx.workspace.slug}/draft-to-issue/{draft.pk}/"
    denied = session_client.post(
        url, {"name": "Explicit readonly", "custom_properties": {key: "User write"}}, format="json"
    )
    assert denied.status_code == 400, denied.data
    assert DraftIssue.objects.filter(pk=draft.pk).exists()
    response = session_client.post(url, {"name": "Readonly published"}, format="json")
    assert response.status_code == 201, response.data
    assert Issue.objects.get(pk=response.data["id"]).custom_properties[key] == "Current default"
    assert not DraftIssue.objects.filter(pk=draft.pk).exists()
