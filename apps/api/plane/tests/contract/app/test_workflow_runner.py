"""Orchestration and real isolated-process contracts (never run against the dev DB)."""

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from django.db import transaction
from django.test.testcases import LiveServerThread
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from plane.db.models import Issue, IssueComment, Project, ProjectMember, State
from plane.db.models.workflow import ProjectWorkflow, WorkflowTransition
from plane.db.models.workflow_runner import (
    WorkflowAction,
    WorkflowCredential,
    WorkflowExecution,
    WorkflowExecutionStep,
    WorkflowScript,
    WorkflowScriptVersion,
)
from plane.utils.workflow import WorkflowConflict
from plane.utils.workflow_runner import (
    can_retry_execution,
    decrypt_credential,
    digest,
    encrypt_credential,
    execute_workflow_run,
    finish_runner_execution,
    issue_snapshot,
    prepare_runner_execution,
    recover_workflow_executions,
    retry_execution,
    validate_runner_steps,
    verify_runner_execution,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]


@pytest.fixture
def runner_ctx(workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.bgtasks.workflow_runner_task.queue_workflow_execution", Mock())
    project = Project.objects.create(workspace=workspace, name="Runner contracts", identifier="RUNNER")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    before = State.objects.create(project=project, name="Todo", group="unstarted", default=True)
    after = State.objects.create(project=project, name="Done", group="completed")
    workflow = ProjectWorkflow.objects.create(project=project, enabled=True)
    project.refresh_from_db()
    rule = WorkflowTransition.objects.create(project=project, workflow=workflow, source=before, destination=after)
    issue = Issue.objects.create(project=project, state=before, name="Runner item", priority="low")
    script = WorkflowScript.objects.create(project=project, name="Contract script")
    return SimpleNamespace(project=project, user=create_user, rule=rule, issue=issue, after=after, script=script)


def bind(ctx, source, phase="pre", capabilities=None, outcome="transition"):
    version = WorkflowScriptVersion.objects.create(
        project=ctx.project,
        script=ctx.script,
        version=ctx.script.versions.count() + 1,
        source=source,
        source_hash=digest(source),
        capabilities=capabilities or [],
        http_policy={"origins": [], "methods": []},
    )
    ctx.rule.steps = [*ctx.rule.steps, {"script_version_id": str(version.pk), "phase": phase, "outcome": outcome}]
    ctx.rule.save(update_fields=["steps"])
    return version


def fake_result(success=True, result=None, error=None):
    return {
        "success": success,
        "result": result if result is not None else {"success": True},
        "error": error,
        "logs": [],
        "metrics": {},
    }


def test_precondition_receives_proposed_and_original_values(runner_ctx, monkeypatch):
    ctx = runner_ctx
    bind(ctx, "return {success: true}")
    seen = []

    def run(execution, step):
        seen.append(execution.context)
        return fake_result()

    monkeypatch.setattr("plane.utils.workflow_runner._call_runner", run)
    attrs = {"state": ctx.after, "priority": "high"}
    evidence = prepare_runner_execution(ctx.project.pk, attrs, ctx.issue, ctx.user, ctx.rule)
    assert seen[0]["before"]["priority"] == "low"
    assert seen[0]["proposed"]["priority"] == "high"
    assert seen[0]["proposed"]["state_id"] == str(ctx.after.pk)
    assert seen[0]["after"]["priority"] == "high"
    verify_runner_execution(evidence, ctx.issue, attrs, ctx.rule)


@pytest.mark.parametrize(
    "response",
    [
        fake_result(result={"success": False, "reason": "Missing review"}),
        fake_result(result={"ok": True}),
        fake_result(success=False, error={"code": "TIMEOUT", "message": "Script timed out"}),
    ],
)
def test_precondition_failures_remain_durable_without_state_change(runner_ctx, monkeypatch, response):
    ctx = runner_ctx
    bind(ctx, "return {success: false}")
    monkeypatch.setattr("plane.utils.workflow_runner._call_runner", lambda *args: response)
    with pytest.raises(ValidationError, match="WORKFLOW_PRECONDITION_FAILED"):
        prepare_runner_execution(ctx.project.pk, {"state": ctx.after}, ctx.issue, ctx.user, ctx.rule)
    ctx.issue.refresh_from_db()
    assert ctx.issue.state_id == ctx.rule.source_id
    assert WorkflowExecution.objects.get().status == "failed"


def test_precondition_rejects_network_while_outer_transaction_holds_locks(runner_ctx):
    ctx = runner_ctx
    bind(ctx, "return {success: true}")
    with transaction.atomic(), pytest.raises(ValidationError, match="WORKFLOW_RUNNER_REQUIRES_OUTSIDE_TRANSACTION"):
        prepare_runner_execution(ctx.project.pk, {"state": ctx.after}, ctx.issue, ctx.user, ctx.rule)
    assert not WorkflowExecution.objects.exists()


@pytest.mark.parametrize("change", ["issue", "attrs", "rule", "policy"])
def test_precondition_evidence_is_rejected_after_context_changes(runner_ctx, monkeypatch, change):
    ctx = runner_ctx
    bind(ctx, "return {success: true}")
    monkeypatch.setattr("plane.utils.workflow_runner._call_runner", lambda *args: fake_result())
    attrs = {"state": ctx.after}
    evidence = prepare_runner_execution(ctx.project.pk, attrs, ctx.issue, ctx.user, ctx.rule)
    if change == "issue":
        ctx.issue.name = "Concurrent write"
        ctx.issue.save()
    elif change == "attrs":
        attrs["priority"] = "urgent"
    elif change == "rule":
        ctx.rule.version += 1
        ctx.rule.save(update_fields=["version"])
    else:
        Project.objects.filter(pk=ctx.project.pk).update(workflow_version=ctx.project.workflow_version + 1)
    with pytest.raises(WorkflowConflict, match="WORKFLOW_CONTEXT_STALE"):
        verify_runner_execution(evidence, ctx.issue, attrs, ctx.rule)


def test_read_dependency_changes_invalidate_precondition(runner_ctx, monkeypatch):
    ctx = runner_ctx
    bind(ctx, "return {success: true}", capabilities=["getWorkItem"])
    dependency = Issue.objects.create(project=ctx.project, name="Dependency", state=ctx.rule.source)

    def run(execution, step):
        execution.read_dependencies = {str(dependency.pk): digest(issue_snapshot(dependency))}
        execution.save(update_fields=["read_dependencies"])
        return fake_result()

    monkeypatch.setattr("plane.utils.workflow_runner._call_runner", run)
    attrs = {"state": ctx.after}
    evidence = prepare_runner_execution(ctx.project.pk, attrs, ctx.issue, ctx.user, ctx.rule)
    dependency.name = "Changed"
    dependency.save()
    with pytest.raises(WorkflowConflict, match="WORKFLOW_CONTEXT_STALE"):
        verify_runner_execution(evidence, ctx.issue, attrs, ctx.rule)


def test_business_rollback_does_not_leave_post_outbox(runner_ctx):
    ctx = runner_ctx
    bind(ctx, "return {}", phase="post")
    evidence = prepare_runner_execution(ctx.project.pk, {"state": ctx.after}, ctx.issue, ctx.user, ctx.rule)
    with pytest.raises(RuntimeError), transaction.atomic():
        ctx.issue.state = ctx.after
        ctx.issue.save()
        finish_runner_execution(evidence, ctx.issue, ctx.user, ctx.rule)
        raise RuntimeError("rollback")
    assert not WorkflowExecution.objects.exists()
    ctx.issue.refresh_from_db()
    assert ctx.issue.state_id == ctx.rule.source_id


def test_post_failure_keeps_transition_and_stops_later_steps(runner_ctx, monkeypatch):
    ctx = runner_ctx
    bind(ctx, "return {}", phase="post")
    bind(ctx, "throw Error('failure')", phase="post")
    bind(ctx, "return {}", phase="post")
    evidence = prepare_runner_execution(ctx.project.pk, {"state": ctx.after}, ctx.issue, ctx.user, ctx.rule)
    with transaction.atomic():
        ctx.issue.state = ctx.after
        ctx.issue.save()
        execution = finish_runner_execution(evidence, ctx.issue, ctx.user, ctx.rule)
    calls = []

    def run(execution, step):
        calls.append(step.index)
        return fake_result(success=step.index != 1, error={"code": "SCRIPT_ERROR", "message": "failed"})

    monkeypatch.setattr("plane.utils.workflow_runner._call_runner", run)
    execute_workflow_run(execution.pk)
    execution.refresh_from_db()
    ctx.issue.refresh_from_db()
    assert execution.status == "failed"
    assert ctx.issue.state_id == ctx.after.pk
    assert calls == [0, 1]
    retry_execution(execution)
    execute_workflow_run(execution.pk)
    assert calls == [0, 1, 1]
    failed_step = execution.steps.get(index=1)
    assert failed_step.history[0]["attempt"] == 1
    assert failed_step.history[0]["error"]["code"] == "SCRIPT_ERROR"


def test_expired_http_is_unknown_and_never_automatically_retried(runner_ctx):
    ctx = runner_ctx
    execution = WorkflowExecution.objects.create(
        project=ctx.project,
        issue=ctx.issue,
        actor=ctx.user,
        rule=ctx.rule,
        rule_version=ctx.rule.version,
        policy_version=ctx.project.workflow_version,
        phase="post",
        status="running",
        lease_expires_at=timezone.now() - timedelta(seconds=1),
    )
    step = WorkflowExecutionStep.objects.create(project=ctx.project, execution=execution, index=0, status="running")
    WorkflowAction.objects.create(
        project=ctx.project, execution=execution, step=step, index=1, method="http", params_hash="a" * 64
    )
    old_lease = execution.lease
    recover_workflow_executions()
    execution.refresh_from_db()
    assert execution.status == "unknown"
    assert execution.lease != old_lease
    assert not can_retry_execution(execution)
    assert execution.actions.get().status == "unknown"


def test_script_versions_are_immutable_and_pre_capabilities_are_read_only(runner_ctx):
    ctx = runner_ctx
    version = bind(ctx, "return {}", capabilities=["addComment"])
    with pytest.raises(ValidationError, match="WORKFLOW_PRECONDITION_READ_ONLY"):
        validate_runner_steps(ctx.project, ctx.rule.steps)
    version.source = "mutated"
    with pytest.raises(ValueError, match="immutable"):
        version.save()


def test_credentials_require_correct_key_and_never_store_plaintext(runner_ctx, settings):
    settings.WORKFLOW_CREDENTIAL_KEYS = {"v1": "test-encryption-key"}
    settings.WORKFLOW_CREDENTIAL_KEY_ID = "v1"
    secret = "Bearer private-token"
    encrypted, key_id = encrypt_credential(secret)
    credential = WorkflowCredential.objects.create(
        project=runner_ctx.project,
        name="Service",
        origin="https://example.com",
        encrypted_secret=encrypted,
        key_id=key_id,
    )
    assert secret not in encrypted
    assert decrypt_credential(credential) == secret
    settings.WORKFLOW_CREDENTIAL_KEYS = {}
    with pytest.raises(ValidationError, match="WORKFLOW_CREDENTIAL_KEY_UNAVAILABLE"):
        decrypt_credential(credential)


@pytest.fixture(scope="module")
def runner_broker_server():
    from django.conf import settings as django_settings
    from django.contrib.staticfiles.handlers import StaticFilesHandler
    from django.test import override_settings

    if not django_settings.WORKFLOW_RUNNER_URL:
        pytest.skip("Real Runner integration requires docker-compose-test workflow-runner")
    with override_settings(ALLOWED_HOSTS=["*"]):
        server = LiveServerThread("0.0.0.0", StaticFilesHandler, port=8000)
        server.daemon = True
        server.start()
        server.is_ready.wait(timeout=10)
        if server.error:
            raise server.error
        assert server.is_ready.is_set()
        try:
            yield
        finally:
            server.terminate()
            server.join(timeout=10)


@pytest.mark.parametrize("approved", [True, False])
def test_real_runner_executes_async_preconditions_and_sdk_reads(runner_ctx, runner_broker_server, approved):
    ctx = runner_ctx
    bind(
        ctx,
        "const item = await sdk.getWorkItem(); console.log(item.name); "
        "return {success: context.proposed.priority === 'high', reason: 'Needs high priority'};",
        capabilities=["getWorkItem"],
    )
    attrs = {"state": ctx.after, "priority": "high" if approved else "low"}
    if approved:
        evidence = prepare_runner_execution(ctx.project.pk, attrs, ctx.issue, ctx.user, ctx.rule)
        verify_runner_execution(evidence, ctx.issue, attrs, ctx.rule)
        assert WorkflowExecution.objects.get().status == "succeeded"
    else:
        with pytest.raises(ValidationError, match="WORKFLOW_PRECONDITION_FAILED"):
            prepare_runner_execution(ctx.project.pk, attrs, ctx.issue, ctx.user, ctx.rule)
        assert WorkflowExecution.objects.get().error["code"] == "PRECONDITION_REJECTED"


def test_real_runner_post_comment_retry_is_idempotent(runner_ctx, runner_broker_server):
    ctx = runner_ctx
    bind(
        ctx,
        "await sdk.addComment(context.work_item.id, 'Runner delivered'); throw Error('after comment');",
        phase="post",
        capabilities=["addComment"],
    )
    evidence = prepare_runner_execution(ctx.project.pk, {"state": ctx.after}, ctx.issue, ctx.user, ctx.rule)
    with transaction.atomic():
        ctx.issue.state = ctx.after
        ctx.issue.save()
        execution = finish_runner_execution(evidence, ctx.issue, ctx.user, ctx.rule)
    execute_workflow_run(execution.pk)
    execution.refresh_from_db()
    assert execution.status == "failed", execution.error
    assert IssueComment.objects.filter(issue=ctx.issue).count() == 1
    retry_execution(execution)
    execute_workflow_run(execution.pk)
    assert IssueComment.objects.filter(issue=ctx.issue).count() == 1
    assert execution.actions.count() == 1
