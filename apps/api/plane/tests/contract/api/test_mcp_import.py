from uuid import uuid4

import pytest

from plane.db.models import Issue, Project, ProjectMember, State
from plane.tests.contract.api.test_mcp import mcp as mcp_fixture, project as project_fixture

mcp = mcp_fixture
project = project_fixture

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def test_archive_pagination_children_and_uuid_readback(mcp, project):
    State.objects.create(project=project, name="Done", group="completed")
    _, parent = mcp.tool("workitem", action="create", project="WEB", name="Parent", state="Done")
    _, child = mcp.tool("workitem", action="create", project="WEB", name="Child", state="Done", parent=parent["id"])
    for item in [parent, child]:
        error, result = mcp.tool("workitem", action="archive", work_item=item["id"])
        assert not error, result
    error, active = mcp.tool("workitem", action="list", project="WEB")
    assert not error and active["results"] == []
    error, first = mcp.tool("workitem", action="archived", project="WEB", per_page=1)
    assert not error, first
    assert first["results"][0]["archived_at"]
    error, second = mcp.tool("workitem", action="archived", project="WEB", per_page=1, cursor=first["next_cursor"])
    assert not error and {first["results"][0]["id"], second["results"][0]["id"]} == {parent["id"], child["id"]}
    error, item = mcp.tool("workitem", action="get", project="WEB", work_item=child["id"], include_archived=True)
    assert not error and item["archived_at"] and item["parent"]["id"] == parent["id"]
    error, result = mcp.tool("workitem", action="unarchive", work_item=child["id"])
    assert not error, result


def test_get_project_scope_is_validated(mcp, project, workspace, create_user):
    _, item = mcp.tool("workitem", action="create", project="WEB", name="Scope")
    other = Project.objects.create(workspace=workspace, name="Other", identifier="OTHER")
    ProjectMember.objects.create(project=other, member=create_user, role=20)
    error, result = mcp.tool("workitem", action="get", project="OTHER", work_item=item["id"])
    assert error and "不属于" in result


def test_dependency_direction_idempotence_and_removal(mcp, project):
    _, first = mcp.tool("workitem", action="create", project="WEB", name="Prerequisite")
    _, second = mcp.tool("workitem", action="create", project="WEB", name="Dependent")
    for _ in range(2):
        error, result = mcp.tool(
            "workitem",
            action="add_relation",
            work_item=first["id"],
            relation_type="blocks",
            related_items=[second["id"]],
        )
        assert not error, result
        assert [item["issue_id"] for item in result["blocks"]] == [second["id"]]
    error, reverse = mcp.tool("workitem", action="relations", work_item=second["id"])
    assert not error and [item["issue_id"] for item in reverse["blocked_by"]] == [first["id"]]
    for _ in range(2):
        error, result = mcp.tool(
            "workitem",
            action="remove_relation",
            work_item=second["id"],
            relation_type="blocked_by",
            related_items=[first["id"]],
        )
        assert not error and result["blocked_by"] == []


def test_module_owner_and_members_round_trip(mcp, project, create_user):
    project.module_view = True
    project.save(update_fields=["module_view"])
    error, module = mcp.tool("module", action="create", project="WEB", name="Owned", lead="me", members=["me"])
    assert not error, module
    error, module = mcp.tool("module", action="get", project="WEB", module=module["id"])
    assert not error and str(create_user.id) in str(module["lead"])
    error, result = mcp.tool("module", action="update", project="WEB", module=module["id"], lead=None, members=[])
    assert not error, result
    error, module = mcp.tool("module", action="get", project="WEB", module=module["id"])
    assert not error and not module.get("lead") and not module.get("members")


def test_upsert_stable_ids_bulk_results_and_markdown(mcp, project):
    error, batch = mcp.tool(
        "workitem",
        action="bulk_upsert",
        project="WEB",
        external_source="import:test",
        items=[
            {"external_id": "local-1", "name": "First", "description": "- [ ] WEQ2-17 pending\n- [x] done"},
            {"external_id": "local-2", "name": "Second"},
            {"external_id": "invalid", "name": "Bad state", "state": "Missing"},
        ],
    )
    assert not error, batch
    assert batch["succeeded"] == 2 and batch["failed"] == 1 and batch["unknown"] == 0
    first_id = batch["results"][0]["work_item"]["id"]
    for _ in range(2):
        error, item = mcp.tool(
            "workitem",
            action="upsert",
            project="WEB",
            external_source="import:test",
            external_id="local-1",
            name="Updated",
        )
        assert not error and item["id"] == first_id
    error, item = mcp.tool(
        "workitem", action="get_by_external_id", project="WEB", external_source="import:test", external_id="local-1"
    )
    assert not error and item["id"] == first_id
    assert "- [ ] WEQ2-17 pending" in item["description"] and "- [x] done" in item["description"]
    assert Issue.objects.filter(project=project, external_source="import:test").count() == 2
    error, result = mcp.tool(
        "workitem", action="get_by_external_id", project="WEB", external_source="import:test", external_id=str(uuid4())
    )
    assert error, result
