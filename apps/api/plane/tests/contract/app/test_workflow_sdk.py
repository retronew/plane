"""Runner SDK contracts against real rows, transactions and public workflow policy."""

import base64
import json
import time
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
import requests
from django.db import connection, transaction
from django.utils import timezone

from plane.db.models import (
    Issue,
    IssueComment,
    IssueLabel,
    IssueType,
    Label,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)
from plane.db.models.workflow import ProjectWorkflow, WorkflowTransition
from plane.db.models.workflow_runner import (
    WorkflowAction,
    WorkflowCredential,
    WorkflowExecution,
    WorkflowExecutionStep,
    WorkflowScript,
    WorkflowScriptVersion,
)
from plane.services import workflow_http_transport as transport
from plane.services import workflow_sdk as sdk

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]


@pytest.fixture
def sdk_ctx(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="SDK", identifier="SDK")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    todo = State.objects.create(project=project, name="Todo", group="unstarted")
    issue = Issue.objects.create(project=project, state=state, name="SDK issue")
    script = WorkflowScript.objects.create(project=project, name="SDK script")
    policy = {"origins": ["https://example.com"], "methods": ["GET", "POST"]}
    version = WorkflowScriptVersion.objects.create(
        project=project,
        script=script,
        version=1,
        source="return null",
        source_hash="a" * 64,
        capabilities=sorted(sdk.METHODS),
        http_policy=policy,
    )
    execution = WorkflowExecution.objects.create(
        project=project,
        issue=issue,
        actor=create_user,
        phase="post",
        status="running",
        capabilities=version.capabilities,
        http_policy=policy,
        policy_version=project.workflow_version,
        lease_expires_at=timezone.now() + timedelta(minutes=2),
    )
    step = WorkflowExecutionStep.objects.create(
        project=project,
        execution=execution,
        script_version=version,
        index=0,
        status="running",
        capabilities=version.capabilities,
        http_policy=policy,
    )
    return SimpleNamespace(
        project=project,
        workspace=workspace,
        actor=create_user,
        issue=issue,
        state=state,
        todo=todo,
        script=script,
        version=version,
        execution=execution,
        step=step,
        policy=policy,
    )


def call(ctx, method, params, index=1):
    return sdk.invoke_sdk(ctx.execution, ctx.step, method, params, index)


def assert_rejected(ctx, method, params, code, index=1):
    with pytest.raises(sdk.WorkflowSDKError) as exc:
        call(ctx, method, params, index)
    assert exc.value.sdk_code == code


def test_read_records_full_dependency_hash_and_replays_same_call(sdk_ctx):
    from plane.utils.workflow_runner import digest, issue_snapshot

    ctx = sdk_ctx
    result = call(ctx, "getWorkItem", [])
    assert result["id"] == str(ctx.issue.pk)
    ctx.execution.refresh_from_db()
    assert ctx.execution.read_dependencies == {str(ctx.issue.pk): digest(issue_snapshot(ctx.issue))}
    assert call(ctx, "getWorkItem", []) == result
    assert WorkflowAction.objects.count() == 1
    assert_rejected(ctx, "getWorkItem", [str(ctx.issue.pk)], "IDEMPOTENCY_CONFLICT")


def test_pre_cannot_mix_two_versions_of_the_same_read_dependency(sdk_ctx):
    ctx = sdk_ctx
    WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(phase="pre")
    call(ctx, "getWorkItem", [])
    ctx.execution.refresh_from_db()
    first_dependencies = dict(ctx.execution.read_dependencies)
    Issue.objects.filter(pk=ctx.issue.pk).update(name="Changed during script")
    assert_rejected(ctx, "getWorkItem", [], "CONTEXT_STALE", 2)
    ctx.execution.refresh_from_db()
    assert ctx.execution.read_dependencies == first_dependencies
    assert WorkflowAction.objects.get(index=2).status == "failed"


def test_post_can_read_current_snapshot_after_an_earlier_read(sdk_ctx):
    ctx = sdk_ctx
    call(ctx, "getWorkItem", [])
    Issue.objects.filter(pk=ctx.issue.pk).update(name="Current post value")
    assert call(ctx, "getWorkItem", [], 2)["name"] == "Current post value"


@pytest.mark.parametrize("source", ["execution", "step", "version"])
def test_capabilities_are_an_intersection(sdk_ctx, source):
    ctx = sdk_ctx
    model = {"execution": WorkflowExecution, "step": WorkflowExecutionStep, "version": WorkflowScriptVersion}[source]
    instance = {"execution": ctx.execution, "step": ctx.step, "version": ctx.version}[source]
    model.objects.filter(pk=instance.pk).update(capabilities=["getWorkItem"])
    assert_rejected(ctx, "addComment", [str(ctx.issue.pk), "denied"], "CAPABILITY_DENIED")
    assert not IssueComment.objects.exists()


@pytest.mark.parametrize("membership", [ProjectMember, WorkspaceMember])
@pytest.mark.parametrize("change", [{"role": 5}, {"is_active": False}])
def test_current_membership_is_required_even_if_execution_was_authorized(sdk_ctx, membership, change):
    ctx = sdk_ctx
    membership.objects.filter(member=ctx.actor).update(**change)
    assert_rejected(ctx, "getWorkItem", [], "ACTOR_DENIED")


@pytest.mark.parametrize(
    "change",
    [
        {"status": "completed"},
        {"lease": uuid4()},
        {"depth": 6},
        {"lease_expires_at": timezone.now() - timedelta(seconds=1)},
    ],
)
def test_stale_or_invalid_execution_is_rejected(sdk_ctx, change):
    ctx = sdk_ctx
    WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(**change)
    assert_rejected(ctx, "getWorkItem", [], "EXECUTION_INVALID")


def test_step_lease_and_project_policy_are_rechecked(sdk_ctx):
    ctx = sdk_ctx
    WorkflowExecutionStep.objects.filter(pk=ctx.step.pk).update(lease=uuid4())
    assert_rejected(ctx, "getWorkItem", [], "EXECUTION_INVALID")
    ctx.step.refresh_from_db()
    Project.objects.filter(pk=ctx.project.pk).update(workflow_version=1)
    assert_rejected(ctx, "getWorkItem", [], "EXECUTION_INVALID")


def test_pre_only_reads_and_system_actor_cannot_write_or_enumerate(sdk_ctx):
    ctx = sdk_ctx
    WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(phase="pre")
    assert_rejected(ctx, "addComment", [str(ctx.issue.pk), "no"], "PHASE_DENIED")
    assert call(ctx, "getWorkItem", [])["id"] == str(ctx.issue.pk)
    WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(phase="post", actor=None)
    other = Issue.objects.create(project=ctx.project, state=ctx.state, name="Other")
    assert_rejected(ctx, "getWorkItem", [str(other.pk)], "ACTOR_DENIED", index=2)
    assert_rejected(ctx, "addComment", [str(ctx.issue.pk), "no"], "ACTOR_DENIED", index=2)


@pytest.mark.parametrize("kind", ["foreign", "archived_issue", "archived_project", "deleted_script"])
def test_project_archive_and_script_boundaries(sdk_ctx, kind):
    ctx = sdk_ctx
    params = []
    code = "ISSUE_UNAVAILABLE"
    if kind == "foreign":
        other = Project.objects.create(workspace=ctx.workspace, name="Other", identifier="OTH")
        foreign = Issue.objects.create(project=other, name="Foreign")
        params = [str(foreign.pk)]
    elif kind == "archived_issue":
        Issue.objects.filter(pk=ctx.issue.pk).update(archived_at=timezone.now().date())
    elif kind == "archived_project":
        Project.objects.filter(pk=ctx.project.pk).update(archived_at=timezone.now())
        code = "EXECUTION_INVALID"
    else:
        ctx.script.delete()
        code = "POLICY_STALE"
    assert_rejected(ctx, "getWorkItem", params, code)


def test_comment_escapes_plain_text_and_does_not_trust_actor(sdk_ctx):
    ctx = sdk_ctx
    body = '<img src=x onerror="alert(1)">\n& hello'
    result = call(ctx, "addComment", [str(ctx.issue.pk), body])
    comment = IssueComment.objects.get(pk=result["id"])
    assert comment.actor_id == ctx.actor.pk
    assert comment.created_by_id == ctx.actor.pk
    assert "<img" not in comment.comment_html
    assert "&lt;img" in comment.comment_html and "<br>" in comment.comment_html
    assert call(ctx, "addComment", [str(ctx.issue.pk), body]) == result
    assert IssueComment.objects.count() == 1
    assert_rejected(ctx, "createWorkItem", [{"name": "Spoof", "created_by": str(uuid4())}], "UNSUPPORTED_FIELDS", 2)


def test_labels_validate_all_ids_and_are_idempotent(sdk_ctx):
    ctx = sdk_ctx
    label = Label.objects.create(project=ctx.project, workspace=ctx.workspace, name="SDK label")
    call(ctx, "addLabels", [str(ctx.issue.pk), [str(label.pk), str(label.pk)]])
    assert IssueLabel.objects.filter(issue=ctx.issue).count() == 1
    assert_rejected(ctx, "addLabels", [str(ctx.issue.pk), [str(label.pk), str(uuid4())]], "LABEL_UNAVAILABLE", 2)
    assert IssueLabel.objects.filter(issue=ctx.issue).count() == 1
    call(ctx, "removeLabels", [str(ctx.issue.pk), [str(label.pk)]], 3)
    assert not IssueLabel.objects.filter(issue=ctx.issue).exists()


def test_internal_side_effect_and_ledger_roll_back_together(sdk_ctx, monkeypatch):
    ctx = sdk_ctx
    original = sdk.WorkflowAction.save

    def fail_completion(action, *args, **kwargs):
        if action.status == "completed":
            raise RuntimeError("ledger storage failed")
        return original(action, *args, **kwargs)

    monkeypatch.setattr(sdk.WorkflowAction, "save", fail_completion)
    with pytest.raises(RuntimeError):
        call(ctx, "addComment", [str(ctx.issue.pk), "rolled back"])
    assert not IssueComment.objects.exists()
    assert not WorkflowAction.objects.exists()


def test_failure_requires_explicit_retry_and_preserves_history(sdk_ctx):
    ctx = sdk_ctx
    missing = uuid4()
    params = [str(ctx.issue.pk), [str(missing)]]
    assert_rejected(ctx, "addLabels", params, "LABEL_UNAVAILABLE")
    action = WorkflowAction.objects.get()
    assert action.status == "failed" and action.error["attempt"] == 1
    Label.objects.create(id=missing, project=ctx.project, workspace=ctx.workspace, name="Now valid")
    assert_rejected(ctx, "addLabels", params, "LABEL_UNAVAILABLE")
    WorkflowExecutionStep.objects.filter(pk=ctx.step.pk).update(attempt=2, lease=uuid4())
    ctx.step.refresh_from_db()
    result = call(ctx, "addLabels", params)
    action.refresh_from_db()
    assert action.status == "completed"
    assert action.error["attempts"] == [{"attempt": 1, "code": "LABEL_UNAVAILABLE"}]
    assert result["label_ids"] == [str(missing)]
    assert WorkflowAction.objects.count() == 1


def test_actions_have_contiguous_indices_and_execution_wide_limit(sdk_ctx):
    ctx = sdk_ctx
    assert_rejected(ctx, "getWorkItem", [], "CALL_INDEX_INVALID", 2)
    for index in range(1, 21):
        call(ctx, "getWorkItem", [], index)
    next_step = WorkflowExecutionStep.objects.create(
        project=ctx.project,
        execution=ctx.execution,
        script_version=ctx.version,
        index=1,
        status="running",
        capabilities=ctx.version.capabilities,
        http_policy=ctx.policy,
    )
    with pytest.raises(sdk.WorkflowSDKError) as exc:
        sdk.invoke_sdk(ctx.execution, next_step, "getWorkItem", [], 1)
    assert exc.value.sdk_code == "ACTION_LIMIT"


@pytest.mark.parametrize("enabled", [False, True])
def test_sdk_creation_flag_blocks_creation_but_allows_moves(sdk_ctx, enabled):
    ctx = sdk_ctx
    Project.objects.filter(pk=ctx.project.pk).update(workflow_enabled=enabled)
    workflow = ProjectWorkflow.objects.create(project=ctx.project, enabled=True, initial_state=ctx.todo)
    State.objects.filter(pk=ctx.state.pk).update(allow_new_work_items=False, default=False)
    State.objects.filter(pk=ctx.todo.pk).update(default=True)
    assert_rejected(
        ctx, "createWorkItem", [{"name": "Flag blocked", "state_id": str(ctx.state.pk)}],
        "WORKFLOW_VALIDATION_FAILED"
    )
    assert not Issue.objects.filter(project=ctx.project, name="Flag blocked").exists()
    result = call(ctx, "createWorkItem", [{"name": "Flag default"}], 2)
    created = Issue.objects.get(pk=result["id"])
    assert created.state_id == ctx.todo.pk
    WorkflowTransition.objects.create(project=ctx.project, workflow=workflow, source=ctx.todo, destination=ctx.state)
    call(ctx, "updateWorkItem", [str(created.pk), {"state_id": str(ctx.state.pk)}], 3)
    created.refresh_from_db()
    assert created.state_id == ctx.state.pk


def test_create_and_update_use_public_workflow_rules(sdk_ctx):
    ctx = sdk_ctx
    workflow = ProjectWorkflow.objects.create(project=ctx.project, enabled=True, initial_state=ctx.todo)
    workflow.restricted_creation_states.add(ctx.state)
    result = call(ctx, "createWorkItem", [{"name": "Created"}])
    created = Issue.objects.get(pk=result["id"])
    assert created.state_id == ctx.todo.pk
    assert created.created_by_id == ctx.actor.pk
    assert_rejected(
        ctx, "createWorkItem", [{"name": "Blocked", "state_id": str(ctx.state.pk)}], "WORKFLOW_VALIDATION_FAILED", 2
    )
    assert not Issue.objects.filter(name="Blocked").exists()
    WorkflowTransition.objects.create(
        project=ctx.project,
        workflow=workflow,
        source=ctx.todo,
        destination=ctx.state,
        kind="approval",
    )
    assert_rejected(
        ctx, "updateWorkItem", [str(created.pk), {"state_id": str(ctx.state.pk)}], "WORKFLOW_VALIDATION_FAILED", 3
    )
    created.refresh_from_db()
    assert created.state_id == ctx.todo.pk


def test_update_state_type_mapping_and_dates_are_validated(sdk_ctx):
    ctx = sdk_ctx
    workflow = ProjectWorkflow.objects.create(project=ctx.project, enabled=True)
    rule = WorkflowTransition.objects.create(
        project=ctx.project,
        workflow=workflow,
        source=ctx.state,
        destination=ctx.todo,
    )
    other = User.objects.create(email="sdk-other@example.invalid", username="sdk-other")
    rule.members.add(other)
    assert_rejected(
        ctx, "updateWorkItem", [str(ctx.issue.pk), {"state_id": str(ctx.todo.pk)}], "WORKFLOW_VALIDATION_FAILED"
    )
    rule.members.add(ctx.actor)
    result = call(ctx, "updateWorkItem", [str(ctx.issue.pk), {"state_id": str(ctx.todo.pk), "priority": "high"}], 2)
    assert result["state_id"] == str(ctx.todo.pk) and result["priority"] == "high"
    kind = IssueType.objects.create(workspace=ctx.workspace, name="Task")
    assert_rejected(
        ctx, "updateWorkItem", [str(ctx.issue.pk), {"type_id": str(kind.pk)}], "WORKFLOW_VALIDATION_FAILED", 3
    )
    ProjectIssueType.objects.create(project=ctx.project, issue_type=kind, workflow=workflow)
    result = call(ctx, "updateWorkItem", [str(ctx.issue.pk), {"type_id": str(kind.pk), "target_date": "2026-11-01"}], 4)
    assert result["type_id"] == str(kind.pk)
    assert_rejected(ctx, "updateWorkItem", [str(ctx.issue.pk), {"start_date": "2026-11-02"}], "INVALID_DATES", 5)
    assert_rejected(ctx, "updateWorkItem", [str(ctx.issue.pk), {"actor": str(other.pk)}], "UNSUPPORTED_FIELDS", 6)


def test_prepare_is_outside_locks_and_dry_run_validates_without_writes(sdk_ctx, monkeypatch):
    ctx = sdk_ctx
    WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(dry_run=True)
    original = sdk.prepare_workflow_write
    contexts = []

    def prepare(*args, **kwargs):
        assert not connection.in_atomic_block
        contexts.append(kwargs["context"])
        return original(*args, **kwargs)

    monkeypatch.setattr(sdk, "prepare_workflow_write", prepare)
    finish = Mock()
    monkeypatch.setattr(sdk, "finish_workflow_write", finish)
    plan = call(ctx, "createWorkItem", [{"name": "Dry item"}])
    assert plan["dry_run"] and not Issue.objects.filter(name="Dry item").exists()
    plan = call(ctx, "updateWorkItem", [str(ctx.issue.pk), {"name": "Dry rename"}], 2)
    assert plan["dry_run"]
    ctx.issue.refresh_from_db()
    assert ctx.issue.name == "SDK issue"
    assert contexts == [{"runner_depth": 1, "runner_dry_run": True}] * 2
    finish.assert_not_called()
    call(ctx, "addComment", [str(ctx.issue.pk), "dry comment"], 3)
    assert not IssueComment.objects.exists()


def response(body=b'{"ok":true}', status=200):
    result = Mock(status_code=status)
    result.iter_content.return_value = [body]
    return result


def test_http_commits_running_before_one_transport_request_and_replays(sdk_ctx, monkeypatch):
    ctx = sdk_ctx

    def fetch(request):
        assert not connection.in_atomic_block
        assert WorkflowAction.objects.get().status == "running"
        assert request["method"] == "POST" and request["url"] == "https://example.com/event?key=query-secret"
        return 200, b'{"ok":true,"token":"do-not-leak"}'

    fetch_mock = Mock(side_effect=fetch)
    monkeypatch.setattr(sdk, "bounded_http", fetch_mock)
    params = [{"url": "https://example.com/event?key=query-secret", "method": "POST", "body": {"event": "hello"}}]
    result = call(ctx, "http", params)
    assert set(result) == {"status", "body"}
    assert result["status"] == 200 and "do-not-leak" not in result["body"]
    assert call(ctx, "http", params) == result
    fetch_mock.assert_called_once()


@pytest.mark.parametrize("revocation", ["member", "lease", "phase", "dry_run", "policy"])
def test_http_rechecks_authority_after_running_commit_before_network(sdk_ctx, monkeypatch, revocation):
    ctx = sdk_ctx
    original = sdk._lock_context
    invocations = []

    def lock_context(*args, **kwargs):
        invocations.append(True)
        if len(invocations) == 2:
            assert WorkflowAction.objects.get().status == "running"
            if revocation == "member":
                ProjectMember.objects.filter(project=ctx.project, member=ctx.actor).update(is_active=False)
            elif revocation == "lease":
                WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(lease=uuid4())
            elif revocation == "phase":
                WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(phase="pre")
            elif revocation == "dry_run":
                WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(dry_run=True)
            else:
                Project.objects.filter(pk=ctx.project.pk).update(workflow_version=1)
        return original(*args, **kwargs)

    monkeypatch.setattr(sdk, "_lock_context", lock_context)
    fetch = Mock()
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    assert_rejected(ctx, "http", [{"url": "https://example.com/", "method": "POST"}], "HTTP_OUTCOME_UNKNOWN")
    fetch.assert_not_called()
    assert WorkflowAction.objects.get().status == "unknown"


def test_http_unknown_is_never_retried_and_does_not_persist_transport_secrets(sdk_ctx, monkeypatch):
    ctx = sdk_ctx
    fetch = Mock(side_effect=requests.Timeout("https://example.com/?token=secret Authorization: secret"))
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    params = [{"url": "https://example.com/", "method": "POST"}]
    assert_rejected(ctx, "http", params, "HTTP_OUTCOME_UNKNOWN")
    action = WorkflowAction.objects.get()
    assert action.status == "unknown" and action.error == {"code": "HTTP_OUTCOME_UNKNOWN"}
    WorkflowExecutionStep.objects.filter(pk=ctx.step.pk).update(attempt=2, lease=uuid4())
    ctx.step.refresh_from_db()
    assert_rejected(ctx, "http", params, "HTTP_OUTCOME_UNKNOWN")
    fetch.assert_called_once()


@pytest.mark.parametrize(
    "http_request",
    [
        {"url": "http://example.com/", "method": "GET"},
        {"url": "https://user:pass@example.com/", "method": "GET"},
        {"url": "https://example.com/#fragment", "method": "GET"},
        {"url": "https://example.net/", "method": "GET"},
        {"url": "https://example.com/", "method": "DELETE"},
    ],
)
def test_http_exact_origin_method_and_url_policy(sdk_ctx, monkeypatch, http_request):
    fetch = Mock()
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    assert_rejected(sdk_ctx, "http", [http_request], "HTTP_POLICY_DENIED")
    fetch.assert_not_called()


@pytest.mark.parametrize(
    "header",
    [
        "Authorization",
        "Cookie",
        "Proxy-Authorization",
        "Host",
        "Connection",
        "X-Forwarded-Host",
        "Content-Length",
        "X-Api-Key",
    ],
)
def test_http_rejects_caller_auth_and_routing_headers(sdk_ctx, monkeypatch, header):
    fetch = Mock()
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    assert_rejected(
        sdk_ctx,
        "http",
        [{"url": "https://example.com", "method": "GET", "headers": {header: "x"}}],
        "HTTP_HEADERS_DENIED",
    )
    fetch.assert_not_called()


def test_http_credential_is_injected_on_server_and_body_is_redacted(sdk_ctx, monkeypatch):
    from plane.utils import workflow_runner

    ctx = sdk_ctx
    credential = WorkflowCredential.objects.create(
        project=ctx.project,
        name="API",
        origin="https://example.com",
        header_name="Authorization",
        encrypted_secret="ciphertext",
        key_id="key",
    )
    policy = {**ctx.policy, "credential_id": str(credential.pk)}
    WorkflowScriptVersion.objects.filter(pk=ctx.version.pk).update(http_policy=policy)
    WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(http_policy=policy)
    WorkflowExecutionStep.objects.filter(pk=ctx.step.pk).update(http_policy=policy)
    monkeypatch.setattr(workflow_runner, "decrypt_credential", Mock(return_value="Bearer server-secret"))
    fetch = Mock(
        return_value=(
            200,
            b'{"message":"Bearer server-secret query-secret","echo":"server-secret","password":"hidden"}',
        )
    )
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    result = call(ctx, "http", [{"url": "https://example.com/?key=query-secret", "method": "GET"}])
    assert fetch.call_args.args[0]["headers"] == {"Authorization": "Bearer server-secret"}
    assert all(secret not in result["body"] for secret in ("server-secret", "query-secret", "hidden"))
    credential.delete()
    assert_rejected(ctx, "http", [{"url": "https://example.com/", "method": "GET"}], "CREDENTIAL_DENIED", 2)
    fetch.assert_called_once()


def test_http_checks_live_version_policy_and_dry_run_dns_without_outbound(sdk_ctx, monkeypatch):
    ctx = sdk_ctx
    WorkflowExecution.objects.filter(pk=ctx.execution.pk).update(dry_run=True)
    fetch = Mock(return_value=None)
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    plan = call(ctx, "http", [{"url": "https://example.com/?secret=hidden", "method": "GET"}])
    assert plan == {"dry_run": True, "method": "http", "plan": {"origin": "https://example.com", "method": "GET"}}
    fetch.assert_called_once()
    assert fetch.call_args.kwargs == {"validate_only": True}
    WorkflowExecutionStep.objects.filter(pk=ctx.step.pk).update(http_policy={"origins": [], "methods": []})
    assert_rejected(ctx, "http", [{"url": "https://example.com/", "method": "GET"}], "HTTP_POLICY_DENIED", 2)
    fetch.assert_called_once()


def test_http_safe_body_is_truncated_after_transport_returns(sdk_ctx, monkeypatch):
    fetch = Mock(return_value=(200, b"a" * (64 * 1024)))
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    result = call(sdk_ctx, "http", [{"url": "https://example.com", "method": "GET"}])
    assert len(result["body"]) <= 8192


def test_http_hard_transport_timeout_records_unknown_and_never_retries(sdk_ctx, monkeypatch):
    fetch = Mock(side_effect=sdk.WorkflowHTTPTransportError())
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    params = [{"url": "https://example.com/slow", "method": "POST"}]
    assert_rejected(sdk_ctx, "http", params, "HTTP_OUTCOME_UNKNOWN")
    assert WorkflowAction.objects.get().status == "unknown"
    assert_rejected(sdk_ctx, "http", params, "HTTP_OUTCOME_UNKNOWN")
    fetch.assert_called_once()


@pytest.fixture
def fake_transport(monkeypatch):
    receive, send = Mock(), Mock()
    process = Mock()
    process.is_alive.return_value = False
    context = Mock()
    context.Pipe.return_value = (receive, send)
    context.Process.return_value = process
    get_context = Mock(return_value=context)
    monkeypatch.setattr(transport.multiprocessing, "get_context", get_context)
    monkeypatch.setattr(transport.time, "monotonic", lambda: 0.0)
    receive.poll.return_value = True
    return SimpleNamespace(receive=receive, send=send, process=process, context=context, get_context=get_context)


def transport_request():
    return {"url": "https://example.com/", "method": "POST", "headers": {}, "body": {"hello": "world"}}


def test_transport_refuses_daemon_worker_before_spawning(monkeypatch):
    monkeypatch.setattr(transport.multiprocessing, "current_process", lambda: SimpleNamespace(daemon=True))
    spawn = Mock()
    monkeypatch.setattr(transport.multiprocessing, "get_context", spawn)
    with pytest.raises(transport.WorkflowHTTPTransportError):
        transport.bounded_http(transport_request())
    spawn.assert_not_called()


def test_transport_uses_spawn_json_frames_and_reaps_child(fake_transport):
    fake = fake_transport
    fake.receive.recv_bytes.side_effect = [b'{"status":200,"body":"b2s="}', b""]
    assert transport.bounded_http(transport_request()) == (200, b"ok")
    fake.get_context.assert_called_once_with("spawn")
    fake.context.Pipe.assert_called_once_with(duplex=False)
    args = fake.context.Process.call_args.kwargs
    assert args["target"] is transport._spawn_worker
    assert isinstance(args["args"][1], str)  # shared-memory name, never the secret JSON payload
    assert args["args"][2] > 0
    with pytest.raises(FileNotFoundError):
        transport.SharedMemory(name=args["args"][1])
    assert args["daemon"] is True
    fake.process.start.assert_called_once()
    fake.process.join.assert_called_once_with(timeout=0.2)
    fake.process.close.assert_called_once()
    fake.receive.close.assert_called_once()
    assert all(call.args == (transport.FRAME_BYTES,) for call in fake.receive.recv_bytes.call_args_list)


@pytest.mark.parametrize("blocked_phase", ["dns", "headers", "slow_body"])
def test_transport_hard_deadline_terminates_and_kills_unresponsive_child(fake_transport, blocked_phase):
    fake = fake_transport
    if blocked_phase == "slow_body":
        # Some response IPC is available, but completion never arrives.
        fake.receive.poll.side_effect = [True, False]
        fake.receive.recv_bytes.return_value = b'{"status":200,'
    else:
        fake.receive.poll.return_value = False
    fake.process.is_alive.side_effect = [True, True, False]
    with pytest.raises(transport.WorkflowHTTPTransportError):
        transport.bounded_http(transport_request())
    fake.process.start.assert_called_once()
    fake.process.terminate.assert_called_once()
    fake.process.kill.assert_called_once()
    assert fake.process.join.call_count == 2
    fake.process.close.assert_called_once()
    fake.receive.close.assert_called_once()


@pytest.mark.parametrize(
    "frames",
    [
        [b'{"error":"HTTP_OUTCOME_UNKNOWN"}', b""],
        [b"not json", b""],
        [b'{"status":200,"body":"invalid base64"}', b""],
        [b'{"status":true,"body":""}', b""],
    ],
)
def test_transport_rejects_child_errors_and_malformed_results(fake_transport, frames):
    fake_transport.receive.recv_bytes.side_effect = frames
    with pytest.raises(transport.WorkflowHTTPTransportError) as exc:
        transport.bounded_http(transport_request())
    assert str(exc.value) == "Workflow HTTP outcome is unknown."
    fake_transport.process.close.assert_called_once()


def test_transport_rejects_excess_ipc_and_reaps_child(fake_transport, monkeypatch):
    monkeypatch.setattr(transport, "MAX_RESULT_BYTES", transport.FRAME_BYTES)
    fake_transport.receive.recv_bytes.side_effect = [b"a" * transport.FRAME_BYTES, b"b"]
    with pytest.raises(transport.WorkflowHTTPTransportError):
        transport.bounded_http(transport_request())
    assert fake_transport.receive.recv_bytes.call_count == 2
    fake_transport.process.close.assert_called_once()


def test_transport_child_crash_and_start_failure_are_sanitized(fake_transport):
    fake = fake_transport
    fake.receive.recv_bytes.side_effect = EOFError("secret URL")
    with pytest.raises(transport.WorkflowHTTPTransportError):
        transport.bounded_http(transport_request())
    fake.process.close.assert_called_once()
    fake.process.reset_mock()
    fake.process.start.side_effect = RuntimeError("secret start error")
    with pytest.raises(transport.WorkflowHTTPTransportError):
        transport.bounded_http(transport_request())
    fake.process.close.assert_called_once()
    fake.process.terminate.assert_not_called()


def test_transport_child_exception_sends_only_safe_error(monkeypatch):
    send = Mock()
    monkeypatch.setattr(transport.os, "dup2", Mock())
    monkeypatch.setattr(transport, "_fetch", Mock(side_effect=RuntimeError("https://example.com/?token=secret")))
    transport._worker(send, json.dumps(transport_request()).encode())
    frames = [call.args[0] for call in send.send_bytes.call_args_list]
    assert b"".join(frames) == b'{"error":"HTTP_OUTCOME_UNKNOWN"}'
    assert frames[-1] == b""
    send.close.assert_called_once()


def test_transport_child_keeps_ssrf_pinning_single_attempt_and_body_cap(monkeypatch):
    from plane.utils import url_security

    streamed = response()
    chunks = iter([b"a" * 4096] * 100)
    streamed.iter_content.return_value = chunks
    fetch = Mock(return_value=streamed)
    monkeypatch.setattr(url_security, "pinned_fetch", fetch)
    result = transport._fetch(transport_request())
    assert len(base64.b64decode(result["body"])) == 64 * 1024
    assert len(list(chunks)) == 84
    kwargs = fetch.call_args.kwargs
    assert kwargs["timeout"] == 5 and kwargs["stream"] is True and kwargs["max_attempts"] == 1
    assert "allowed_hosts" not in kwargs and "allow_redirects" not in kwargs
    streamed.close.assert_called_once()
    redirected = response(status=302)
    fetch.return_value = redirected
    assert transport._fetch(transport_request()) == {"status": 302, "body": ""}
    redirected.iter_content.assert_not_called()
    redirected.close.assert_called_once()


def test_transport_real_spawn_private_target_exits_without_network():
    request = {"url": "https://127.0.0.1/", "method": "GET", "headers": {}}
    with pytest.raises(transport.WorkflowHTTPTransportError):
        transport.bounded_http(request, validate_only=True)


def test_transport_real_spawn_header_stall_is_terminated(monkeypatch):
    # No network/socket is needed: the child is stopped as soon as it starts,
    # modelling a transport permanently stuck inside DNS/header parsing.
    import os
    import signal

    real_context = transport.multiprocessing.get_context("spawn")
    current_process = transport.multiprocessing.current_process
    children = []

    class StoppedProcess:
        def __init__(self, **kwargs):
            self.process = real_context.Process(**kwargs)
            children.append(self.process)

        def start(self):
            self.process.start()
            os.kill(self.process.pid, signal.SIGSTOP)

        def __getattr__(self, name):
            return getattr(self.process, name)

    context = SimpleNamespace(Pipe=real_context.Pipe, Process=StoppedProcess)
    monkeypatch.setattr(
        transport,
        "multiprocessing",
        SimpleNamespace(
            get_context=lambda _: context,
            current_process=current_process,
        ),
    )
    monkeypatch.setattr(transport, "HTTP_TIMEOUT", 0.1)
    began = time.monotonic()
    with pytest.raises(transport.WorkflowHTTPTransportError):
        transport.bounded_http(transport_request())
    assert 0.1 <= time.monotonic() - began < 2
    assert len(children) == 1 and children[0]._closed


def test_transport_validation_child_performs_dns_only(monkeypatch):
    from plane.utils import ip_address

    send = Mock()
    monkeypatch.setattr(transport.os, "dup2", Mock())
    resolve = Mock(return_value=["93.184.216.34"])
    monkeypatch.setattr(ip_address, "resolve_and_validate", resolve)
    fetch = Mock()
    monkeypatch.setattr(transport, "_fetch", fetch)
    transport._worker(send, json.dumps({**transport_request(), "validate_only": True}).encode())
    resolve.assert_called_once_with("example.com")
    fetch.assert_not_called()
    assert b"".join(call.args[0] for call in send.send_bytes.call_args_list) == b'{"validated":true}'


def test_http_refuses_outer_transaction(sdk_ctx, monkeypatch):
    fetch = Mock()
    monkeypatch.setattr(sdk, "bounded_http", fetch)
    with transaction.atomic():
        assert_rejected(
            sdk_ctx, "http", [{"url": "https://example.com/", "method": "GET"}], "HTTP_TRANSACTION_BOUNDARY"
        )
    fetch.assert_not_called()
