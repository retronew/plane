# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

"""External module API contracts used by MCP module operations."""

from uuid import uuid4

import pytest
from django.utils import timezone

from plane.db.models import Issue, Module, ModuleIssue, ModuleMember, Project, ProjectMember, State, User

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def module_project(workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.api.views.module.model_activity.delay", lambda **kwargs: None)
    project = Project.objects.create(name="MCP Modules", identifier="MCM", workspace=workspace, module_view=True)
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
    return project


def _url(project, suffix=""):
    return f"/api/v1/workspaces/{project.workspace.slug}/projects/{project.id}/modules/{suffix}"


@pytest.mark.parametrize("field", ["lead", "members"])
@pytest.mark.parametrize("invalid", ["malformed", "unknown", "outsider", "inactive", "deleted"])
@pytest.mark.parametrize("operation", ["create", "update"])
def test_reject_invalid_member_uuid_or_membership(api_key_client, module_project, field, invalid, operation):
    project = module_project
    value = "not-a-uuid" if invalid == "malformed" else str(uuid4())
    if invalid in {"outsider", "inactive", "deleted"}:
        user = User.objects.create(email=f"{invalid}@module.test", username=f"module-{invalid}")
        value = str(user.id)
        if invalid != "outsider":
            membership = ProjectMember.objects.create(
                project=project, workspace=project.workspace, member=user, is_active=invalid != "inactive"
            )
            if invalid == "deleted":
                membership.delete()
    body = {field: [value] if field == "members" else value}
    if operation == "create":
        response = api_key_client.post(_url(project), {"name": "Invalid", **body}, format="json")
    else:
        module = Module.objects.create(name="Original", project=project, workspace=project.workspace)
        response = api_key_client.patch(_url(project, f"{module.id}/"), body, format="json")
        module.refresh_from_db()
        assert module.lead_id is None
        assert not ModuleMember.objects.filter(module=module).exists()
    assert response.status_code == 400
    assert field in response.data


def test_member_replace_omit_clear_and_nullable_lead(api_key_client, module_project, create_user):
    project = module_project
    other = User.objects.create(email="other@module.test", username="module-other")
    ProjectMember.objects.create(project=project, workspace=project.workspace, member=other)
    response = api_key_client.post(
        _url(project),
        {"name": "Assignments", "lead": str(create_user.id), "members": [str(create_user.id)] * 2},
        format="json",
    )
    assert response.status_code == 201, response.data
    module = Module.objects.get(pk=response.data["id"])
    assert module.lead_id == create_user.id
    assert list(ModuleMember.objects.filter(module=module).values_list("member_id", flat=True)) == [create_user.id]
    detail = _url(project, f"{module.id}/")

    def assert_read_members(expected):
        response = api_key_client.get(detail)
        assert response.status_code == 200, response.data
        assert response.data["members"] == expected
        response = api_key_client.get(_url(project))
        assert response.status_code == 200, response.data
        item = next(item for item in response.data["results"] if str(item["id"]) == str(module.id))
        assert item["members"] == expected

    assert_read_members([str(create_user.id)])
    response = api_key_client.patch(detail, {"name": "Renamed"}, format="json")
    assert response.status_code == 200, response.data
    assert ModuleMember.objects.filter(module=module, member=create_user).exists()
    response = api_key_client.patch(detail, {"members": [str(other.id)]}, format="json")
    assert response.status_code == 200, response.data
    assert list(ModuleMember.objects.filter(module=module).values_list("member_id", flat=True)) == [other.id]
    assert_read_members([str(other.id)])
    response = api_key_client.patch(detail, {"members": [], "lead": None}, format="json")
    assert response.status_code == 200, response.data
    module.refresh_from_db()
    assert module.lead_id is None
    assert not ModuleMember.objects.filter(module=module).exists()
    assert_read_members([])


def test_member_serialization_uses_prefetch(module_project, create_user, django_assert_num_queries):
    from plane.api.serializers.module import ModuleSerializer
    from plane.api.views.module import ModuleListCreateAPIEndpoint

    for index in range(2):
        module = Module.objects.create(
            name=f"Prefetched {index}", project=module_project, workspace=module_project.workspace
        )
        ModuleMember.objects.create(
            module=module, member=create_user, project=module_project, workspace=module_project.workspace
        )
    view = ModuleListCreateAPIEndpoint()
    view.kwargs = {"project_id": module_project.id, "slug": module_project.workspace.slug}
    modules = list(view.get_queryset())
    with django_assert_num_queries(0):
        data = ModuleSerializer(modules, many=True).data
    assert len(data) == 2
    assert all(item["members"] == [str(create_user.id)] for item in data)


def test_statistics_match_visible_module_items(api_key_client, module_project):
    project = module_project
    module = Module.objects.create(name="Counts", project=project, workspace=project.workspace)
    states = {
        group: State.objects.create(name=f"State {group}", group=group, project=project, workspace=project.workspace)
        for group in ("completed", "cancelled", "started", "unstarted", "backlog", "triage")
    }
    expected = []

    def add(group="completed", **kwargs):
        issue = Issue.objects.create(
            name=f"Item {uuid4()}", project=project, workspace=project.workspace, state=states[group], **kwargs
        )
        relation = ModuleIssue.objects.create(issue=issue, module=module, project=project, workspace=project.workspace)
        return issue, relation

    # Several completed items expose COUNT(DISTINCT state.group) returning only 1.
    for group in ("completed", "completed", "completed", "cancelled", "started", "unstarted", "backlog"):
        issue, _ = add(group)
        expected.append(str(issue.id))
    add(archived_at=timezone.now())
    add(is_draft=True)
    add("triage")
    deleted, _ = add()
    deleted.delete()
    _, removed_relation = add()
    removed_relation.delete()
    # A removed historical association for a visible item must not inflate counts.
    ModuleIssue.all_objects.create(
        issue_id=expected[0], module=module, project=project, workspace=project.workspace, deleted_at=timezone.now()
    )
    response = api_key_client.get(_url(project, f"{module.id}/module-issues/"))
    assert response.status_code == 200, response.data
    assert {str(item["id"]) for item in response.data["results"]} == set(expected)
    assert len(response.data["results"]) == len(expected)

    def assert_counts(data):
        assert data["total_issues"] == len(expected)
        assert data["completed_issues"] == 3
        for group in ("cancelled", "started", "unstarted", "backlog"):
            assert data[f"{group}_issues"] == 1

    response = api_key_client.get(_url(project, f"{module.id}/"))
    assert response.status_code == 200, response.data
    assert_counts(response.data)
    response = api_key_client.get(_url(project))
    assert response.status_code == 200, response.data
    assert_counts(next(item for item in response.data["results"] if str(item["id"]) == str(module.id)))
    module.archived_at = timezone.now()
    module.save()
    response = api_key_client.get(
        f"/api/v1/workspaces/{project.workspace.slug}/projects/{project.id}/archived-modules/"
    )
    assert response.status_code == 200, response.data
    assert_counts(next(item for item in response.data["results"] if str(item["id"]) == str(module.id)))
