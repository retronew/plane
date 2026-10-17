"""Fault-injection regression contracts for Runner leases, snapshots and outbox order."""

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import UUID, uuid4

import pytest
from django.utils import timezone

from plane.bgtasks import workflow_runner_task as tasks
from plane.db.models import Issue, Project, ProjectMember, State
from plane.db.models.workflow import ProjectWorkflow, WorkflowTransition
from plane.db.models.workflow_runner import (
    WorkflowAction,
    WorkflowExecution,
    WorkflowExecutionStep,
    WorkflowScript,
    WorkflowScriptVersion,
)
from plane.utils import workflow_runner as runner

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]


@pytest.fixture
def reliability_ctx(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Runner reliability", identifier="RELIABLE")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    before = State.objects.create(project=project, name="Todo", group="unstarted", default=True)
    after = State.objects.create(project=project, name="Done", group="completed")
    workflow = ProjectWorkflow.objects.create(project=project, enabled=True)
    project.refresh_from_db()
    rule = WorkflowTransition.objects.create(project=project, workflow=workflow, source=before, destination=after)
    issue = Issue.objects.create(project=project, state=before, name="Reliable", priority="low")
    script = WorkflowScript.objects.create(project=project, name="Precondition")
    version = WorkflowScriptVersion.objects.create(
        project=project,
        script=script,
        version=1,
        source="return {success:true}",
        source_hash="a" * 64,
        capabilities=[],
        http_policy={"origins": [], "methods": []},
    )
    rule.steps = [{"phase": "pre", "outcome": "transition", "script_version_id": str(version.pk)}]
    rule.save(update_fields=["steps"])
    return SimpleNamespace(project=project, issue=issue, user=create_user, rule=rule, after=after, version=version)


def draft_execution(ctx, *, phase="post", status="queued", issue=None, execution_id=None):
    execution = WorkflowExecution.objects.create(
        **({"id": execution_id} if execution_id else {}),
        project=ctx.project,
        issue=ctx.issue if issue is None else issue,
        actor=ctx.user,
        phase=phase,
        status=status,
        policy_version=ctx.project.workflow_version,
        dry_run=True,
    )
    WorkflowExecutionStep.objects.create(project=ctx.project, execution=execution, index=0, source="return {}")
    return execution


def passed():
    return {"success": True, "result": {"success": True}, "logs": [], "error": None, "metrics": {}}


def test_expired_lease_cannot_accept_a_late_success(reliability_ctx, monkeypatch):
    ctx = reliability_ctx
    execution = draft_execution(ctx, phase="pre")

    def late_response(current, step):
        WorkflowExecution.objects.filter(pk=current.pk).update(lease_expires_at=timezone.now() - timedelta(seconds=1))
        return passed()

    monkeypatch.setattr(runner, "_call_runner", late_response)
    result = runner.execute_workflow_run(execution.pk)
    assert result.status != "succeeded"
    assert result.error["code"] == "LEASE_EXPIRED"
    assert result.steps.get().status != "succeeded"
    assert result.lease_expires_at is None


def test_old_step_lease_cannot_commit_runner_result(reliability_ctx, monkeypatch):
    execution = draft_execution(reliability_ctx)
    replacement = uuid4()

    def changed_step_lease(current, step):
        WorkflowExecutionStep.objects.filter(pk=step.pk).update(lease=replacement)
        return passed()

    monkeypatch.setattr(runner, "_call_runner", changed_step_lease)
    result = runner.execute_workflow_run(execution.pk)
    assert result.status != "succeeded"
    step = result.steps.get()
    assert step.lease == replacement
    assert step.result is None
    assert step.status == "running"


def test_precondition_context_and_evidence_use_the_same_single_snapshot(reliability_ctx, monkeypatch):
    ctx = reliability_ctx
    original_issue_snapshot = runner.issue_snapshot
    original_proposed_snapshot = runner.proposed_snapshot
    snapshots = []
    proposals = []

    def snapshot(issue):
        result = original_issue_snapshot(issue)
        snapshots.append(result)
        return {**result, "priority": "low" if len(snapshots) == 1 else "high"}

    def proposed(attrs):
        result = original_proposed_snapshot(attrs)
        proposals.append(result)
        return {**result, "name": "First read" if len(proposals) == 1 else "Second read"}

    monkeypatch.setattr(runner, "issue_snapshot", snapshot)
    monkeypatch.setattr(runner, "proposed_snapshot", proposed)
    monkeypatch.setattr(runner, "_call_runner", lambda *_: passed())
    evidence = runner.prepare_runner_execution(ctx.project.pk, {"state": ctx.after}, ctx.issue, ctx.user, ctx.rule)
    assert len(snapshots) == 1
    assert len(proposals) == 1
    assert evidence["before"] == runner.digest(evidence["context"]["before"])
    assert evidence["attrs"] == runner.digest(evidence["context"]["proposed"])
    assert evidence["context"]["before"]["priority"] == "low"
    assert evidence["context"]["proposed"]["name"] == "First read"


def test_unknown_http_result_blocks_later_events_until_manually_resolved(reliability_ctx, monkeypatch):
    ctx = reliability_ctx
    older = draft_execution(ctx, status="unknown")
    newer = draft_execution(ctx)
    remote = Mock(return_value=passed())
    monkeypatch.setattr(runner, "_call_runner", remote)
    result = runner.execute_workflow_run(newer.pk)
    assert result.status == "queued"
    remote.assert_not_called()
    WorkflowExecution.objects.filter(pk=older.pk).update(status="cancelled")
    result = runner.execute_workflow_run(newer.pk)
    assert result.status == "succeeded"
    remote.assert_called_once()


def test_equal_created_at_uses_id_to_preserve_issue_order(reliability_ctx, monkeypatch):
    ctx = reliability_ctx
    older = draft_execution(ctx, execution_id=UUID(int=1), status="unknown")
    newer = draft_execution(ctx, execution_id=UUID(int=2))
    WorkflowExecution.objects.filter(pk__in=[older.pk, newer.pk]).update(created_at=timezone.now())
    remote = Mock(return_value=passed())
    monkeypatch.setattr(runner, "_call_runner", remote)
    assert runner.execute_workflow_run(newer.pk).status == "queued"
    remote.assert_not_called()


def test_dispatch_skips_one_issues_blocked_backlog_without_starving_other_issues(reliability_ctx, monkeypatch):
    ctx = reliability_ctx
    draft_execution(ctx, status="unknown")
    for _ in range(105):
        draft_execution(ctx)
    other_issue = Issue.objects.create(project=ctx.project, state=ctx.issue.state, name="Independent")
    available = draft_execution(ctx, issue=other_issue)
    queue = Mock()
    monkeypatch.setattr(tasks, "queue_workflow_execution", queue)
    tasks.dispatch_workflow_outbox()
    queue.assert_called_once_with(str(available.pk))


@pytest.mark.parametrize("action_status", ["running", "unknown", "failed"])
def test_runner_success_with_unfinished_actions_is_rejected(reliability_ctx, monkeypatch, action_status):
    ctx = reliability_ctx
    execution = draft_execution(ctx)

    def inconsistent_success(current, step):
        WorkflowAction.objects.create(
            project=ctx.project,
            execution=current,
            step=step,
            index=1,
            method="http",
            params_hash="a" * 64,
            status=action_status,
        )
        return passed()

    monkeypatch.setattr(runner, "_call_runner", inconsistent_success)
    result = runner.execute_workflow_run(execution.pk)
    assert result.status == ("failed" if action_status == "failed" else "unknown")
    assert result.error["code"] == "ACTION_INCOMPLETE"
    assert result.steps.get().status == "failed"
    assert result.lease_expires_at is None
    assert not runner.can_retry_execution(result) if action_status != "failed" else True


def test_failed_runner_with_http_in_flight_requires_manual_resolution(reliability_ctx, monkeypatch):
    ctx = reliability_ctx
    execution = draft_execution(ctx)

    def failed_response(current, step):
        WorkflowAction.objects.create(
            project=ctx.project,
            execution=current,
            step=step,
            index=1,
            method="http",
            params_hash="b" * 64,
            status="running",
        )
        return {"success": False, "error": {"code": "RUNNER_UNAVAILABLE", "message": "No response"}, "logs": []}

    monkeypatch.setattr(runner, "_call_runner", failed_response)
    result = runner.execute_workflow_run(execution.pk)
    assert result.status == "unknown"
    assert result.actions.get().status == "unknown"
    assert not runner.can_retry_execution(result)


def test_retry_preserves_old_step_attempt_results_and_logs(reliability_ctx, monkeypatch):
    ctx = reliability_ctx
    execution = draft_execution(ctx)
    monkeypatch.setattr(tasks, "queue_workflow_execution", Mock())
    monkeypatch.setattr(
        runner,
        "_call_runner",
        lambda *_: {
            "success": False,
            "result": {"partial": True},
            "error": {"code": "SCRIPT_ERROR", "message": "Stopped"},
            "logs": [{"level": "info", "message": "Attempt one"}],
            "metrics": {"rpc_calls": 1},
        },
    )
    runner.execute_workflow_run(execution.pk)
    runner.retry_execution(execution)
    step = execution.steps.get()
    assert step.status == "queued" and step.attempt == 2
    assert step.history[0]["status"] == "failed"
    assert step.history[0]["result"] == {"partial": True}
    assert step.history[0]["logs"] == [{"level": "info", "message": "Attempt one"}]
    assert step.history[0]["error"]["code"] == "SCRIPT_ERROR"
    assert step.history[0]["finished_at"] is not None


@pytest.mark.parametrize(
    "change", ["version", "disabled", "workflow_inactive", "project_archived", "workspace_deleted"]
)
def test_policy_change_during_last_script_cannot_be_recorded_as_success(reliability_ctx, monkeypatch, change):
    ctx = reliability_ctx
    execution = draft_execution(ctx)
    WorkflowExecution.objects.filter(pk=execution.pk).update(
        dry_run=False,
        rule=ctx.rule,
        rule_version=ctx.rule.version,
    )

    def changed_policy(current, step):
        if change == "version":
            Project.objects.filter(pk=ctx.project.pk).update(workflow_version=ctx.project.workflow_version + 1)
        elif change == "disabled":
            Project.objects.filter(pk=ctx.project.pk).update(workflow_enabled=False)
        elif change == "workflow_inactive":
            ProjectWorkflow.objects.filter(pk=ctx.rule.workflow_id).update(is_active=False)
        elif change == "project_archived":
            Project.objects.filter(pk=ctx.project.pk).update(archived_at=timezone.now())
        else:
            workspace = ctx.project.workspace
            type(workspace).objects.filter(pk=workspace.pk).update(deleted_at=timezone.now())
        return passed()

    monkeypatch.setattr(runner, "_call_runner", changed_policy)
    result = runner.execute_workflow_run(execution.pk)
    assert result.status == "cancelled"
    assert result.error["code"] == "WORKFLOW_CONTEXT_STALE"
    assert result.lease_expires_at is None
    assert result.steps.get().status == "cancelled"


@pytest.mark.parametrize("change", ["policy", "expiry", "unfinished_action"])
def test_final_commit_rechecks_changes_after_last_step_is_recorded(reliability_ctx, monkeypatch, change):
    ctx = reliability_ctx
    execution = draft_execution(ctx)
    original_save = WorkflowExecutionStep.save
    injected = []

    def save_then_change(step, *args, **kwargs):
        result = original_save(step, *args, **kwargs)
        if step.execution_id == execution.pk and step.status == "succeeded" and not injected:
            injected.append(True)
            if change == "policy":
                Project.objects.filter(pk=ctx.project.pk).update(workflow_version=ctx.project.workflow_version + 1)
            elif change == "expiry":
                WorkflowExecution.objects.filter(pk=execution.pk).update(
                    lease_expires_at=timezone.now() - timedelta(seconds=1)
                )
            else:
                WorkflowAction.objects.create(
                    project=ctx.project,
                    execution_id=execution.pk,
                    step=step,
                    index=1,
                    method="http",
                    params_hash="c" * 64,
                    status="running",
                )
        return result

    monkeypatch.setattr(WorkflowExecutionStep, "save", save_then_change)
    monkeypatch.setattr(runner, "_call_runner", lambda *_: passed())
    result = runner.execute_workflow_run(execution.pk)
    assert injected
    assert result.status == {"policy": "cancelled", "expiry": "interrupted", "unfinished_action": "unknown"}[change]
    assert result.lease_expires_at is None
    if change == "unfinished_action":
        assert result.actions.get().status == "unknown"


@pytest.mark.parametrize("with_http", [False, True])
@pytest.mark.parametrize("missing_expiry", [False, True])
def test_recovery_clears_expiry_and_fences_running_step(reliability_ctx, with_http, missing_expiry):
    ctx = reliability_ctx
    execution = draft_execution(ctx, status="running")
    WorkflowExecution.objects.filter(pk=execution.pk).update(
        lease_expires_at=None if missing_expiry else timezone.now() - timedelta(seconds=1)
    )
    step = execution.steps.get()
    WorkflowExecutionStep.objects.filter(pk=step.pk).update(status="running")
    if with_http:
        WorkflowAction.objects.create(
            project=ctx.project,
            execution=execution,
            step=step,
            index=1,
            method="http",
            params_hash="d" * 64,
            status="running",
        )
    runner.recover_workflow_executions()
    execution.refresh_from_db()
    old_step_lease = step.lease
    step.refresh_from_db()
    assert execution.status == ("unknown" if with_http else "interrupted")
    assert execution.lease_expires_at is None
    assert step.status == "interrupted"
    assert step.lease != old_step_lease
    assert step.finished_at is not None
    if with_http:
        assert execution.actions.get().status == "unknown"


def test_policy_cancel_before_claim_also_invalidates_old_lease(reliability_ctx, monkeypatch):
    ctx = reliability_ctx
    execution = draft_execution(ctx)
    old_lease = execution.lease
    WorkflowExecution.objects.filter(pk=execution.pk).update(lease_expires_at=timezone.now() + timedelta(minutes=1))
    Project.objects.filter(pk=ctx.project.pk).update(workflow_version=ctx.project.workflow_version + 1)
    remote = Mock()
    monkeypatch.setattr(runner, "_call_runner", remote)
    result = runner.execute_workflow_run(execution.pk)
    assert result.status == "cancelled"
    assert result.lease != old_lease
    assert result.lease_expires_at is None
    remote.assert_not_called()
