"""Runner management contracts, trust boundaries and token-only broker validation."""

import hashlib
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from django.core import signing
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from plane.app.views.project import workflow_runner as views
from plane.db.models import Issue, Project, ProjectMember, State, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowTransition
from plane.db.models.workflow_runner import (
    WorkflowAction,
    WorkflowCredential,
    WorkflowExecution,
    WorkflowExecutionStep,
    WorkflowScript,
    WorkflowScriptVersion,
)
from plane.services.workflow_sdk import WorkflowSDKError
from plane.utils import workflow_runner as runner

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]

RPC_URL = "/api/internal/workflow-runner/rpc/"
SOURCE = "export default async function(ctx, sdk) { return { success: true }; }"


@pytest.fixture
def runner_ctx(workspace, create_user, settings):
    settings.WORKFLOW_CREDENTIAL_KEY_ID = "test"
    settings.WORKFLOW_CREDENTIAL_KEYS = {"test": "workflow-api-test-key"}
    project = Project.objects.create(workspace=workspace, name="Runner API", identifier="RUNAPI")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Todo", group="unstarted", default=True)
    issue = Issue.objects.create(project=project, state=state, name="Runner work item")
    return SimpleNamespace(
        project=project,
        workspace=workspace,
        user=create_user,
        issue=issue,
        state=state,
        base=f"/api/workspaces/{workspace.slug}/projects/{project.pk}/",
    )


def script_payload(**kwargs):
    return {"name": "Check", "source": SOURCE, "capabilities": [], "http_policy": {}, **kwargs}


def create_script(ctx, *, source=SOURCE):
    script = WorkflowScript.objects.create(project=ctx.project, name="Saved script")
    version = WorkflowScriptVersion.objects.create(
        project=ctx.project,
        script=script,
        version=1,
        source=source,
        source_hash=hashlib.sha256(source.encode()).hexdigest(),
        capabilities=[],
        http_policy={},
    )
    return script, version


def running_execution(ctx):
    execution = WorkflowExecution.objects.create(
        project=ctx.project,
        issue=ctx.issue,
        actor=ctx.user,
        phase="post",
        status="running",
        dry_run=True,
        lease_expires_at=timezone.now() + timedelta(minutes=1),
        policy_version=ctx.project.workflow_version,
        capabilities=["getWorkItem"],
    )
    step = WorkflowExecutionStep.objects.create(
        project=ctx.project,
        execution=execution,
        index=0,
        status="running",
        source=SOURCE,
        capabilities=["getWorkItem"],
    )
    return execution, step


def rpc(client, token, **kwargs):
    return client.post(
        RPC_URL,
        {"jsonrpc": "2.0", "id": 1, "method": "getWorkItem", "params": [], **kwargs},
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )


def test_scripts_publish_immutable_versions_and_metadata(session_client, runner_ctx):
    ctx = runner_ctx
    original_policy = ctx.project.workflow_version
    url = ctx.base + "workflow-scripts/"
    created = session_client.post(url, script_payload(description="Validation"), format="json")
    assert created.status_code == 201, created.data
    script_id = created.data["id"]
    assert len(created.data["versions"]) == 1
    assert created.data["versions"][0]["source"] == SOURCE
    version = WorkflowScriptVersion.objects.get(script_id=script_id)
    assert version.source_hash == hashlib.sha256(SOURCE.encode()).hexdigest()
    detail = f"{url}{script_id}/"
    response = session_client.patch(detail, {"name": "Renamed", "description": "Updated"}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["name"] == "Renamed"
    assert session_client.patch(detail, {"source": "changed"}, format="json").status_code == 400
    payload = {"source": SOURCE + "\n// new", "capabilities": ["getWorkItem"], "http_policy": {}}
    response = session_client.post(detail + "versions/", payload, format="json")
    assert response.status_code == 201, response.data
    assert response.data["version"] == 2
    version.refresh_from_db()
    assert version.source == SOURCE
    ctx.project.refresh_from_db()
    assert ctx.project.workflow_version == original_policy
    assert len(session_client.get(url).data) == 1
    assert [v["version"] for v in session_client.get(detail).data["versions"]] == [2, 1]
    assert session_client.delete(detail).status_code == 204
    assert not WorkflowScript.objects.filter(pk=script_id).exists()
    assert WorkflowScript.all_objects.get(pk=script_id).deleted_at is not None
    assert WorkflowScriptVersion.objects.filter(script_id=script_id).count() == 2
    assert session_client.get(detail).status_code == 404


def test_deleting_script_bound_to_live_rule_is_rejected(session_client, runner_ctx):
    ctx = runner_ctx
    script, version = create_script(ctx)
    destination = State.objects.create(project=ctx.project, name="Done", group="completed")
    workflow = ProjectWorkflow.objects.create(project=ctx.project)
    rule = WorkflowTransition.objects.create(
        project=ctx.project,
        workflow=workflow,
        source=ctx.state,
        destination=destination,
        steps=[{"phase": "post", "outcome": "transition", "script_version_id": str(version.pk)}],
    )
    url = ctx.base + f"workflow-scripts/{script.pk}/"
    response = session_client.delete(url)
    assert response.status_code == 400, response.data
    assert "WORKFLOW_SCRIPT_IN_USE" in str(response.data)
    assert WorkflowScript.objects.filter(pk=script.pk).exists()
    WorkflowTransition.objects.filter(pk=rule.pk).delete()
    assert session_client.delete(url).status_code == 204


@pytest.mark.parametrize(
    "patch",
    [
        {"name": 123},
        {"description": []},
        {"source": 123},
        {"source": ""},
        {"source": "你" * 22000},
        {"capabilities": "getWorkItem"},
        {"capabilities": [123]},
        {"capabilities": ["getWorkItem"] * 8},
        {"capabilities": ["arbitrary"]},
        {"http_policy": []},
        {"http_policy": {"origins": "https://example.com"}},
        {"http_policy": {"origins": [123]}},
        {"http_policy": {"credential_id": "not-a-uuid"}},
        {"http_policy": {"origins": ["http://example.com"]}},
        {"unknown": True},
    ],
)
def test_script_inputs_are_strict_and_bounded(session_client, runner_ctx, patch):
    response = session_client.post(runner_ctx.base + "workflow-scripts/", script_payload(**patch), format="json")
    assert response.status_code == 400, response.data
    assert not WorkflowScript.objects.filter(project=runner_ctx.project).exists()


@pytest.mark.parametrize("payload", [[], "script", None, 42])
def test_script_body_must_be_an_object(session_client, runner_ctx, payload):
    import json

    response = session_client.post(
        runner_ctx.base + "workflow-scripts/", json.dumps(payload), content_type="application/json"
    )
    assert response.status_code == 400, response.data


@pytest.mark.parametrize("path", ["workflow-scripts/", "workflow-executions/", "workflow-credentials/"])
def test_reads_and_writes_require_admin(session_client, runner_ctx, path):
    ctx = runner_ctx
    ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(role=15)
    WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(role=15)
    assert session_client.get(ctx.base + path).status_code == 403
    assert session_client.post(ctx.base + path, {}, format="json").status_code in (403, 405)
    response = session_client.post(
        ctx.base + "workflow-scripts/test/", {"source": SOURCE, "phase": "post"}, format="json"
    )
    assert response.status_code == 403
    assert not WorkflowExecution.objects.exists()


def test_object_routes_are_scoped_to_project(session_client, runner_ctx):
    ctx = runner_ctx
    script, _ = create_script(ctx)
    execution, _ = running_execution(ctx)
    credential = WorkflowCredential.objects.create(
        project=ctx.project, name="Private", origin="https://example.com", encrypted_secret="encrypted", key_id="test"
    )
    other = Project.objects.create(workspace=ctx.workspace, name="Other", identifier="RUNOTHER")
    ProjectMember.objects.create(project=other, member=ctx.user, role=20)
    base = ctx.base.replace(str(ctx.project.pk), str(other.pk))
    assert session_client.get(base + f"workflow-scripts/{script.pk}/").status_code == 404
    assert session_client.get(base + f"workflow-executions/{execution.pk}/").status_code == 404
    assert session_client.delete(base + f"workflow-credentials/{credential.pk}/").status_code == 404
    assert session_client.get(base + "workflow-executions/").data["count"] == 0


def test_draft_test_executes_runner_outside_transaction_and_cannot_impersonate(session_client, runner_ctx, monkeypatch):
    ctx = runner_ctx
    calls = []

    def runner_response(execution, step):
        assert not connection.in_atomic_block
        calls.append((execution, step))
        assert execution.actor_id == ctx.user.pk
        assert execution.dry_run is True
        assert execution.issue_id is None
        assert execution.context["actor"]["id"] == str(ctx.user.pk)
        assert execution.context["metadata"]["actor"]["id"] == "forged"
        assert execution.context["proposed"] == {"priority": "high"}
        assert execution.context["after"]["priority"] == "high"
        assert step.script_version_id is None
        assert step.source == SOURCE
        return {"success": True, "result": {"success": True}, "logs": [{"level": "info", "message": "Ran"}]}

    monkeypatch.setattr(runner, "_call_runner", runner_response)
    data = {
        "source": SOURCE,
        "phase": "pre",
        "capabilities": [],
        "http_policy": {},
        "context": {"metadata": {"actor": {"id": "forged"}, "custom": 1}, "proposed": {"priority": "high"}},
    }
    response = session_client.post(ctx.base + "workflow-scripts/test/", data, format="json")
    assert response.status_code == 200, response.data
    assert response.data["status"] == "succeeded"
    assert response.data["issue_id"] is None
    assert response.data["dry_run"] is True
    assert response.data["logs"] == [{"level": "info", "message": "Ran"}]
    assert len(calls) == 1
    execution = WorkflowExecution.objects.get(pk=response.data["id"])
    snapshot = {
        "source": SOURCE,
        "phase": "pre",
        "context": execution.context,
        "capabilities": [],
        "http_policy": {"origins": [], "methods": []},
    }
    assert execution.draft_hash == runner.digest(snapshot)
    assert not WorkflowScriptVersion.objects.exists()
    assert len(response.data["steps"]) == 1


def test_draft_test_issue_is_optional_and_must_belong_to_project(session_client, runner_ctx, monkeypatch):
    ctx = runner_ctx
    monkeypatch.setattr(runner, "_call_runner", lambda *_: {"success": True, "result": None, "logs": []})
    data = {"source": SOURCE, "phase": "post", "capabilities": [], "http_policy": {}, "issue_id": str(ctx.issue.pk)}
    response = session_client.post(ctx.base + "workflow-scripts/test/", data, format="json")
    assert response.status_code == 200, response.data
    assert response.data["issue_id"] == ctx.issue.pk
    data["issue_id"] = str(uuid4())
    assert session_client.post(ctx.base + "workflow-scripts/test/", data, format="json").status_code == 404
    data["issue_id"] = "invalid"
    assert session_client.post(ctx.base + "workflow-scripts/test/", data, format="json").status_code == 400
    data["issue_id"] = None
    data["dry_run"] = False
    assert session_client.post(ctx.base + "workflow-scripts/test/", data, format="json").status_code == 400
    del data["dry_run"]
    data["phase"] = "pre"
    data["capabilities"] = ["addComment"]
    assert session_client.post(ctx.base + "workflow-scripts/test/", data, format="json").status_code == 400


@pytest.mark.parametrize(
    "context",
    [
        {"actor": {"id": "forged"}},
        {"project_id": "forged"},
        {"flow": {}},
        {"outcome": "approve"},
        {"proposed": []},
        {"before": 1},
        {"after": "forged"},
        {"work_item": []},
        {"metadata": []},
    ],
)
def test_draft_context_cannot_override_authority_or_use_wrong_types(session_client, runner_ctx, context):
    data = {"source": SOURCE, "phase": "post", "capabilities": [], "http_policy": {}, "context": context}
    response = session_client.post(runner_ctx.base + "workflow-scripts/test/", data, format="json")
    assert response.status_code == 400, response.data
    assert not WorkflowExecution.objects.exists()


def test_draft_simulated_work_item_cannot_replace_bound_issue(session_client, runner_ctx, monkeypatch):
    ctx = runner_ctx
    monkeypatch.setattr(runner, "_call_runner", lambda *_: {"success": True, "result": None, "logs": []})
    data = {
        "source": SOURCE,
        "phase": "post",
        "capabilities": [],
        "http_policy": {},
        "issue_id": str(ctx.issue.pk),
        "context": {"work_item": {"id": "simulated"}, "proposed": {"priority": "high"}},
    }
    response = session_client.post(ctx.base + "workflow-scripts/test/", data, format="json")
    assert response.status_code == 200, response.data
    execution = WorkflowExecution.objects.get(pk=response.data["id"])
    assert execution.context["work_item"]["id"] == str(ctx.issue.pk)
    assert execution.context["after"]["priority"] == "high"
    data["issue_id"] = None
    response = session_client.post(ctx.base + "workflow-scripts/test/", data, format="json")
    assert response.status_code == 200, response.data
    execution = WorkflowExecution.objects.get(pk=response.data["id"])
    assert execution.issue_id is None
    assert execution.context["work_item"] == {"id": "simulated"}
    assert execution.actor_id == ctx.user.pk


def test_execution_pagination_detail_filter_and_retry(session_client, runner_ctx, monkeypatch):
    ctx = runner_ctx
    for _ in range(26):
        WorkflowExecution.objects.create(project=ctx.project, phase="post", dry_run=True)
    execution, step = running_execution(ctx)
    WorkflowExecution.objects.filter(pk=execution.pk).update(status="failed")
    WorkflowExecutionStep.objects.filter(pk=step.pk).update(status="failed")
    queue = Mock()
    from plane.bgtasks import workflow_runner_task

    monkeypatch.setattr(workflow_runner_task, "queue_workflow_execution", queue)
    url = ctx.base + "workflow-executions/"
    first = session_client.get(url)
    assert first.status_code == 200, first.data
    assert first.data["count"] == 27 and first.data["next_offset"] == 25
    assert len(first.data["results"]) == 25
    second = session_client.get(url, {"offset": 25})
    assert len(second.data["results"]) == 2 and second.data["next_offset"] is None
    assert session_client.get(url, {"offset": "bad"}).status_code == 400
    assert session_client.get(url, {"issue_id": "bad"}).status_code == 400
    assert session_client.get(url, {"issue_id": str(ctx.issue.pk)}).data["count"] == 1
    detail = session_client.get(url + f"{execution.pk}/")
    assert detail.data["can_retry"] is True
    retried = session_client.post(url + f"{execution.pk}/retry/", {}, format="json")
    assert retried.status_code == 200, retried.data
    assert retried.data["status"] == "queued" and retried.data["attempt"] == 2
    queue.assert_called_once_with(str(execution.pk))
    assert session_client.post(url + f"{execution.pk}/retry/", {}, format="json").status_code == 400


def test_execution_workflow_filter_uses_binding_and_snapshot_before_pagination(session_client, runner_ctx):
    ctx = runner_ctx
    workflow = ProjectWorkflow.objects.create(project=ctx.project)
    target = State.objects.create(project=ctx.project, name="Done", group="completed")
    rule = WorkflowTransition.objects.create(
        project=ctx.project, workflow=workflow, source=ctx.state, destination=target
    )
    bound = WorkflowExecution.objects.create(project=ctx.project, rule=rule, phase="post", dry_run=True)
    historical = WorkflowExecution.objects.create(
        project=ctx.project,
        phase="post",
        dry_run=True,
        context={"flow": {"workflow_id": str(workflow.pk)}},
    )
    for _ in range(26):
        WorkflowExecution.objects.create(project=ctx.project, phase="post", dry_run=True)
    url = ctx.base + "workflow-executions/"
    response = session_client.get(url, {"workflow_id": str(workflow.pk)})
    assert response.status_code == 200, response.data
    assert response.data["count"] == 2 and response.data["next_offset"] is None
    assert {row["id"] for row in response.data["results"]} == {bound.pk, historical.pk}
    assert session_client.get(url, {"workflow_id": str(uuid4())}).data["count"] == 0
    assert session_client.get(url, {"workflow_id": "invalid"}).status_code == 400
    assert session_client.get(url, {"workflow_id": str(workflow.pk), "issue_id": str(ctx.issue.pk)}).data["count"] == 0


@pytest.mark.parametrize("resolution", ["completed", "abandoned"])
def test_unknown_execution_can_be_manually_closed_without_retry(session_client, runner_ctx, resolution):
    ctx = runner_ctx
    execution, step = running_execution(ctx)
    WorkflowExecution.objects.filter(pk=execution.pk).update(status="unknown")
    WorkflowExecutionStep.objects.filter(pk=step.pk).update(status="interrupted")
    action = WorkflowAction.objects.create(
        project=ctx.project,
        execution=execution,
        step=step,
        index=1,
        method="http",
        params_hash="0" * 64,
        status="unknown",
        error={"code": "HTTP_OUTCOME_UNKNOWN"},
    )
    old_lease = execution.lease
    url = ctx.base + f"workflow-executions/{execution.pk}/"
    response = session_client.post(
        url + "resolve/", {"resolution": resolution, "note": "Verified remote result"}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["status"] == "cancelled"
    assert response.data["can_retry"] is False
    assert response.data["error"]["code"] == "WORKFLOW_EXECUTION_RESOLVED"
    assert response.data["error"]["resolution"] == resolution
    assert response.data["error"]["actor"] == str(ctx.user.pk)
    assert response.data["error"]["note"] == "Verified remote result"
    execution.refresh_from_db()
    assert execution.lease != old_lease
    assert execution.lease_expires_at is None
    action.refresh_from_db()
    assert action.status == ("completed" if resolution == "completed" else "failed")
    assert session_client.post(url + "retry/", {}, format="json").status_code == 400
    assert (
        session_client.post(url + "resolve/", {"resolution": resolution, "note": "Again"}, format="json").status_code
        == 400
    )


@pytest.mark.parametrize(
    "invalid",
    ["running_execution", "running_action", "running_step", "blank_note", "long_note", "wrong_type", "member"],
)
def test_execution_resolution_rejects_unsafe_requests(session_client, runner_ctx, invalid):
    ctx = runner_ctx
    execution, step = running_execution(ctx)
    WorkflowExecution.objects.filter(pk=execution.pk).update(status="unknown")
    WorkflowExecutionStep.objects.filter(pk=step.pk).update(status="interrupted")
    action = WorkflowAction.objects.create(
        project=ctx.project,
        execution=execution,
        step=step,
        index=1,
        method="http",
        params_hash="0" * 64,
        status="unknown",
    )
    data = {"resolution": "completed", "note": "Remote result verified"}
    if invalid == "running_execution":
        WorkflowExecution.objects.filter(pk=execution.pk).update(status="running")
    elif invalid == "running_action":
        WorkflowAction.objects.filter(pk=action.pk).update(status="running")
    elif invalid == "running_step":
        WorkflowExecutionStep.objects.filter(pk=step.pk).update(status="running")
    elif invalid == "blank_note":
        data["note"] = " "
    elif invalid == "long_note":
        data["note"] = "x" * 1001
    elif invalid == "wrong_type":
        data["note"] = 123
    else:
        ProjectMember.objects.filter(project=ctx.project, member=ctx.user).update(role=15)
        WorkspaceMember.objects.filter(workspace=ctx.workspace, member=ctx.user).update(role=15)
    response = session_client.post(ctx.base + f"workflow-executions/{execution.pk}/resolve/", data, format="json")
    assert response.status_code == (403 if invalid == "member" else 400), response.data
    action.refresh_from_db()
    assert action.status == ("running" if invalid == "running_action" else "unknown")


def test_credentials_only_return_safe_fields_and_encrypt(session_client, runner_ctx):
    ctx = runner_ctx
    url = ctx.base + "workflow-credentials/"
    data = {"name": "Service", "secret": "Bearer private-test-secret", "origin": "https://EXAMPLE.com/"}
    response = session_client.post(url, data, format="json")
    assert response.status_code == 201, response.data
    assert set(response.data) == {"id", "name", "origin", "header_name", "created_at"}
    assert response.data["origin"] == "https://example.com"
    credential = WorkflowCredential.objects.get(pk=response.data["id"])
    assert credential.encrypted_secret != data["secret"]
    assert runner.decrypt_credential(credential) == data["secret"]
    listed = session_client.get(url)
    assert data["secret"] not in str(listed.data)
    assert credential.encrypted_secret not in str(listed.data)
    assert "key_id" not in str(listed.data)
    assert session_client.delete(url + f"{credential.pk}/").status_code == 204
    assert not WorkflowCredential.objects.filter(pk=credential.pk).exists()
    assert WorkflowCredential.all_objects.get(pk=credential.pk).deleted_at is not None


@pytest.mark.parametrize(
    "patch",
    [
        {"secret": 123},
        {"secret": "bad\r\nheader"},
        {"header_name": "Host"},
        {"header_name": "Cookie"},
        {"header_name": "Proxy-Authorization"},
        {"header_name": "X-Forwarded-For"},
        {"header_name": "Invalid header"},
        {"origin": "https://user:password@example.com"},
        {"origin": "http://example.com"},
        {"origin": "https://example.com/path"},
        {"origin": "https://example.com\n"},
    ],
)
def test_credential_validation_is_safe(session_client, runner_ctx, patch):
    data = {"name": "Invalid", "secret": "private-test-secret", "origin": "https://example.com", **patch}
    response = session_client.post(runner_ctx.base + "workflow-credentials/", data, format="json")
    assert response.status_code == 400, response.data
    assert "private-test-secret" not in str(response.data)
    assert not WorkflowCredential.objects.exists()


def test_rpc_uses_token_without_session_and_returns_sdk_json(runner_ctx, monkeypatch):
    execution, step = running_execution(runner_ctx)
    sdk = Mock(return_value={"name": "Snapshot"})
    monkeypatch.setattr(views, "invoke_sdk", sdk)
    response = rpc(APIClient(enforce_csrf_checks=True), runner.broker_token(execution, step))
    assert response.status_code == 200
    assert response.data == {"jsonrpc": "2.0", "id": 1, "result": {"name": "Snapshot"}}
    assert sdk.call_args.args[0].pk == execution.pk
    assert sdk.call_args.args[1].pk == step.pk
    assert sdk.call_args.args[2:] == ("getWorkItem", [], 1)
    assert not connection.in_atomic_block


@pytest.mark.parametrize("request_id", [None, "1", True, False, 0, -1, 21, 999999999999999999999, 1.5])
def test_rpc_rejects_invalid_call_indexes(runner_ctx, monkeypatch, request_id):
    execution, step = running_execution(runner_ctx)
    sdk = Mock()
    monkeypatch.setattr(views, "invoke_sdk", sdk)
    response = rpc(APIClient(), runner.broker_token(execution, step), id=request_id)
    assert response.data["error"]["code"] == -32000
    sdk.assert_not_called()


@pytest.mark.parametrize(
    "invalid",
    [
        "session_only",
        "bad_signature",
        "expired",
        "wrong_lease",
        "wrong_step_lease",
        "expired_lease",
        "step_stopped",
        "execution_stopped",
        "wrong_step",
    ],
)
def test_rpc_rejects_invalid_or_stale_tokens(session_client, runner_ctx, monkeypatch, invalid):
    execution, step = running_execution(runner_ctx)
    sdk = Mock()
    monkeypatch.setattr(views, "invoke_sdk", sdk)
    token = runner.broker_token(execution, step)
    if invalid == "session_only":
        token = ""
    elif invalid == "bad_signature":
        token += "tampered"
    elif invalid == "expired":
        clock = timezone.now().timestamp()
        monkeypatch.setattr(signing.time, "time", lambda: clock + 121)
    elif invalid == "wrong_lease":
        WorkflowExecution.objects.filter(pk=execution.pk).update(lease=uuid4())
    elif invalid == "wrong_step_lease":
        WorkflowExecutionStep.objects.filter(pk=step.pk).update(lease=uuid4())
    elif invalid == "expired_lease":
        WorkflowExecution.objects.filter(pk=execution.pk).update(lease_expires_at=timezone.now() - timedelta(seconds=1))
    elif invalid == "step_stopped":
        WorkflowExecutionStep.objects.filter(pk=step.pk).update(status="succeeded")
    elif invalid == "execution_stopped":
        WorkflowExecution.objects.filter(pk=execution.pk).update(status="failed")
    elif invalid == "wrong_step":
        payload = signing.loads(token, salt=runner.TOKEN_SALT)
        payload["step"] = str(uuid4())
        token = signing.dumps(payload, salt=runner.TOKEN_SALT)
    response = rpc(session_client, token)
    assert "error" in response.data
    assert token not in str(response.data) if token else True
    sdk.assert_not_called()


def test_rpc_sequence_and_error_redaction(runner_ctx, monkeypatch):
    execution, step = running_execution(runner_ctx)
    client = APIClient()
    token = runner.broker_token(execution, step)
    sdk = Mock()
    monkeypatch.setattr(views, "invoke_sdk", sdk)
    skipped = rpc(client, token, id=2)
    assert skipped.data["error"]["data"]["code"] == "INVALID_CALL_INDEX"
    sdk.assert_not_called()
    WorkflowAction.objects.create(
        project=runner_ctx.project,
        execution=execution,
        step=step,
        index=1,
        method="getWorkItem",
        params_hash="0" * 64,
        status="completed",
    )
    sdk.side_effect = WorkflowSDKError("CAPABILITY_DENIED", message="private secret should never be reflected")
    denied = rpc(client, token, id=2)
    assert denied.data["error"]["data"] == {"code": "CAPABILITY_DENIED"}
    assert "private secret" not in str(denied.data)
    sdk.side_effect = RuntimeError("postgresql://private-password@host")
    failed = rpc(client, token)
    assert failed.data["error"]["data"] == {"code": "SDK_REQUEST_FAILED"}
    assert "private-password" not in str(failed.data)
    malformed = client.post(RPC_URL, "{", content_type="application/json")
    assert malformed.data["error"]["code"] == -32000


@pytest.mark.parametrize(
    "patch",
    [
        {"jsonrpc": "1.0"},
        {"method": "unknown"},
        {"params": {}},
        {"params": ["x" * 65537]},
        {"actor_id": "forged"},
    ],
)
def test_rpc_rejects_malformed_envelopes(runner_ctx, monkeypatch, patch):
    execution, step = running_execution(runner_ctx)
    sdk = Mock()
    monkeypatch.setattr(views, "invoke_sdk", sdk)
    response = rpc(APIClient(), runner.broker_token(execution, step), **patch)
    assert response.data["error"]["code"] == -32000
    sdk.assert_not_called()
