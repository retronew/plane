# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from plane.db.models import APIToken, Issue, Label, Page, Project, ProjectMember, State, Workspace, WorkspaceMember

MODERN = "2026-07-28"
META = {
    "io.modelcontextprotocol/protocolVersion": MODERN,
    "io.modelcontextprotocol/clientInfo": {"name": "test", "version": "1"},
    "io.modelcontextprotocol/clientCapabilities": {},
}


@pytest.fixture(autouse=True)
def _no_page_tasks():
    with (
        patch("plane.api.views.page.page_transaction.delay"),
        patch("plane.api.views.page.track_page_version.delay"),
    ):
        yield


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Web", identifier="WEB", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace, default=True)
    State.objects.create(name="Doing", group="started", project=project, workspace=workspace)
    Label.objects.create(name="Bug", project=project, workspace=workspace)
    return project


@pytest.fixture
def mcp(db, api_token, workspace):
    client = APIClient()

    def call(
        method, params=None, *, modern=True, headers=None, request_id=1, token=api_token.token, explicit_workspace=True
    ):
        params = dict(params or {})
        if method == "tools/call" and explicit_workspace:
            arguments = dict(params.get("arguments") or {})
            if not (params.get("name") == "workspace" and arguments.get("action") == "list"):
                arguments.setdefault("workspace_slug", workspace.slug)
            params["arguments"] = arguments
        extra = {"HTTP_X_WORKSPACE_SLUG": workspace.slug}
        if token:
            extra["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        if modern:
            params["_meta"] = META
            extra["HTTP_MCP_PROTOCOL_VERSION"] = MODERN
            extra["HTTP_MCP_METHOD"] = method
            if method == "tools/call":
                extra["HTTP_MCP_NAME"] = params["name"]
        extra.update(headers or {})
        body = {"jsonrpc": "2.0", "method": method, "params": params}
        if request_id is not None:
            body["id"] = request_id
        return client.post("/mcp/", json.dumps(body), content_type="application/json", **extra)

    def tool(tool_name, /, **arguments):
        response = call("tools/call", {"name": tool_name, "arguments": arguments})
        assert response.status_code == 200, response.content
        result = response.json()["result"]
        text = result["content"][0]["text"]
        return result["isError"], (text if result["isError"] else json.loads(text))

    call.tool = tool
    return call


@pytest.mark.contract
class TestMCPProtocol:
    @pytest.mark.django_db
    def test_legacy_initialize_handshake(self, mcp):
        response = mcp("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}}, modern=False)
        result = response.json()["result"]
        assert result["protocolVersion"] == "2025-06-18"
        assert result["capabilities"]["tools"] is not None
        assert "Plane" in result["instructions"]
        assert "Mcp-Session-Id" not in response.headers

        assert mcp("notifications/initialized", modern=False, request_id=None).status_code == 202

        # Follow-up legacy request with the negotiated version header but no _meta
        response = mcp("tools/list", modern=False, headers={"HTTP_MCP_PROTOCOL_VERSION": "2025-06-18"})
        assert {t["name"] for t in response.json()["result"]["tools"]} >= {"workitem", "project", "page"}

    @pytest.mark.django_db
    def test_modern_discover_and_tools_list(self, mcp):
        result = mcp("server/discover").json()["result"]
        assert MODERN in result["supportedVersions"]
        assert result["resultType"] == "complete"
        assert result["_meta"]["io.modelcontextprotocol/serverInfo"]["name"] == "plane"

        result = mcp("tools/list").json()["result"]
        names = [t["name"] for t in result["tools"]]
        assert names == sorted(names, key=names.index)  # deterministic
        assert result["cacheScope"] == "public" and result["ttlMs"] > 0
        workitem = next(t for t in result["tools"] if t["name"] == "workitem")
        assert "create" in workitem["inputSchema"]["properties"]["action"]["enum"]
        assert workitem["annotations"]["destructiveHint"] is True

    @pytest.mark.django_db
    def test_header_validation(self, mcp):
        response = mcp("tools/list", headers={"HTTP_MCP_METHOD": "tools/call"})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == -32020

        response = mcp("tools/list", headers={"HTTP_MCP_PROTOCOL_VERSION": "2025-11-25"})
        assert response.json()["error"]["code"] == -32020

        response = mcp(
            "tools/call", {"name": "workspace", "arguments": {"action": "me"}}, headers={"HTTP_MCP_NAME": "project"}
        )
        assert response.json()["error"]["code"] == -32020

    @pytest.mark.django_db
    def test_unsupported_version(self, mcp):
        meta = {**META, "io.modelcontextprotocol/protocolVersion": "1900-01-01"}
        client_headers = {"HTTP_MCP_PROTOCOL_VERSION": "1900-01-01"}
        response = mcp(
            "tools/list", {"_meta": meta}, modern=False, headers={**client_headers, "HTTP_MCP_METHOD": "tools/list"}
        )
        assert response.status_code == 400
        error = response.json()["error"]
        assert error["code"] == -32022
        assert MODERN in error["data"]["supported"]

    @pytest.mark.django_db
    def test_unknown_method_and_get(self, mcp):
        response = mcp("resources/templates/list")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == -32601
        assert APIClient().get("/mcp/").status_code == 405

    @pytest.mark.django_db
    def test_requires_valid_key(self, mcp):
        response = mcp("tools/list", token=None)
        assert response.status_code == 401
        assert "Bearer" in response.headers["WWW-Authenticate"]
        assert mcp("tools/list", token="nope").status_code == 401

    @pytest.mark.django_db
    def test_rejects_foreign_origin(self, mcp):
        response = mcp("tools/list", headers={"HTTP_ORIGIN": "https://evil.example"})
        assert response.status_code == 403


@pytest.mark.contract
@pytest.mark.django_db
class TestMCPWorkspaceToken:
    @pytest.fixture
    def scoped_token(self, workspace, create_user):
        return APIToken.objects.create(user=create_user, workspace=workspace, label="mcp", token="mcp-scoped")

    def test_matching_workspace_can_initialize_and_read(self, mcp, scoped_token, project):
        response = mcp("initialize", {"protocolVersion": "2025-06-18"}, modern=False, token=scoped_token.token)
        assert response.status_code == 200
        response = mcp("tools/call", {"name": "project", "arguments": {"action": "list"}}, token=scoped_token.token)
        assert response.json()["result"]["isError"] is False

    def test_write_token_can_write_in_its_workspace(self, mcp, scoped_token, project):
        response = mcp(
            "tools/call",
            {"name": "workitem", "arguments": {"action": "create", "project": "WEB", "name": "Allowed"}},
            token=scoped_token.token,
        )
        assert response.status_code == 200
        assert response.json()["result"]["isError"] is False
        assert Issue.objects.filter(project=project, name="Allowed").exists()

    @pytest.mark.parametrize("slug", ["", "another-workspace"])
    def test_legacy_header_does_not_bind_token(self, mcp, scoped_token, slug):
        response = mcp("tools/list", token=scoped_token.token, headers={"HTTP_X_WORKSPACE_SLUG": slug})
        assert response.status_code == 200

    @pytest.mark.parametrize("role, active", [(15, True), (20, False)])
    def test_revoked_administrator_is_forbidden(self, mcp, scoped_token, workspace, create_user, role, active):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role, is_active=active)
        response = mcp("tools/list", token=scoped_token.token)
        assert response.status_code == 403
        assert "administrator" in response.json()["error"]["message"]

    def test_foreign_workspace_membership_does_not_expand_scope(self, mcp, scoped_token, create_user):
        other = Workspace.objects.create(name="Other", slug="other", owner=create_user)
        WorkspaceMember.objects.create(workspace=other, member=create_user, role=20)
        response = mcp(
            "tools/call",
            {"name": "project", "arguments": {"action": "list", "workspace_slug": other.slug}},
            token=scoped_token.token,
        )
        assert response.json()["result"]["isError"] is True
        assert "restricted" in response.json()["result"]["content"][0]["text"]
        response = mcp("tools/call", {"name": "workspace", "arguments": {"action": "list"}}, token=scoped_token.token)
        data = json.loads(response.json()["result"]["content"][0]["text"])
        assert other.slug not in [row["slug"] for row in data]
        assert len(data) == 1

    def test_read_only_scope_is_enforced_by_tool_method(self, mcp, scoped_token, project):
        scoped_token.scope = APIToken.SCOPE_READ
        scoped_token.save(update_fields=["scope"])
        response = mcp("tools/call", {"name": "project", "arguments": {"action": "list"}}, token=scoped_token.token)
        assert response.json()["result"]["isError"] is False
        response = mcp(
            "tools/call",
            {"name": "workitem", "arguments": {"action": "create", "project": "WEB", "name": "Forbidden"}},
            token=scoped_token.token,
        )
        assert response.json()["result"]["isError"] is True
        assert "read-only" in response.json()["result"]["content"][0]["text"]
        assert not Issue.objects.exists()


@pytest.mark.contract
class TestMCPTools:
    @pytest.mark.django_db
    def test_me_and_project_list(self, mcp, workspace, project):
        is_error, me = mcp.tool("workspace", action="me")
        assert not is_error and me["workspace"] == workspace.slug
        is_error, projects = mcp.tool("project", action="list")
        assert [p["identifier"] for p in projects["results"]] == ["WEB"]

    @pytest.mark.django_db
    def test_create_update_get_work_item_by_names(self, mcp, project, create_user):
        is_error, item = mcp.tool(
            "workitem",
            action="create",
            project="web",
            name="Fix login",
            description="Steps:\n\n1. open\n2. **fail**",
            state="Doing",
            assignees=["me"],
            labels=["bug"],
            priority="high",
        )
        assert not is_error, item
        issue = Issue.objects.get(pk=item["id"])
        assert issue.state.name == "Doing"
        assert list(issue.assignees.all()) == [create_user]
        assert issue.created_by == create_user
        assert "<strong>fail</strong>" in issue.description_html
        assert "**fail**" in item["description"]

        key = f"WEB-{issue.sequence_id}"
        is_error, item = mcp.tool("workitem", action="update", work_item=key, state="Todo")
        assert not is_error and item["state"]["name"] == "Todo"

        is_error, mine = mcp.tool("workitem", action="my_items", filters={"state_group__in": "unstarted"})
        assert [i["id"] for i in mine["results"]] == [str(issue.id)]

        is_error, comment = mcp.tool("workitem", action="add_comment", work_item=key, comment="Looks **good**")
        assert not is_error and "**good**" in comment["comment"]

    @pytest.mark.django_db
    def test_helpful_errors(self, mcp, project):
        is_error, text = mcp.tool("workitem", action="create", project="WEB", name="x", state="Nope")
        assert is_error and "Todo" in text and "Doing" in text

        is_error, text = mcp.tool("workitem", action="get", work_item="WEB-999")
        assert is_error and "WEB-999" in text

        is_error, text = mcp.tool("workitem", action="get", work_item="WEB-1", bogus=1)
        assert is_error and "bogus" in text

        is_error, text = mcp.tool("workitem", action="create", project="WEB")
        assert is_error and "name" in text

    @pytest.mark.django_db
    def test_read_only_key_cannot_write(self, mcp, project, create_user):
        token = APIToken.objects.create(user=create_user, label="ro", token="mcp-ro", scope=APIToken.SCOPE_READ)
        response = mcp(
            "tools/call",
            {"name": "workitem", "arguments": {"action": "create", "project": "WEB", "name": "x"}},
            token=token.token,
        )
        result = response.json()["result"]
        assert result["isError"] and "read-only" in result["content"][0]["text"]
        assert not Issue.objects.exists()

        response = mcp("tools/call", {"name": "project", "arguments": {"action": "list"}}, token=token.token)
        assert response.json()["result"]["isError"] is False

    @pytest.mark.django_db
    def test_page_markdown_round_trip_and_search(self, mcp, project):
        is_error, page = mcp.tool("page", action="create", project="WEB", name="Spec", content="# Goal\n\nShip it")
        assert not is_error, page
        assert "<h1>Goal</h1>" in Page.objects.get(pk=page["id"]).description_html

        is_error, page = mcp.tool("page", action="get", project="WEB", page=page["id"])
        assert page["description"].startswith("# Goal")

        is_error, results = mcp.tool("workspace", action="search", query="spec", entities="page")
        assert [p["name"] for p in results["page"]] == ["Spec"]


@pytest.mark.contract
class TestMCPProjectInsights:
    @pytest.mark.django_db
    def test_labels_identifier_default_state_and_cycle_progress(self, mcp, project, workspace, create_user):
        from datetime import date, timedelta

        from plane.db.models import Cycle

        is_error, result = mcp.tool("project", action="create_labels", project="WEB", names=["bug", "Docs"])
        assert not is_error and result["skipped"] == ["bug"]
        assert [label["name"] for label in result["created"]] == ["Docs"]

        is_error, result = mcp.tool("project", action="check_identifier", identifier="free")
        assert result == {"identifier": "FREE", "available": True}

        is_error, result = mcp.tool("project", action="set_default_state", project="WEB", state="Doing")
        assert not is_error and State.objects.get(project=project, name="Doing").default

        Cycle.objects.create(
            name="Sprint 1",
            project=project,
            workspace=workspace,
            owned_by=create_user,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
        )
        is_error, progress = mcp.tool("cycle", action="progress", project="WEB", cycle="sprint 1")
        assert not is_error and progress["total_issues"] == 0


@pytest.mark.contract
@pytest.mark.django_db
class TestMCPCrossWorkspace:
    @pytest.fixture
    def other(self, create_user):
        workspace = Workspace.objects.create(name="Other", slug="other", owner=create_user)
        WorkspaceMember.objects.create(workspace=workspace, member=create_user, role=20)
        project = Project.objects.create(
            name="Other web", identifier="WEB", workspace=workspace, created_by=create_user
        )
        ProjectMember.objects.create(project=project, member=create_user, role=20)
        State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace, default=True)
        return workspace, project

    def test_personal_token_reads_and_writes_both_workspaces(self, mcp, workspace, project, other):
        for target, expected_project in [(workspace, project), other]:
            error, projects = mcp.tool("project", action="list", workspace_slug=target.slug)
            assert not error and [p["id"] for p in projects["results"]] == [str(expected_project.id)]
            error, item = mcp.tool(
                "workitem", action="create", workspace_slug=target.slug, project="WEB", name=target.slug
            )
            assert not error, item
            assert Issue.objects.get(pk=item["id"]).workspace_id == target.id
            error, item = mcp.tool("workitem", action="get", workspace_slug=target.slug, work_item=item["id"])
            assert not error and item["name"] == target.slug

    @pytest.mark.parametrize("slug", [None, "", "   ", [], {}, True, 12])
    def test_invalid_explicit_workspace_never_uses_header_or_last(self, mcp, workspace, create_user, slug):
        from plane.db.models import Profile

        Profile.objects.update_or_create(user=create_user, defaults={"last_workspace_id": workspace.id})
        response = mcp("tools/call", {"name": "project", "arguments": {"action": "list", "workspace_slug": slug}})
        assert response.json()["result"]["isError"] is True
        assert "workspace_slug" in response.json()["result"]["content"][0]["text"]

    def test_missing_workspace_never_uses_header(self, mcp):
        response = mcp("tools/call", {"name": "project", "arguments": {"action": "list"}}, explicit_workspace=False)
        assert response.json()["result"]["isError"] is True
        assert "workspace_slug" in response.json()["result"]["content"][0]["text"]

    @pytest.mark.parametrize("active", [True, False])
    def test_membership_required_for_target(self, mcp, other, create_user, active):
        target, project = other
        memberships = WorkspaceMember.objects.filter(workspace=target, member=create_user)
        if active:
            memberships.delete()
        else:
            memberships.update(is_active=False)
        error, message = mcp.tool(
            "workitem", action="create", workspace_slug=target.slug, project="WEB", name="Forbidden"
        )
        assert error and "活跃成员" in message
        assert not Issue.objects.filter(project=project).exists()

    def test_project_membership_still_required(self, mcp, other, create_user):
        target, project = other
        ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)
        error, message = mcp.tool(
            "workitem", action="create", workspace_slug=target.slug, project="WEB", name="Forbidden"
        )
        assert error and "项目成员" in message
        assert not Issue.objects.filter(project=project).exists()

    def test_list_filters_memberships_and_ignores_stale_header(self, mcp, workspace, other, create_user):
        target, _ = other
        response = mcp(
            "tools/call",
            {"name": "workspace", "arguments": {"action": "list"}},
            headers={"HTTP_X_WORKSPACE_SLUG": "missing"},
        )
        result = response.json()["result"]
        assert not result["isError"]
        rows = json.loads(result["content"][0]["text"])
        assert {row["slug"] for row in rows} == {workspace.slug, target.slug}
        assert set(rows[0]) == {"id", "name", "slug", "role"}
        WorkspaceMember.objects.filter(workspace=target, member=create_user).update(is_active=False)
        error, rows = mcp.tool("workspace", action="list")
        assert not error and [row["slug"] for row in rows] == [workspace.slug]
        WorkspaceMember.objects.filter(member=create_user).delete()
        error, rows = mcp.tool("workspace", action="list")
        assert not error and rows == []

    def test_explicit_unauthorized_list_target_fails(self, mcp):
        error, message = mcp.tool("workspace", action="list", workspace_slug="missing")
        assert error and "活跃成员" in message

    def test_nonmember_workspace_is_not_listed(self, mcp, create_user):
        Workspace.objects.create(name="Private", slug="private", owner=create_user)
        error, rows = mcp.tool("workspace", action="list")
        assert not error and "private" not in [row["slug"] for row in rows]

    def test_scoped_token_without_header_lists_and_requires_target(self, mcp, workspace, create_user):
        token = APIToken.objects.create(user=create_user, workspace=workspace, label="Scope", token="scope-no-header")
        response = mcp(
            "tools/call",
            {"name": "workspace", "arguments": {"action": "list"}},
            token=token.token,
            headers={"HTTP_X_WORKSPACE_SLUG": ""},
            explicit_workspace=False,
        )
        assert response.json()["result"]["isError"] is False
        rows = json.loads(response.json()["result"]["content"][0]["text"])
        assert [row["slug"] for row in rows] == [workspace.slug]
        response = mcp(
            "tools/call",
            {"name": "project", "arguments": {"action": "list"}},
            token=token.token,
            explicit_workspace=False,
        )
        assert response.json()["result"]["isError"] is True
        assert "workspace_slug" in response.json()["result"]["content"][0]["text"]

    def test_scoped_me_keeps_root_api_scope_boundary(self, mcp, workspace, create_user):
        token = APIToken.objects.create(user=create_user, workspace=workspace, label="Scope", token="scope-me")
        response = mcp(
            "tools/call",
            {"name": "workspace", "arguments": {"action": "me", "workspace_slug": workspace.slug}},
            token=token.token,
        )
        result = response.json()["result"]
        assert result["isError"] is True
        assert "restricted" in result["content"][0]["text"]

    def test_cross_workspace_uuid_cannot_cross_target(self, mcp, workspace, project, other):
        target, other_project = other
        error, item = mcp.tool(
            "workitem", action="create", workspace_slug=target.slug, project="WEB", name="Private item"
        )
        assert not error
        error, message = mcp.tool("workitem", action="get", workspace_slug=workspace.slug, work_item=item["id"])
        assert error and "找不到工作项" in message
        error, message = mcp.tool(
            "workitem", action="list", workspace_slug=workspace.slug, project=str(other_project.id)
        )
        assert error and "找不到项目" in message

    def test_deleted_workspace_is_not_discoverable_or_accessible(self, mcp, other):
        from django.utils import timezone

        target, _ = other
        Workspace.objects.filter(pk=target.pk).update(deleted_at=timezone.now())
        error, rows = mcp.tool("workspace", action="list")
        assert not error and target.slug not in [row["slug"] for row in rows]
        error, message = mcp.tool("project", action="list", workspace_slug=target.slug)
        assert error and "活跃成员" in message
