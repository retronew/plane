"""Runner orchestration. JavaScript executes only in the independent QuickJS service."""

import base64
import hashlib
import json
import logging
import uuid
from datetime import timedelta
from urllib.parse import urlsplit

import requests
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core import signing
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from plane.db.models import Issue, Project
from plane.db.models.workflow import WorkflowTransition
from plane.db.models.workflow_runner import (
    WorkflowCredential,
    WorkflowExecution,
    WorkflowExecutionStep,
    WorkflowScriptVersion,
)

logger = logging.getLogger(__name__)
CAPABILITIES = frozenset(
    {"getWorkItem", "addComment", "addLabels", "removeLabels", "updateWorkItem", "createWorkItem", "http"}
)
TOKEN_SALT = "plane.workflow.runner.rpc.v1"


def runner_error(code, reason=None):
    payload = {"workflow": code}
    if reason:
        payload["reason"] = str(reason)[:500]
    raise ValidationError(payload)


def canonical(value):
    if hasattr(value, "_meta"):
        return str(value.pk)
    if isinstance(value, dict):
        return {str(key): canonical(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [canonical(item) for item in value]
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def digest(value):
    return hashlib.sha256(json.dumps(canonical(value), sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def issue_snapshot(issue):
    if issue is None:
        return None
    return {
        "id": str(issue.pk),
        "name": issue.name,
        "project_id": str(issue.project_id),
        "state_id": str(issue.state_id) if issue.state_id else None,
        "type_id": str(issue.type_id) if issue.type_id else None,
        "priority": issue.priority,
        "start_date": canonical(issue.start_date),
        "target_date": canonical(issue.target_date),
        "updated_at": canonical(issue.updated_at),
        "is_draft": issue.is_draft,
        "archived_at": canonical(issue.archived_at),
        "description_html": issue.description_html,
        "label_ids": sorted(str(pk) for pk in issue.labels.values_list("id", flat=True)),
        "assignee_ids": sorted(str(pk) for pk in issue.assignees.values_list("id", flat=True)),
    }


def proposed_snapshot(attrs):
    result = canonical(attrs)
    for field in ("state", "type", "parent", "estimate_point"):
        if field in result:
            result[field + "_id"] = result.pop(field)
    return result


def validate_http_policy(project, value):
    if not isinstance(value, dict) or set(value) - {"origins", "methods", "credential_id"}:
        runner_error("WORKFLOW_INVALID_HTTP_POLICY")
    origins, methods = value.get("origins", []), value.get("methods", [])
    if not isinstance(origins, list) or len(origins) > 20 or not isinstance(methods, list) or len(methods) > 8:
        runner_error("WORKFLOW_INVALID_HTTP_POLICY")
    clean_origins = []
    for origin in origins:
        if not isinstance(origin, str):
            runner_error("WORKFLOW_INVALID_HTTP_POLICY")
        try:
            parsed = urlsplit(origin)
            port = parsed.port
        except ValueError:
            runner_error("WORKFLOW_INVALID_HTTP_POLICY")
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in ("", "/")
            or port not in (None, 443)
        ):
            runner_error("WORKFLOW_INVALID_HTTP_POLICY")
        clean_origins.append(f"https://{parsed.hostname.lower()}")
    if any(
        not isinstance(method, str) or method not in ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD")
        for method in methods
    ):
        runner_error("WORKFLOW_INVALID_HTTP_POLICY")
    result = {"origins": sorted(set(clean_origins)), "methods": sorted(set(methods))}
    credential_id = value.get("credential_id")
    if credential_id:
        try:
            credential = WorkflowCredential.objects.get(pk=credential_id, project=project)
        except (WorkflowCredential.DoesNotExist, ValueError):
            runner_error("WORKFLOW_INVALID_CREDENTIAL")
        if credential.origin not in result["origins"]:
            runner_error("WORKFLOW_INVALID_CREDENTIAL")
        result["credential_id"] = str(credential.pk)
    return result


def validate_script(project, source, capabilities, http_policy):
    if not isinstance(source, str) or not source.strip() or len(source.encode()) > 65536:
        runner_error("WORKFLOW_INVALID_SCRIPT")
    if (
        not isinstance(capabilities, list)
        or len(capabilities) > 7
        or any(not isinstance(cap, str) or cap not in CAPABILITIES for cap in capabilities)
    ):
        runner_error("WORKFLOW_INVALID_CAPABILITY")
    return sorted(set(capabilities)), validate_http_policy(project, http_policy)


def validate_runner_steps(project, steps):
    if not isinstance(steps, list) or len(steps) > 20:
        runner_error("WORKFLOW_INVALID_STEPS")
    result = []
    for step in steps:
        if (
            not isinstance(step, dict)
            or set(step) != {"phase", "outcome", "script_version_id"}
            or step.get("phase") not in ("pre", "post")
            or step.get("outcome") not in ("transition", "approve", "reject")
        ):
            runner_error("WORKFLOW_INVALID_STEPS")
        try:
            version = WorkflowScriptVersion.objects.get(
                pk=step["script_version_id"], project=project, script__deleted_at__isnull=True
            )
        except (WorkflowScriptVersion.DoesNotExist, ValueError):
            runner_error("WORKFLOW_INVALID_SCRIPT_VERSION")
        if step["phase"] == "pre" and set(version.capabilities) - {"getWorkItem"}:
            runner_error("WORKFLOW_PRECONDITION_READ_ONLY")
        result.append({"phase": step["phase"], "outcome": step["outcome"], "script_version_id": str(version.pk)})
    return result


def _credential_cipher(key_id):
    keys = getattr(settings, "WORKFLOW_CREDENTIAL_KEYS", {})
    secret = keys.get(key_id)
    if not secret:
        runner_error("WORKFLOW_CREDENTIAL_KEY_UNAVAILABLE")
    # Domain separation keeps the encryption key independent of other signing uses.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(("workflow-credential-v1:" + secret).encode()).digest()))


def encrypt_credential(secret):
    if not isinstance(secret, str) or not secret or len(secret) > 8192 or "\r" in secret or "\n" in secret:
        runner_error("WORKFLOW_INVALID_CREDENTIAL")
    key_id = settings.WORKFLOW_CREDENTIAL_KEY_ID
    return _credential_cipher(key_id).encrypt(secret.encode()).decode(), key_id


def decrypt_credential(credential):
    try:
        return _credential_cipher(credential.key_id).decrypt(credential.encrypted_secret.encode()).decode()
    except (InvalidToken, UnicodeError):
        runner_error("WORKFLOW_CREDENTIAL_DECRYPTION_FAILED")


def _context(project, attrs, instance, actor, rule, outcome, extra=None):
    before = issue_snapshot(instance)
    proposed = proposed_snapshot(attrs)
    after = {**(before or {}), **proposed}
    return {
        "work_item": before,
        "before": before,
        "proposed": proposed,
        "after": after,
        "actor": {"id": str(actor.pk), "name": actor.display_name}
        if getattr(actor, "is_authenticated", False)
        else None,
        "flow": {
            "id": str(rule.pk),
            "workflow_id": str(rule.workflow_id),
            "source_id": str(rule.source_id),
            "destination_id": str(rule.destination_id),
        },
        "outcome": outcome,
        "project_id": str(project.pk),
        "metadata": canonical(extra or {}),
    }


@transaction.atomic
def _create_execution(project, context, rule, outcome, phase, steps, actor, issue=None, dry_run=False, depth=0):
    execution = WorkflowExecution.objects.create(
        project=project,
        issue=issue,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        rule=rule,
        rule_version=rule.version if rule else 0,
        phase=phase,
        outcome=outcome,
        context=context,
        policy_version=project.workflow_version,
        depth=depth,
        dry_run=dry_run,
        draft_hash=digest(context),
    )
    for index, item in enumerate(steps):
        version = WorkflowScriptVersion.objects.get(pk=item["script_version_id"], project=project)
        WorkflowExecutionStep.objects.create(
            execution=execution,
            project=project,
            index=index,
            script_version=version,
            capabilities=version.capabilities,
            http_policy=version.http_policy,
        )
    return execution


def prepare_runner_execution(
    project_id, attrs, instance=None, actor=None, rule=None, outcome="transition", context=None
):
    if not rule or not rule.steps:
        return None
    if connection.in_atomic_block:
        runner_error("WORKFLOW_RUNNER_REQUIRES_OUTSIDE_TRANSACTION")
    project = Project.objects.get(pk=project_id)
    steps = [item for item in validate_runner_steps(project, rule.steps) if item["outcome"] == outcome]
    if not steps:
        return None
    depth = (context or {}).get("runner_depth", 0)
    if not isinstance(depth, int) or depth > 5:
        runner_error("WORKFLOW_RUNNER_DEPTH_LIMIT")
    execution_context = _context(project, attrs, instance, actor, rule, outcome, context)
    evidence = {
        "project_id": str(project.pk),
        "policy_version": project.workflow_version,
        "rule_id": str(rule.pk),
        "rule_version": rule.version,
        "before": digest(execution_context["before"]),
        "attrs": digest(execution_context["proposed"]),
        "context": execution_context,
        "steps": steps,
        "depth": depth,
        "dry_run": (context or {}).get("runner_dry_run") is True,
        "pre_run_id": None,
    }
    pre_steps = [item for item in steps if item["phase"] == "pre"]
    if pre_steps:
        execution = _create_execution(
            project,
            execution_context,
            rule,
            outcome,
            "pre",
            pre_steps,
            actor,
            instance,
            dry_run=evidence["dry_run"],
            depth=depth,
        )
        evidence["pre_run_id"] = str(execution.pk)
        execute_workflow_run(execution.pk)
        execution.refresh_from_db()
        if execution.status != "succeeded":
            runner_error("WORKFLOW_PRECONDITION_FAILED", (execution.error or {}).get("message", "Precondition failed"))
    return evidence


def verify_runner_execution(evidence, instance, attrs, rule=None):
    if not evidence:
        return
    from plane.utils.workflow import workflow_conflict

    project = Project.objects.get(pk=evidence["project_id"])
    if (
        project.workflow_version != evidence["policy_version"]
        or rule is None
        or str(rule.pk) != evidence["rule_id"]
        or rule.version != evidence["rule_version"]
        or digest(issue_snapshot(instance)) != evidence["before"]
        or digest(proposed_snapshot(attrs)) != evidence["attrs"]
    ):
        workflow_conflict("WORKFLOW_CONTEXT_STALE")
    if evidence["pre_run_id"]:
        execution = WorkflowExecution.objects.get(pk=evidence["pre_run_id"])
        if execution.status != "succeeded":
            workflow_conflict("WORKFLOW_CONTEXT_STALE")
        for issue_id, snapshot_hash in execution.read_dependencies.items():
            dependency = Issue.objects.filter(pk=issue_id, project=project).first()
            if not dependency or digest(issue_snapshot(dependency)) != snapshot_hash:
                workflow_conflict("WORKFLOW_CONTEXT_STALE")


def finish_runner_execution(evidence, issue, actor=None, rule=None, outcome="transition"):
    if not evidence or evidence.get("dry_run"):
        return None
    steps = [step for step in evidence["steps"] if step["phase"] == "post"]
    if not steps:
        return None
    project = Project.objects.get(pk=evidence["project_id"])
    context = {**evidence["context"], "after": issue_snapshot(issue), "work_item": issue_snapshot(issue)}
    execution = _create_execution(project, context, rule, outcome, "post", steps, actor, issue, depth=evidence["depth"])
    from plane.bgtasks.workflow_runner_task import queue_workflow_execution

    transaction.on_commit(lambda: queue_workflow_execution(str(execution.pk)))
    return execution


def broker_token(execution, step):
    return signing.dumps(
        {
            "execution": str(execution.pk),
            "step": str(step.pk),
            "lease": str(execution.lease),
            "step_lease": str(step.lease),
        },
        salt=TOKEN_SALT,
    )


def _call_runner(execution, step):
    runner_url = settings.WORKFLOW_RUNNER_URL
    if not runner_url or not settings.WORKFLOW_RUNNER_TOKEN:
        return {
            "success": False,
            "error": {"code": "RUNNER_UNAVAILABLE", "message": "The workflow Runner is not configured"},
            "logs": [],
        }
    try:
        response = requests.post(
            runner_url.rstrip("/") + "/execute",
            headers={"Authorization": "Bearer " + settings.WORKFLOW_RUNNER_TOKEN},
            json={
                "execution_id": str(execution.pk),
                "source": step.script_version.source if step.script_version_id else step.source,
                "context": execution.context,
                "phase": execution.phase,
                "broker": {"url": settings.WORKFLOW_RUNNER_BROKER_URL, "token": broker_token(execution, step)},
            },
            timeout=(3, 12),
            allow_redirects=False,
            stream=True,
        )
        with response:
            response.raise_for_status()
            chunks, size = [], 0
            for chunk in response.iter_content(chunk_size=16384):
                size += len(chunk)
                if size > 262144:
                    raise ValueError("Runner response exceeds limit")
                chunks.append(chunk)
            data = json.loads(b"".join(chunks))
        if not isinstance(data, dict) or not isinstance(data.get("success"), bool):
            raise ValueError("Invalid Runner response")
        return data
    except (requests.RequestException, ValueError):
        # Exceptions may contain authorization headers or host data; never persist them.
        return {
            "success": False,
            "error": {"code": "RUNNER_UNAVAILABLE", "message": "The workflow Runner did not return a valid response"},
            "logs": [],
        }


def _valid_run_policy(execution):
    project = Project.objects.filter(
        pk=execution.project_id, archived_at__isnull=True, workspace__deleted_at__isnull=True
    ).first()
    if not project or execution.depth > 5 or project.workflow_version != execution.policy_version:
        return False
    if execution.dry_run:
        return True
    if not execution.rule_id or not project.workflow_enabled:
        return False
    return WorkflowTransition.objects.filter(
        pk=execution.rule_id,
        project=project,
        version=execution.rule_version,
        workflow__project=project,
        workflow__is_active=True,
        workflow__deleted_at__isnull=True,
    ).exists()


def _finish_execution(execution, status, error=None):
    """Fence a locked execution before releasing its terminal result to callers."""
    now = timezone.now()
    if status != "succeeded":
        execution.actions.filter(status="running", method="http").update(
            status="unknown", error={"code": "HTTP_OUTCOME_UNKNOWN", "message": "The request outcome is unknown"}
        )
        if execution.actions.filter(status="unknown").exists():
            status = "unknown"
        step_status = "cancelled" if status == "cancelled" else "interrupted"
        execution.steps.filter(status="running").update(status=step_status, finished_at=now, lease=uuid.uuid4())
    execution.status, execution.error, execution.finished_at = status, error, now
    execution.lease, execution.lease_expires_at = uuid.uuid4(), None
    execution.save(update_fields=["status", "error", "finished_at", "lease", "lease_expires_at", "updated_at"])
    return execution


def _lease_expired(execution):
    return execution.lease_expires_at is None or execution.lease_expires_at <= timezone.now()


def execute_workflow_run(execution_id):
    """Claim a durable outbox row; never automatically replay a partially executed script."""
    with transaction.atomic():
        initial = WorkflowExecution.objects.get(pk=execution_id)
        Project.all_objects.select_for_update().get(pk=initial.project_id)
        execution = WorkflowExecution.objects.select_for_update().get(pk=execution_id)
        if execution.status != "queued":
            return execution
        if execution.phase == "post" and execution.issue_id:
            earlier = (
                WorkflowExecution.objects.filter(
                    issue_id=execution.issue_id, phase="post", status__in=["queued", "running", "unknown"]
                )
                .exclude(pk=execution.pk)
                .filter(
                    Q(created_at__lt=execution.created_at) | Q(created_at=execution.created_at, id__lt=execution.pk)
                )
                .exists()
            )
            if earlier:
                return execution
        if not _valid_run_policy(execution):
            return _finish_execution(
                execution,
                "cancelled",
                {"code": "WORKFLOW_CONTEXT_STALE", "message": "Workflow policy changed before execution"},
            )
        execution.status = "running"
        execution.lease = uuid.uuid4()
        execution.lease_expires_at = timezone.now() + timedelta(minutes=2)
        execution.started_at = timezone.now()
        execution.save(update_fields=["status", "lease", "lease_expires_at", "started_at", "updated_at"])
        lease = execution.lease
    project_id = execution.project_id
    for step_id in execution.steps.order_by("index").values_list("id", flat=True):
        with transaction.atomic():
            Project.all_objects.select_for_update().get(pk=project_id)
            execution = WorkflowExecution.objects.select_for_update().get(pk=execution_id)
            step = (
                WorkflowExecutionStep.objects.select_for_update(of=("self",))
                .select_related("script_version")
                .get(pk=step_id)
            )
            if execution.lease != lease or execution.status != "running":
                return execution
            if _lease_expired(execution):
                return _finish_execution(
                    execution, "interrupted", {"code": "LEASE_EXPIRED", "message": "Execution lease expired"}
                )
            if not _valid_run_policy(execution):
                return _finish_execution(
                    execution,
                    "cancelled",
                    {"code": "WORKFLOW_CONTEXT_STALE", "message": "Workflow policy changed during execution"},
                )
            if step.status == "succeeded":
                continue
            step.status, step.started_at, step.lease = "running", timezone.now(), uuid.uuid4()
            step.save()
            execution.capabilities, execution.http_policy = step.capabilities, step.http_policy
            execution.save(update_fields=["capabilities", "http_policy", "updated_at"])
            step_lease = step.lease
        result = _call_runner(execution, step)
        with transaction.atomic():
            Project.all_objects.select_for_update().get(pk=project_id)
            current = WorkflowExecution.objects.select_for_update().get(pk=execution_id)
            step = WorkflowExecutionStep.objects.select_for_update().get(pk=step_id)
            if current.lease != lease or current.status != "running" or step.lease != step_lease:
                return current
            if _lease_expired(current):
                return _finish_execution(
                    current, "interrupted", {"code": "LEASE_EXPIRED", "message": "Execution lease expired"}
                )
            if not _valid_run_policy(current):
                return _finish_execution(
                    current,
                    "cancelled",
                    {"code": "WORKFLOW_CONTEXT_STALE", "message": "Workflow policy changed during execution"},
                )
            payload = result.get("result")
            success = result.get("success") is True
            error = result.get("error")
            if success and current.actions.filter(status__in=["running", "unknown", "failed"]).exists():
                success = False
                error = {"code": "ACTION_INCOMPLETE", "message": "A script action has no successful result"}
            if execution.phase == "pre" and success:
                success = isinstance(payload, dict) and payload.get("success") is True
                if not success:
                    error = {
                        "code": "PRECONDITION_REJECTED",
                        "message": str(payload.get("reason", "Precondition did not pass"))[:500]
                        if isinstance(payload, dict)
                        else "Precondition returned an invalid result",
                    }
            step.status = "succeeded" if success else "failed"
            step.result, step.error = payload, error
            step.logs = result.get("logs", [])[:100]
            step.metrics = result.get("metrics", {})
            step.finished_at = timezone.now()
            step.save()
            current.logs = (current.logs + step.logs)[-100:]
            current.save(update_fields=["logs", "updated_at"])
            if not success:
                return _finish_execution(
                    current, "failed", error or {"code": "SCRIPT_ERROR", "message": "Script failed"}
                )
    # A policy change or lease expiry may occur after the final step commits. The
    # final decision uses the same lock order as SDK calls and management writes.
    with transaction.atomic():
        Project.all_objects.select_for_update().get(pk=project_id)
        current = WorkflowExecution.objects.select_for_update().get(pk=execution_id)
        if current.lease != lease or current.status != "running":
            return current
        if _lease_expired(current):
            return _finish_execution(
                current, "interrupted", {"code": "LEASE_EXPIRED", "message": "Execution lease expired"}
            )
        if not _valid_run_policy(current):
            return _finish_execution(
                current,
                "cancelled",
                {"code": "WORKFLOW_CONTEXT_STALE", "message": "Workflow policy changed during execution"},
            )
        if current.steps.exclude(status="succeeded").exists() or current.actions.exclude(status="completed").exists():
            return _finish_execution(
                current,
                "failed",
                {"code": "ACTION_INCOMPLETE", "message": "A script step or action has no successful result"},
            )
        return _finish_execution(current, "succeeded")


def recover_workflow_executions():
    """Expired leases require an explicit retry, since an action may already have committed."""
    with transaction.atomic():
        for execution in WorkflowExecution.objects.select_for_update(skip_locked=True).filter(
            Q(lease_expires_at__lte=timezone.now()) | Q(lease_expires_at__isnull=True), status="running"
        )[:100]:
            _finish_execution(
                execution,
                "interrupted",
                {"code": "LEASE_EXPIRED", "message": "Runner stopped before recording a result"},
            )


def can_retry_execution(execution):
    return (
        execution.phase == "post"
        and execution.status in ("failed", "interrupted")
        and not execution.actions.filter(status__in=["unknown", "running"]).exists()
        and _valid_run_policy(execution)
    )


def retry_execution(execution):
    with transaction.atomic():
        execution = WorkflowExecution.objects.select_for_update().get(pk=execution.pk)
        if not can_retry_execution(execution):
            runner_error("WORKFLOW_EXECUTION_NOT_RETRYABLE")
        execution.attempt += 1
        execution.status, execution.error, execution.finished_at = "queued", None, None
        execution.lease = uuid.uuid4()
        execution.save()
        for step in execution.steps.select_for_update().exclude(status="succeeded"):
            step.history = [
                *step.history,
                {
                    "attempt": step.attempt,
                    "status": step.status,
                    "result": step.result,
                    "error": step.error,
                    "logs": step.logs,
                    "metrics": step.metrics,
                    "started_at": canonical(step.started_at),
                    "finished_at": canonical(step.finished_at),
                },
            ]
            step.status, step.attempt, step.error = "queued", execution.attempt, None
            step.save()
        from plane.bgtasks.workflow_runner_task import queue_workflow_execution

        transaction.on_commit(lambda: queue_workflow_execution(str(execution.pk)))
    return execution
