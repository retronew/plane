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


def merge_sources(ctx, kind="text", configs=None):
    return [
        ProjectCustomProperty.objects.create(
            project=ctx.project,
            name=f"Source {i}",
            property_type=kind,
            config=validate_config(kind, (configs or [{}, {}])[i]),
        )
        for i in range(2)
    ]


def merge_request(client, ctx, sources, preview=False, **overrides):
    return client.post(
        ctx.base + "custom-properties/merge/" + ("preview/" if preview else ""),
        {"source_property_ids": [str(p.pk) for p in sources], "name": "Merged", "description": "Combined", **overrides},
        format="json",
    )


@pytest.mark.parametrize("kind,value", [("number", 0), ("boolean", False), ("text", "History")])
def test_merge_migrates_history_and_drafts(session_client, property_ctx, kind, value):
    from django.utils import timezone

    ctx = property_ctx
    sources = merge_sources(ctx, kind)
    keys = [str(p.pk) for p in sources]
    Issue.all_objects.filter(pk=ctx.issue.pk).update(
        custom_properties={keys[0]: value, keys[1]: None, "unrelated": "keep"},
        deleted_at=timezone.now(),
        archived_at=timezone.now(),
    )
    draft = DraftIssue.objects.create(project=ctx.project, workspace=ctx.workspace, custom_properties={keys[1]: value})
    IssueTypeCustomProperty.objects.create(project=ctx.project, property=sources[0], project_issue_type=ctx.binding)
    preview = merge_request(session_client, ctx, sources, preview=True)
    assert preview.status_code == 200, preview.data
    assert preview.data == {
        "can_merge": True,
        "merged_count": 2,
        "work_items_count": 1,
        "draft_count": 1,
        "type_count": 1,
    }
    assert not ProjectCustomProperty.objects.filter(name="Merged", project=ctx.project).exists()
    response = merge_request(session_client, ctx, sources)
    assert response.status_code == 201, response.data
    target = response.data["property"]
    key = str(target["id"])
    assert key not in keys
    assert target["name"] == "Merged" and target["description"] == "Combined"
    ctx.issue.refresh_from_db()
    draft.refresh_from_db()
    assert ctx.issue.custom_properties == {key: value, "unrelated": "keep"}
    assert draft.custom_properties == {key: value}
    assert len(target["type_settings"]) == 1
    assert (
        ProjectCustomProperty.objects.filter(pk__in=[p.pk for p in sources], is_archived=True, is_active=False).count()
        == 2
    )
    assert merge_request(session_client, ctx, sources).status_code == 400


@pytest.mark.parametrize("kind,value", [("number", 0), ("boolean", False), ("text", "same")])
@pytest.mark.parametrize("draft", [False, True])
def test_merge_value_conflict_never_discards_values(session_client, property_ctx, kind, value, draft):
    ctx = property_ctx
    sources = merge_sources(ctx, kind)
    values = {str(p.pk): value for p in sources}
    if draft:
        DraftIssue.objects.create(project=ctx.project, workspace=ctx.workspace, custom_properties=values)
    else:
        Issue.all_objects.filter(pk=ctx.issue.pk).update(custom_properties=values, type=None)
    for preview in (True, False):
        response = merge_request(session_client, ctx, sources, preview=preview)
        assert response.status_code == 400, response.data
        assert response.data["code"] == "CUSTOM_PROPERTY_MERGE_VALUE_CONFLICT"
    assert not ProjectCustomProperty.objects.filter(project=ctx.project, is_archived=True).exists()
    assert not ProjectCustomProperty.objects.filter(project=ctx.project, name="Merged").exists()


@pytest.mark.parametrize("inactive", [False, True])
def test_merge_rejects_overlapping_bindings(session_client, property_ctx, inactive):
    ctx = property_ctx
    sources = merge_sources(ctx)
    for p in sources:
        IssueTypeCustomProperty.objects.create(
            project=ctx.project, property=p, project_issue_type=ctx.binding, is_active=not inactive
        )
    response = merge_request(session_client, ctx, sources)
    assert response.status_code == 400
    assert response.data["code"] == "CUSTOM_PROPERTY_MERGE_TYPE_BINDING_CONFLICT"


def test_merge_dropdown_preserves_option_ids_and_multiselect_defaults(session_client, property_ctx):
    ctx = property_ctx
    sources = merge_sources(ctx, "dropdown", [{"multiple": True}, {"multiple": True}])
    options = [
        CustomPropertyOption.objects.create(project=ctx.project, property=p, name=f"Option {i}")
        for i, p in enumerate(sources)
    ]
    for p, o in zip(sources, options):
        p.config["default_value"] = [str(o.pk)]
        p.save()
    ctx.issue.custom_properties = {str(sources[0].pk): [str(options[0].pk)]}
    ctx.issue.save()
    response = merge_request(session_client, ctx, sources)
    assert response.status_code == 201, response.data
    target = response.data["property"]
    assert target["config"]["default_value"] == [str(o.pk) for o in options]
    assert {str(o["id"]) for o in target["options"]} == {str(o.pk) for o in options}
    assert CustomPropertyOption.objects.filter(property_id=target["id"]).count() == 2
    ctx.issue.refresh_from_db()
    assert ctx.issue.custom_properties == {str(target["id"]): [str(options[0].pk)]}


@pytest.mark.parametrize(
    "case", ["duplicate", "one", "many", "foreign", "archived", "type", "config", "multiple", "name"]
)
def test_merge_rejects_invalid_sources_and_config(session_client, property_ctx, case):
    ctx = property_ctx
    sources = merge_sources(ctx)
    payload = {}
    if case == "duplicate":
        sources = [sources[0], sources[0]]
    elif case == "one":
        sources = sources[:1]
    elif case == "many":
        payload["source_property_ids"] = [str(uuid4()) for _ in range(101)]
    elif case == "foreign":
        other = Project.objects.create(workspace=ctx.workspace, name="Other", identifier="OTH")
        sources[1].project = other
        sources[1].save()
    elif case == "archived":
        sources[1].is_archived = True
        sources[1].save()
    elif case == "type":
        sources[1].property_type = "number"
        sources[1].save()
    elif case == "config":
        sources[1].config["multiline"] = True
        sources[1].save()
    elif case == "multiple":
        for i, p in enumerate(sources):
            p.property_type = "member"
            p.config = {"multiple": bool(i)}
            p.save()
    else:
        payload["name"] = sources[0].name
    response = merge_request(session_client, ctx, sources, **payload)
    assert response.status_code == 400, response.data
    assert "code" in response.data
    assert not ProjectCustomProperty.objects.filter(project=ctx.project, name="Merged").exists()


@pytest.mark.parametrize("preview", [True, False])
def test_merge_requires_schema_management_permission(session_client, property_ctx, preview):
    ctx = property_ctx
    sources = merge_sources(ctx)
    ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(role=15)
    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(role=15)
    assert merge_request(session_client, ctx, sources, preview=preview).status_code == 403


def test_merge_rolls_back_after_partial_migration(session_client, property_ctx, monkeypatch):
    ctx = property_ctx
    sources = merge_sources(ctx, "dropdown")
    option = CustomPropertyOption.objects.create(project=ctx.project, property=sources[0], name="Rollback option")
    binding = IssueTypeCustomProperty.objects.create(
        project=ctx.project, property=sources[0], project_issue_type=ctx.binding
    )
    draft = DraftIssue.objects.create(
        project=ctx.project, workspace=ctx.workspace, custom_properties={str(sources[0].pk): str(option.pk)}
    )
    values = {str(sources[0].pk): str(option.pk)}
    Issue.all_objects.filter(pk=ctx.issue.pk).update(custom_properties=values)
    from django.db.models.query import QuerySet

    original = QuerySet.update

    def fail_binding_update(queryset, **kwargs):
        if queryset.model is IssueTypeCustomProperty:
            raise RuntimeError("Injected failure after values migration")
        return original(queryset, **kwargs)

    monkeypatch.setattr(QuerySet, "update", fail_binding_update)
    response = merge_request(session_client, ctx, sources)
    assert response.status_code == 500
    ctx.issue.refresh_from_db()
    assert ctx.issue.custom_properties == values
    assert ProjectCustomProperty.objects.filter(project=ctx.project).count() == 2
    assert not ProjectCustomProperty.objects.filter(project=ctx.project, is_archived=True).exists()
    option.refresh_from_db()
    binding.refresh_from_db()
    draft.refresh_from_db()
    assert option.property_id == sources[0].pk
    assert binding.property_id == sources[0].pk
    assert draft.custom_properties == values


@pytest.mark.parametrize("conflict", ["option", "default"])
def test_merge_dropdown_conflicts(session_client, property_ctx, conflict):
    ctx = property_ctx
    sources = merge_sources(ctx, "dropdown")
    for i, prop in enumerate(sources):
        option = CustomPropertyOption.objects.create(
            project=ctx.project, property=prop, name="Same" if conflict == "option" else str(i)
        )
        if conflict == "default":
            prop.config["default_value"] = str(option.pk)
            prop.save()
    for preview in (True, False):
        response = merge_request(session_client, ctx, sources, preview=preview)
        assert response.status_code == 400
        assert response.data["code"] == (
            "CUSTOM_PROPERTY_MERGE_OPTION_CONFLICT"
            if conflict == "option"
            else "CUSTOM_PROPERTY_MERGE_DEFAULT_CONFLICT"
        )


def test_merge_single_dropdown_default_and_archived_option_history(session_client, property_ctx):
    ctx = property_ctx
    sources = merge_sources(ctx, "dropdown")
    default = CustomPropertyOption.objects.create(project=ctx.project, property=sources[0], name="Default")
    old = CustomPropertyOption.objects.create(
        project=ctx.project, property=sources[1], name="Old", is_active=False, is_archived=True
    )
    sources[0].config["default_value"] = str(default.pk)
    sources[0].save()
    ctx.issue.custom_properties = {str(sources[1].pk): str(old.pk)}
    ctx.issue.save()
    response = merge_request(session_client, ctx, sources)
    assert response.status_code == 201, response.data
    target = response.data["property"]
    assert target["config"]["default_value"] == str(default.pk)
    assert len(target["options"]) == 2
    old.refresh_from_db()
    assert old.property_id == target["id"]
    assert old.is_archived and not old.is_active
    ctx.issue.refresh_from_db()
    assert ctx.issue.custom_properties == {str(target["id"]): str(old.pk)}


def test_unarchive_stale_issue_cannot_overwrite_merged_values(session_client, property_ctx, monkeypatch):
    from django.utils import timezone
    from plane.app.views.issue import archive

    ctx = property_ctx
    sources = merge_sources(ctx)
    Issue.all_objects.filter(pk=ctx.issue.pk).update(
        archived_at=timezone.now(), custom_properties={str(sources[0].pk): "Retain"}
    )
    merged = []

    def merge_after_unarchive_reads(**kwargs):
        response = merge_request(session_client, ctx, sources)
        assert response.status_code == 201, response.data
        merged.append(response.data["property"]["id"])

    monkeypatch.setattr(archive.issue_activity, "delay", merge_after_unarchive_reads)
    response = session_client.delete(ctx.base + f"issues/{ctx.issue.pk}/archive/")
    assert response.status_code == 204, response.data
    ctx.issue.refresh_from_db()
    assert ctx.issue.archived_at is None
    assert ctx.issue.custom_properties == {str(merged[0]): "Retain"}


def test_merge_rejects_oversized_combined_multiselect_default(session_client, property_ctx):
    ctx = property_ctx
    sources = merge_sources(ctx, "dropdown", [{"multiple": True}, {"multiple": True}])
    for i, prop in enumerate(sources):
        options = [
            CustomPropertyOption(project=ctx.project, workspace=ctx.workspace, property=prop, name=f"{i}-{j}")
            for j in range(300)
        ]
        CustomPropertyOption.objects.bulk_create(options)
        prop.config["default_value"] = [str(o.pk) for o in options]
        prop.save()
        assert len(validate_value(prop, prop.config["default_value"], ctx.project.pk)) == 300
    for preview in (True, False):
        response = merge_request(session_client, ctx, sources, preview=preview)
        assert response.status_code == 400, response.data
        assert response.data["code"] == "CUSTOM_PROPERTY_MERGE_DEFAULT_CONFLICT"
    assert ProjectCustomProperty.objects.filter(project=ctx.project).count() == 2
    assert CustomPropertyOption.objects.filter(property=sources[0]).count() == 300
    assert CustomPropertyOption.objects.filter(property=sources[1]).count() == 300


def test_draft_publish_activities_wait_for_commit(
    session_client, property_ctx, monkeypatch, django_capture_on_commit_callbacks
):
    from plane.app.views.workspace import draft as views

    ctx = property_ctx
    draft = DraftIssue.objects.create(project=ctx.project, workspace=ctx.workspace, name="Commit")
    DraftIssue.objects.filter(pk=draft.pk).update(created_by=ctx.user)
    activity = Mock()
    monkeypatch.setattr(views.issue_activity, "delay", activity)
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = session_client.post(
            f"/api/workspaces/{ctx.workspace.slug}/draft-to-issue/{draft.pk}/", {"name": "Committed"}, format="json"
        )
        assert response.status_code == 201, response.data
        activity.assert_not_called()
    assert len(callbacks) >= 1
    activity.assert_called_once()
    assert activity.call_args.kwargs["issue_id"] == str(response.data["id"])


def test_draft_removed_while_waiting_for_publish_returns_404(session_client, property_ctx, monkeypatch):
    from django.db.models.query import QuerySet
    from django.utils import timezone

    ctx = property_ctx
    draft = DraftIssue.objects.create(project=ctx.project, workspace=ctx.workspace, name="Race")
    DraftIssue.objects.filter(pk=draft.pk).update(created_by=ctx.user)
    original = QuerySet.select_for_update

    def remove_before_lock(queryset, *args, **kwargs):
        if queryset.model is DraftIssue:
            DraftIssue.all_objects.filter(pk=draft.pk).update(deleted_at=timezone.now())
        return original(queryset, *args, **kwargs)

    monkeypatch.setattr(QuerySet, "select_for_update", remove_before_lock)
    response = session_client.post(
        f"/api/workspaces/{ctx.workspace.slug}/draft-to-issue/{draft.pk}/", {"name": "No duplicate"}, format="json"
    )
    assert response.status_code == 404, response.data
    assert not Issue.objects.filter(project=ctx.project, name="No duplicate").exists()


@pytest.mark.django_db(transaction=True)
def test_merge_serializes_concurrent_value_write(property_ctx, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event

    from django.db import close_old_connections
    from rest_framework.test import APIClient
    from plane.app.views.project import custom_property as views

    ctx = property_ctx
    sources = merge_sources(ctx)
    source_key = str(sources[0].pk)
    Issue.all_objects.filter(pk=ctx.issue.pk).update(custom_properties={source_key: "Before"})
    locked, release, write_started, write_done = Event(), Event(), Event(), Event()
    original = views.apply_property_merge

    def paused_merge(*args, **kwargs):
        locked.set()
        assert release.wait(10)
        return original(*args, **kwargs)

    monkeypatch.setattr(views, "apply_property_merge", paused_merge)

    def call(merge):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user=ctx.user)
            if merge:
                return merge_request(client, ctx, sources)
            write_started.set()
            response = client.put(
                ctx.base + f"issues/{ctx.issue.pk}/custom-properties/",
                {"values": {source_key: "Concurrent"}},
                format="json",
            )
            write_done.set()
            return response
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        merging = executor.submit(call, True)
        try:
            assert locked.wait(10)
            writing = executor.submit(call, False)
            assert write_started.wait(10)
            assert not write_done.wait(0.2)
        finally:
            release.set()
        merged, written = merging.result(timeout=10), writing.result(timeout=10)
    assert merged.status_code == 201, merged.data
    assert written.status_code == 400, written.data
    ctx.issue.refresh_from_db()
    assert ctx.issue.custom_properties == {str(merged.data["property"]["id"]): "Before"}


def patch_property_options(client, url, data, format="json"):
    if "options" in data:
        data = {**data, "options_version": client.get(url).data["options_version"]}
    return client.patch(url, data, format=format)


@pytest.mark.parametrize("multiple", [False, True])
def test_atomic_property_create_maps_temporary_defaults(session_client, property_ctx, multiple):
    ctx = property_ctx
    response = session_client.post(
        ctx.base + "custom-properties/",
        {
            "name": "Atomic dropdown",
            "property_type": "dropdown",
            "type_id": str(ctx.issue_type.pk),
            "config": {"multiple": multiple, "default_value": ["new-high"] if multiple else "new-high"},
            "options": [{"client_id": "new-high", "name": "High", "color": "#123456", "sort_order": 2}],
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    option = response.data["options"][0]
    expected = [str(option["id"])] if multiple else str(option["id"])
    assert response.data["config"]["default_value"] == expected
    assert "client_id" not in option
    assert option["color"] == "#123456"
    assert option["sort_order"] == 2
    assert IssueTypeCustomProperty.objects.filter(
        property_id=response.data["id"], project_issue_type=ctx.binding
    ).exists()


def test_atomic_property_patch_preserves_history_and_restores_options(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    old = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Old")
    inactive = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Inactive", is_active=False)
    archived = CustomPropertyOption.objects.create(
        project=ctx.project, property=prop, name="Archived", is_active=False, is_archived=True
    )
    ctx.issue.custom_properties = {str(prop.pk): str(old.pk)}
    ctx.issue.save()
    prop.config["default_value"] = str(old.pk)
    prop.save()
    url = ctx.base + f"custom-properties/{prop.pk}/"
    response = patch_property_options(
        session_client,
        url,
        {
            "name": "Updated atomically",
            "config": {"default_value": "new-choice"},
            "options": [
                {"id": str(inactive.pk), "name": "Still inactive"},
                {"id": str(archived.pk), "name": "Restored", "is_active": True},
                {"client_id": "new-choice", "name": "New"},
            ],
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    new = CustomPropertyOption.objects.get(property=prop, name="New")
    prop.refresh_from_db()
    old.refresh_from_db()
    inactive.refresh_from_db()
    archived.refresh_from_db()
    ctx.issue.refresh_from_db()
    assert prop.name == "Updated atomically"
    assert prop.config["default_value"] == str(new.pk)
    assert old.is_archived and not old.is_active
    assert not inactive.is_archived and not inactive.is_active
    assert not archived.is_archived and archived.is_active
    assert ctx.issue.custom_properties == {str(prop.pk): str(old.pk)}
    assert len(response.data["options"]) == 4
    assert (
        patch_property_options(
            session_client, url, {"options": [], "config": {"default_value": None}}, format="json"
        ).status_code
        == 200
    )
    assert not CustomPropertyOption.objects.filter(property=prop, is_archived=False).exists()
    assert CustomPropertyOption.objects.filter(property=prop).count() == 4


def test_atomic_property_patch_can_swap_names_and_clear_default(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown", config={"multiple": True})
    first = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="First")
    second = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Second")
    prop.config["default_value"] = [str(first.pk)]
    prop.save()
    url = ctx.base + f"custom-properties/{prop.pk}/"
    response = patch_property_options(
        session_client,
        url,
        {"options": [{"id": str(first.pk), "name": "Second"}, {"id": str(second.pk), "name": "First"}]},
        format="json",
    )
    assert response.status_code == 200, response.data
    first.refresh_from_db()
    assert first.name == "Second" and first.is_active
    response = patch_property_options(
        session_client, url, {"options": [], "config": {"default_value": []}}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["config"]["default_value"] == []


@pytest.mark.parametrize(
    "options,default",
    [
        ([{"client_id": "same", "name": "One"}, {"client_id": "same", "name": "Two"}], None),
        ([{"name": " Same "}, {"name": "Same"}], None),
        ([{"client_id": 123, "name": "Numeric temporary ID"}], None),
        ([{"client_id": " ", "name": "Empty temporary ID"}], None),
        ([{"client_id": "x" * 256, "name": "Long temporary ID"}], None),
        ([{"name": "Valid", "client_id": "new", "is_active": False}], "new"),
        ([{"name": "Valid", "client_id": "new"}], "unknown"),
        ([{"name": "Valid", "client_id": "new"}], {"invalid": True}),
        ([{"name": "Valid", "client_id": "new"}], ["new"]),
        ([{"name": "Valid", "sort_order": "Infinity"}], None),
        ([{"name": "Valid", "color": "red"}], None),
        (None, None),
        ({"name": "Not a list"}, None),
        ([{"name": str(index)} for index in range(501)], None),
    ],
)
def test_atomic_property_create_rejects_invalid_options_without_writes(session_client, property_ctx, options, default):
    ctx = property_ctx
    response = session_client.post(
        ctx.base + "custom-properties/",
        {
            "name": "Must roll back",
            "property_type": "dropdown",
            "config": {"default_value": default},
            "options": options,
        },
        format="json",
    )
    assert response.status_code == 400, response.data
    assert not ProjectCustomProperty.objects.filter(project=ctx.project).exists()
    assert not CustomPropertyOption.objects.filter(project=ctx.project).exists()


@pytest.mark.parametrize(
    "case", ["foreign_project", "foreign_property", "missing", "duplicate", "both", "collision", "deleted"]
)
def test_atomic_property_patch_rejects_invalid_ids_without_writes(session_client, property_ctx, case):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    local = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Original")
    other = make_property(ctx, "dropdown")
    foreign_project = Project.objects.create(workspace=ctx.workspace, name="Foreign", identifier="FOREIGN")
    foreign_prop = ProjectCustomProperty.objects.create(
        project=foreign_project, name="Foreign", property_type="dropdown"
    )
    foreign = CustomPropertyOption.objects.create(project=foreign_project, property=foreign_prop, name="Foreign")
    other_option = CustomPropertyOption.objects.create(project=ctx.project, property=other, name="Other")
    deleted = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Deleted")
    from django.utils import timezone

    CustomPropertyOption.all_objects.filter(pk=deleted.pk).update(deleted_at=timezone.now())
    rows = {
        "foreign_project": [{"id": str(foreign.pk), "name": "Injected"}],
        "foreign_property": [{"id": str(other_option.pk), "name": "Injected"}],
        "missing": [{"id": str(uuid4()), "name": "Injected"}],
        "duplicate": [{"id": str(local.pk), "name": "One"}, {"id": str(local.pk), "name": "Two"}],
        "both": [{"id": str(local.pk), "client_id": "new", "name": "Injected"}],
        "collision": [{"client_id": str(local.pk).upper(), "name": "Injected"}],
        "deleted": [{"id": str(deleted.pk), "name": "Injected"}],
    }[case]
    response = patch_property_options(
        session_client,
        ctx.base + f"custom-properties/{prop.pk}/",
        {"name": "Must roll back", "options": rows},
        format="json",
    )
    assert response.status_code == 400, response.data
    prop.refresh_from_db()
    local.refresh_from_db()
    assert prop.name != "Must roll back"
    assert local.name == "Original" and local.is_active and not local.is_archived
    assert CustomPropertyOption.objects.filter(property=prop).count() == 1


@pytest.mark.parametrize("multiple", [False, True])
@pytest.mark.parametrize("deactivate", [False, True])
def test_atomic_property_patch_invalid_default_rolls_back_everything(
    session_client, property_ctx, multiple, deactivate
):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown", config={"multiple": multiple})
    option = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Original")
    default = [str(option.pk)] if multiple else str(option.pk)
    prop.config["default_value"] = default
    prop.save()
    ctx.issue.custom_properties = {str(prop.pk): default}
    ctx.issue.save()
    options = [{"id": str(option.pk), "name": "Renamed", "is_active": False}] if deactivate else []
    options.append({"client_id": "new", "name": "Must roll back"})
    response = patch_property_options(
        session_client,
        ctx.base + f"custom-properties/{prop.pk}/",
        {"name": "Must roll back", "options": options},
        format="json",
    )
    assert response.status_code == 400, response.data
    assert "default_value" in response.data["config"]
    prop.refresh_from_db()
    option.refresh_from_db()
    ctx.issue.refresh_from_db()
    assert prop.name != "Must roll back" and prop.config["default_value"] == default
    assert option.name == "Original" and option.is_active and not option.is_archived
    assert CustomPropertyOption.objects.filter(property=prop).count() == 1
    assert ctx.issue.custom_properties == {str(prop.pk): default}


def test_atomic_property_create_rejects_existing_ids_and_foreign_defaults(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    option = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Original")
    for payload in (
        {"options": [{"id": str(option.pk), "name": "Injected"}]},
        {"config": {"default_value": str(option.pk)}},
        {"type_id": str(uuid4()), "options": [{"client_id": "new", "name": "Rollback"}]},
    ):
        response = session_client.post(
            ctx.base + "custom-properties/",
            {"name": "Must roll back", "property_type": "dropdown", **payload},
            format="json",
        )
        assert response.status_code in (400, 404), response.data
        assert ProjectCustomProperty.objects.filter(project=ctx.project).count() == 1
        assert CustomPropertyOption.objects.filter(project=ctx.project).count() == 1


def test_atomic_property_options_limit_excludes_archived_history(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    CustomPropertyOption.objects.bulk_create(
        [
            CustomPropertyOption(
                project=ctx.project, workspace=ctx.workspace, property=prop, name=str(index), is_archived=True
            )
            for index in range(501)
        ]
    )
    response = patch_property_options(
        session_client,
        ctx.base + f"custom-properties/{prop.pk}/",
        {"options": [{"client_id": "new", "name": "Current"}], "config": {"default_value": "new"}},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert len(response.data["options"]) == 502
    response = patch_property_options(
        session_client,
        ctx.base + f"custom-properties/{prop.pk}/",
        {"options": [{"name": str(index)} for index in range(501)]},
        format="json",
    )
    assert response.status_code == 400, response.data
    assert CustomPropertyOption.objects.filter(property=prop, is_archived=False).count() == 1


def test_atomic_property_patch_mixed_defaults_and_legacy_endpoints(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown", config={"multiple": True})
    url = ctx.base + f"custom-properties/{prop.pk}/"
    legacy = session_client.post(url + "options/", {"name": "Existing"}, format="json")
    assert legacy.status_code == 201, legacy.data
    existing_id = str(legacy.data["id"])
    response = patch_property_options(
        session_client,
        url,
        {
            "options": [{"id": existing_id, "name": "Existing"}, {"client_id": "new", "name": "New"}],
            "config": {"default_value": [existing_id, "new"]},
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    new_id = str(CustomPropertyOption.objects.get(property=prop, name="New").pk)
    assert response.data["config"]["default_value"] == [existing_id, new_id]
    response = patch_property_options(session_client, url, {"description": "No options supplied"}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["config"]["default_value"] == [existing_id, new_id]
    assert CustomPropertyOption.objects.filter(property=prop, is_archived=False).count() == 2
    response = patch_property_options(session_client, url + f"options/{new_id}/", {"is_active": False}, format="json")
    assert response.status_code == 200, response.data
    prop.refresh_from_db()
    assert prop.config["default_value"] == [existing_id]


@pytest.mark.parametrize("kind", ["text", "dropdown"])
def test_atomic_property_empty_options_and_legacy_create(session_client, property_ctx, kind):
    ctx = property_ctx
    response = session_client.post(
        ctx.base + "custom-properties/",
        {"name": "Legacy", "property_type": kind, "options": [] if kind == "text" else [{"name": "Legacy option"}]},
        format="json",
    )
    assert response.status_code == 201, response.data
    url = ctx.base + f"custom-properties/{response.data['id']}/"
    response = patch_property_options(session_client, url, {"options": []}, format="json")
    assert response.status_code == 200, response.data
    if kind == "text":
        response = patch_property_options(session_client, url, {"options": [{"name": "Invalid"}]}, format="json")
        assert response.status_code == 400, response.data


def test_atomic_property_allows_500_current_options(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    response = patch_property_options(
        session_client,
        ctx.base + f"custom-properties/{prop.pk}/",
        {"options": [{"client_id": f"new-{index}", "name": str(index)} for index in range(500)]},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert CustomPropertyOption.objects.filter(property=prop, is_archived=False, is_active=True).count() == 500


@pytest.mark.parametrize("multiple", [False, True])
def test_atomic_property_preserves_opaque_client_ids(session_client, property_ctx, multiple):
    ctx = property_ctx
    response = session_client.post(
        ctx.base + "custom-properties/",
        {
            "name": "Opaque IDs",
            "property_type": "dropdown",
            "options": [{"client_id": " new-choice ", "name": "Choice"}],
            "config": {"multiple": multiple, "default_value": [" new-choice "] if multiple else " new-choice "},
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    option_id = str(response.data["options"][0]["id"])
    assert response.data["config"]["default_value"] == ([option_id] if multiple else option_id)


def test_atomic_property_stale_options_conflict_without_writes(session_client, property_ctx):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    option = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Original")
    url = ctx.base + f"custom-properties/{prop.pk}/"
    first_read = session_client.get(url).data
    second_read = session_client.get(url).data
    assert first_read["options_version"] == second_read["options_version"]
    added = session_client.patch(
        url,
        {
            "options_version": second_read["options_version"],
            "options": [{"id": str(option.pk), "name": "Original"}, {"client_id": "new-y", "name": "Y"}],
        },
        format="json",
    )
    assert added.status_code == 200, added.data
    assert added.data["options_version"] != first_read["options_version"]
    before = session_client.get(url).data
    stale = session_client.patch(
        url,
        {
            "name": "Must not change",
            "options_version": first_read["options_version"],
            "options": [{"id": str(option.pk), "name": "Stale rename"}],
            "config": {"default_value": str(option.pk)},
        },
        format="json",
    )
    assert stale.status_code == 409, stale.data
    assert stale.data == {"code": "CUSTOM_PROPERTY_OPTIONS_CONFLICT"}
    assert session_client.get(url).data == before
    assert CustomPropertyOption.objects.get(property=prop, name="Y").is_archived is False
    assert session_client.patch(url, {"options": []}, format="json").status_code == 409
    assert session_client.get(url).data == before
    assert session_client.patch(url, {"description": "Legacy patch"}, format="json").status_code == 200


@pytest.mark.parametrize("mutation", ["create", "name", "color", "sort_order", "is_active", "archive", "property"])
def test_atomic_property_version_detects_legacy_mutations(session_client, property_ctx, mutation):
    ctx = property_ctx
    prop = make_property(ctx, "dropdown")
    option = CustomPropertyOption.objects.create(project=ctx.project, property=prop, name="Original")
    url = ctx.base + f"custom-properties/{prop.pk}/"
    before = session_client.get(url).data
    if mutation == "create":
        changed = session_client.post(url + "options/", {"name": "Concurrent"}, format="json")
        assert changed.status_code == 201, changed.data
    elif mutation == "archive":
        assert session_client.delete(url + f"options/{option.pk}/").status_code == 204
    elif mutation == "property":
        assert session_client.patch(url, {"description": "Concurrent"}, format="json").status_code == 200
    else:
        value = {"name": "Renamed", "color": "#123456", "sort_order": 3, "is_active": False}[mutation]
        changed = session_client.patch(url + f"options/{option.pk}/", {mutation: value}, format="json")
        assert changed.status_code == 200, changed.data
    current = session_client.get(url).data
    assert current["options_version"] != before["options_version"]
    stale = session_client.patch(url, {"options": [], "options_version": before["options_version"]}, format="json")
    assert stale.status_code == 409, stale.data
    assert session_client.get(url).data == current
