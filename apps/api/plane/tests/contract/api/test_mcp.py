# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from plane.db.models import APIToken, Issue, Label, Page, Project, ProjectMember, State

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

    def call(method, params=None, *, modern=True, headers=None, request_id=1, token=api_token.token):
        params = dict(params or {})
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
