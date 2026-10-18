"""Trusted Django side of the Runner SDK. No caller-supplied identity is accepted."""

import hashlib
import json
import re
from datetime import date
from urllib.parse import parse_qsl, urlsplit
from uuid import UUID

from django.db import connection, transaction
from django.utils import timezone
from django.utils.html import escape
from rest_framework.exceptions import APIException

from plane.db.models import (
    Issue,
    IssueComment,
    IssueLabel,
    IssueType,
    Label,
    Project,
    ProjectMember,
    State,
    WorkspaceMember,
)
from plane.db.models.workflow import WorkflowTransition
from plane.db.models.workflow_runner import (
    WorkflowAction,
    WorkflowCredential,
    WorkflowExecution,
    WorkflowExecutionStep,
    WorkflowScriptVersion,
)
from plane.services.hierarchy import validate_hierarchy_write
from plane.services.workflow_http_transport import WorkflowHTTPTransportError, bounded_http
from plane.utils.workflow import finish_workflow_write, prepare_workflow_write, verify_workflow_write

METHODS = frozenset(
    {"getWorkItem", "addComment", "addLabels", "removeLabels", "updateWorkItem", "createWorkItem", "http"}
)
UPDATE_FIELDS = frozenset({"name", "priority", "start_date", "target_date", "state_id", "type_id"})
CREATE_FIELDS = UPDATE_FIELDS
MAX_ACTIONS = 20
MAX_HTTP_BYTES = 64 * 1024
# Keep caller-controlled headers small and incapable of changing routing/authentication.
HTTP_HEADERS = frozenset(
    {"accept", "accept-language", "content-type", "user-agent", "x-request-id", "x-correlation-id"}
)
HEADER_TOKEN = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")
SENSITIVE_KEY = re.compile(r"authorization|cookie|password|secret|token|api.?key|credential", re.I)


class WorkflowSDKError(APIException):
    status_code = 400

    def __init__(self, code, message="Workflow SDK request rejected."):
        self.sdk_code = code
        super().__init__({"code": code, "message": message}, code=code)


def _reject(code):
    raise WorkflowSDKError(code)


def _uuid(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        _reject("INVALID_PARAMS")


def _hash_params(method, params):
    if not isinstance(method, str) or method not in METHODS or not isinstance(params, list):
        _reject("INVALID_PARAMS")
    try:
        encoded = json.dumps([method, params], sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    except (ValueError, TypeError, RecursionError, UnicodeError):
        _reject("INVALID_PARAMS")
    if len(encoded) > MAX_HTTP_BYTES:
        _reject("INVALID_PARAMS")
    return hashlib.sha256(encoded).hexdigest()


def _lock_context(execution, step, method):
    """Always re-read authority and compare both broker lease snapshots under locks."""
    project = Project.objects.select_for_update().filter(pk=execution.project_id, archived_at__isnull=True).first()
    current = WorkflowExecution.objects.select_for_update().filter(pk=execution.pk).first()
    current_step = WorkflowExecutionStep.objects.select_for_update().filter(pk=step.pk).first()
    if not project or not current or not current_step:
        _reject("EXECUTION_INVALID")
    if (
        current.project_id != project.pk
        or current.workspace_id != project.workspace_id
        or current_step.execution_id != current.pk
        or current_step.project_id != project.pk
        or current_step.workspace_id != project.workspace_id
        or current.status != "running"
        or current_step.status != "running"
        or current.lease != execution.lease
        or current_step.lease != step.lease
        or current_step.attempt != step.attempt
        or not current.lease_expires_at
        or current.lease_expires_at <= timezone.now()
        or current.depth > 5
        or current.policy_version != project.workflow_version
        or not Project.objects.filter(pk=project.pk, workspace__deleted_at__isnull=True).exists()
    ):
        _reject("EXECUTION_INVALID")
    if current.phase not in {"pre", "post"} or (current.phase == "pre" and method != "getWorkItem"):
        _reject("PHASE_DENIED")
    if (
        current.rule_id
        and not WorkflowTransition.objects.filter(
            pk=current.rule_id, project=project, workspace_id=project.workspace_id, version=current.rule_version
        ).exists()
    ):
        _reject("POLICY_STALE")
    if not isinstance(current.capabilities, list) or not isinstance(current_step.capabilities, list):
        _reject("CAPABILITY_DENIED")
    capabilities = set(current.capabilities) & set(current_step.capabilities)
    version = None
    if current_step.script_version_id:
        version = WorkflowScriptVersion.objects.filter(
            pk=current_step.script_version_id,
            project=project,
            workspace_id=project.workspace_id,
            script__deleted_at__isnull=True,
            script__project=project,
        ).first()
        if not version:
            _reject("POLICY_STALE")
        capabilities &= set(version.capabilities)
    elif not current.dry_run:
        _reject("POLICY_STALE")
    if method not in capabilities:
        _reject("CAPABILITY_DENIED")
    actor = current.actor
    if actor is None:
        if method != "getWorkItem":
            _reject("ACTOR_DENIED")
    elif (
        not actor.is_active
        or not ProjectMember.objects.select_for_update()
        .filter(project=project, member=actor, is_active=True, role__gte=15)
        .first()
        or not WorkspaceMember.objects.select_for_update()
        .filter(workspace_id=project.workspace_id, member=actor, is_active=True, role__gte=15)
        .first()
    ):
        _reject("ACTOR_DENIED")
    if (
        current.issue_id
        and not Issue.objects.filter(
            pk=current.issue_id,
            project=project,
            workspace_id=project.workspace_id,
            archived_at__isnull=True,
            is_draft=False,
        ).exists()
    ):
        _reject("ISSUE_UNAVAILABLE")
    return current, current_step, project, actor, version


def _replay(execution, step, method, params_hash, call_index):
    action = WorkflowAction.objects.filter(step=step, index=call_index).first()
    if action:
        if action.execution_id != execution.pk or action.method != method or action.params_hash != params_hash:
            _reject("IDEMPOTENCY_CONFLICT")
        if action.status == "completed":
            return action
        if action.status == "failed":
            if step.attempt > (action.error or {}).get("attempt", step.attempt):
                return None
            raise WorkflowSDKError((action.error or {}).get("code", "ACTION_FAILED"))
        _reject("HTTP_OUTCOME_UNKNOWN" if method == "http" else "ACTION_IN_PROGRESS")
    if WorkflowAction.objects.filter(execution=execution).count() >= MAX_ACTIONS:
        _reject("ACTION_LIMIT")
    last = WorkflowAction.objects.filter(step=step).order_by("-index").values_list("index", flat=True).first() or 0
    if call_index != last + 1:
        _reject("CALL_INDEX_INVALID")
    return None


def _issue(execution, issue_id, *, lock=True):
    issue_id = _uuid(issue_id)
    if execution.actor_id is None and issue_id != execution.issue_id:
        _reject("ACTOR_DENIED")
    qs = Issue.objects.select_for_update() if lock else Issue.objects
    issue = qs.filter(
        pk=issue_id,
        project_id=execution.project_id,
        workspace_id=execution.workspace_id,
        archived_at__isnull=True,
        is_draft=False,
    ).first()
    if not issue:
        _reject("ISSUE_UNAVAILABLE")
    return issue


def _snapshot(issue):
    return {
        "id": str(issue.pk),
        "project_id": str(issue.project_id),
        "name": issue.name,
        "priority": issue.priority,
        "state_id": str(issue.state_id) if issue.state_id else None,
        "type_id": str(issue.type_id) if issue.type_id else None,
        "start_date": issue.start_date.isoformat() if issue.start_date else None,
        "target_date": issue.target_date.isoformat() if issue.target_date else None,
        "label_ids": [str(pk) for pk in issue.labels.order_by("id").values_list("id", flat=True)],
        "updated_at": issue.updated_at.isoformat(),
    }


def _fields(data, *, creating=False, issue=None, project_id=None):
    allowed = CREATE_FIELDS if creating else UPDATE_FIELDS
    if not isinstance(data, dict) or not data or set(data) - allowed:
        _reject("UNSUPPORTED_FIELDS")
    attrs = dict(data)
    if creating or "name" in attrs:
        name = attrs.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > 255:
            _reject("INVALID_PARAMS")
    if "priority" in attrs and (
        not isinstance(attrs["priority"], str)
        or attrs["priority"] not in {value for value, _ in Issue.PRIORITY_CHOICES}
    ):
        _reject("INVALID_PARAMS")
    for field in ("start_date", "target_date"):
        if field in attrs and attrs[field] is not None:
            value = attrs[field]
            if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                _reject("INVALID_PARAMS")
            try:
                attrs[field] = date.fromisoformat(value)
            except ValueError:
                _reject("INVALID_PARAMS")
    start = attrs.get("start_date", issue.start_date if issue else None)
    end = attrs.get("target_date", issue.target_date if issue else None)
    if start and end and start > end:
        _reject("INVALID_DATES")
    for field, model, target in (("state_id", State, "state"), ("type_id", IssueType, "type")):
        if field not in attrs:
            continue
        value = attrs.pop(field)
        if value is None:
            if field == "state_id":
                _reject("INVALID_PARAMS")
            attrs[target] = None
            continue
        qs = model.objects.filter(pk=_uuid(value))
        if field == "state_id":
            qs = qs.filter(project_id=project_id, is_triage=False)
        else:
            qs = qs.filter(is_active=True)
        obj = qs.first()
        if obj is None:
            _reject("INVALID_PARAMS")
        attrs[target] = obj
    return attrs


def _plan(method, payload):
    return {"dry_run": True, "method": method, "plan": payload}


def _internal(execution, project, actor, method, params, prepared):
    if method == "createWorkItem":
        attrs = dict(prepared["attrs"])
        verify_workflow_write(prepared, attrs=attrs, actor=actor)
        validate_hierarchy_write(project.pk, attrs)
        if execution.dry_run:
            payload = {
                key: (
                    str(value.pk) if hasattr(value, "pk") else value.isoformat() if isinstance(value, date) else value
                )
                for key, value in attrs.items()
            }
            return _plan(method, payload)
        issue = Issue(project=project, workspace_id=project.workspace_id, **attrs)
        issue.created_by = actor
        issue.updated_by = actor
        issue.save(disable_auto_set_user=True)
        finish_workflow_write(prepared, issue, actor)
        return _snapshot(issue)
    if method == "getWorkItem":
        if len(params) > 1:
            _reject("INVALID_PARAMS")
        issue = _issue(execution, params[0] if params and params[0] is not None else execution.issue_id)
        from plane.utils.workflow_runner import digest, issue_snapshot

        dependencies = dict(execution.read_dependencies or {})
        snapshot_hash = digest(issue_snapshot(issue))
        previous_hash = dependencies.get(str(issue.pk))
        if execution.phase == "pre" and previous_hash is not None and previous_hash != snapshot_hash:
            _reject("CONTEXT_STALE")
        dependencies[str(issue.pk)] = snapshot_hash
        execution.read_dependencies = dependencies
        execution.save(update_fields=["read_dependencies"], disable_auto_set_user=True)
        return _snapshot(issue)
    if len(params) != 2:
        _reject("INVALID_PARAMS")
    issue = _issue(execution, params[0])
    value = params[1]
    if method == "addComment":
        if not isinstance(value, str) or not value.strip() or len(value.encode()) > MAX_HTTP_BYTES:
            _reject("INVALID_PARAMS")
        if execution.dry_run:
            return _plan(method, {"issue_id": str(issue.pk), "body": value})
        comment = IssueComment(
            project=project,
            workspace_id=project.workspace_id,
            issue=issue,
            actor=actor,
            comment_html=f"<p>{escape(value).replace(chr(10), '<br>')}</p>",
            comment_json={
                "type": "doc",
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": value}]}],
            },
            created_by=actor,
            updated_by=actor,
        )
        comment.save(disable_auto_set_user=True)
        return {"id": str(comment.pk), "issue_id": str(issue.pk)}
    if method in {"addLabels", "removeLabels"}:
        if not isinstance(value, list) or not value or len(value) > 100:
            _reject("INVALID_PARAMS")
        ids = {_uuid(pk) for pk in value}
        labels = list(
            Label.objects.select_for_update().filter(
                pk__in=ids,
                project=project,
                workspace_id=project.workspace_id,
            )
        )
        if {label.pk for label in labels} != ids:
            _reject("LABEL_UNAVAILABLE")
        if execution.dry_run:
            return _plan(method, {"issue_id": str(issue.pk), "label_ids": sorted(str(pk) for pk in ids)})
        if method == "removeLabels":
            IssueLabel.objects.filter(issue=issue, label_id__in=ids).delete()
        else:
            existing = set(IssueLabel.objects.filter(issue=issue).values_list("label_id", flat=True))
            IssueLabel.objects.bulk_create(
                [
                    IssueLabel(
                        project=project,
                        workspace_id=project.workspace_id,
                        issue=issue,
                        label=label,
                        created_by=actor,
                        updated_by=actor,
                    )
                    for label in labels
                    if label.pk not in existing
                ]
            )
        return {"issue_id": str(issue.pk), "label_ids": _snapshot(issue)["label_ids"]}
    if method == "updateWorkItem":
        attrs = dict(prepared["attrs"])
        # Recheck dates against the locked issue, including concurrent partial updates.
        _fields(value, issue=issue, project_id=project.pk)
        verify_workflow_write(prepared, instance=issue, attrs=attrs, actor=actor)
        # A type mutation must preserve both the incoming parent edge and every
        # outgoing child edge, using the final values under Project -> Issue locks.
        if "type" in attrs or "type_id" in attrs:
            validate_hierarchy_write(project.pk, attrs, instance=issue)
        if execution.dry_run:
            return _plan(method, {"issue_id": str(issue.pk), "changes": value})
        for key, item in attrs.items():
            setattr(issue, key, item)
        issue.updated_by = actor
        issue.save(disable_auto_set_user=True)
        finish_workflow_write(prepared, issue, actor)
        return _snapshot(issue)
    _reject("INVALID_PARAMS")


def _origin(url):
    if not isinstance(url, str) or len(url) > 8192 or re.search(r"[\x00-\x20\x7f\\]", url):
        _reject("HTTP_POLICY_DENIED")
    try:
        parts = urlsplit(url)
        if parts.scheme != "https" or not parts.hostname or parts.username is not None or parts.password is not None:
            _reject("HTTP_POLICY_DENIED")
        if "#" in url or parts.fragment or parts.hostname.endswith("."):
            _reject("HTTP_POLICY_DENIED")
        host = parts.hostname.encode("idna").decode().lower()
        host = f"[{host}]" if ":" in host else host
        port = parts.port
        return f"https://{host}" + (f":{port}" if port and port != 443 else "")
    except (ValueError, UnicodeError):
        _reject("HTTP_POLICY_DENIED")


def _http_request(execution, step, version, params):
    if len(params) != 1 or not isinstance(params[0], dict):
        _reject("INVALID_PARAMS")
    request = params[0]
    if set(request) - {"url", "method", "headers", "body", "credential_id"}:
        _reject("INVALID_PARAMS")
    url = request.get("url")
    origin = _origin(url)
    method = request.get("method")
    policy = execution.http_policy
    if (
        not isinstance(policy, dict)
        or policy != step.http_policy
        or (version and policy != version.http_policy)
        or set(policy) - {"origins", "methods", "credential_id"}
    ):
        _reject("HTTP_POLICY_DENIED")
    if (
        not isinstance(method, str)
        or method not in {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
        or not isinstance(policy.get("origins"), list)
        or origin not in policy["origins"]
        or not isinstance(policy.get("methods"), list)
        or method not in policy["methods"]
    ):
        _reject("HTTP_POLICY_DENIED")
    headers = request.get("headers", {})
    if not isinstance(headers, dict) or len(headers) > 16:
        _reject("HTTP_HEADERS_DENIED")
    for key, value in headers.items():
        if (
            not isinstance(key, str)
            or key.lower() not in HTTP_HEADERS
            or not isinstance(value, str)
            or len(value) > 4096
            or re.search(r"[\x00-\x1f\x7f]", value)
        ):
            _reject("HTTP_HEADERS_DENIED")
    headers = dict(headers)
    secret = None
    credential_id = request.get("credential_id")
    if credential_id is not None and credential_id != policy.get("credential_id"):
        _reject("CREDENTIAL_DENIED")
    credential_id = credential_id or policy.get("credential_id")
    if credential_id:
        credential = (
            WorkflowCredential.objects.select_for_update()
            .filter(
                pk=_uuid(credential_id),
                project_id=execution.project_id,
                workspace_id=execution.workspace_id,
            )
            .first()
        )
        if not credential or credential.origin != origin:
            _reject("CREDENTIAL_DENIED")
        name = credential.header_name
        if (
            not HEADER_TOKEN.fullmatch(name)
            or name.lower()
            in {
                "host",
                "cookie",
                "set-cookie",
                "connection",
                "transfer-encoding",
                "content-length",
                "te",
                "trailer",
                "upgrade",
                "forwarded",
                "via",
            }
            or name.lower().startswith(("proxy-", "x-forwarded-"))
        ):
            _reject("CREDENTIAL_DENIED")
        from plane.utils.workflow_runner import decrypt_credential

        secret = decrypt_credential(credential)
        if not isinstance(secret, str) or re.search(r"[\x00-\x1f\x7f]", secret):
            _reject("CREDENTIAL_DENIED")
        headers[name] = secret
    body = request.get("body")
    if body is not None and not isinstance(body, (str, dict, list, int, float, bool)):
        _reject("INVALID_PARAMS")
    return {"url": url, "method": method, "headers": headers, "body": body, "secret": secret}


def _safe_body(raw, request):
    text = raw.decode("utf-8", errors="replace")
    secret = request["secret"]
    secrets = [secret] if secret else []
    if secret and secret.lower().startswith(("bearer ", "basic ")):
        secrets.append(secret.split(" ", 1)[1])
    query = urlsplit(request["url"]).query
    secrets += [value for _, value in parse_qsl(query) if value]
    secrets += [part.split("=", 1)[1] for part in query.split("&") if "=" in part and part.split("=", 1)[1]]
    secrets.sort(key=len, reverse=True)
    for secret in secrets:
        text = text.replace(secret, "[REDACTED]")
    # A response may echo a whole signed URL. Never persist its query string.
    text = re.sub(r"(https://[^\s\"'<>?]+)\?[^\s\"'<>]*", r"\1?[REDACTED]", text)
    try:
        value = json.loads(text)
    except (ValueError, RecursionError):
        text = re.sub(r"(?i)(bearer\s+)[^\s\"<>]+", r"\1[REDACTED]", text)
        text = re.sub(
            r"(?i)((?:password|secret|token|api[_-]?key|cookie|authorization)\s*[:=]\s*)[^\s,;]+", r"\1[REDACTED]", text
        )
    else:

        def redact(item, depth=0):
            if depth > 20:
                return "[TRUNCATED]"
            if isinstance(item, dict):
                return {
                    key: "[REDACTED]" if SENSITIVE_KEY.search(key) else redact(val, depth + 1)
                    for key, val in item.items()
                }
            if isinstance(item, list):
                return [redact(val, depth + 1) for val in item]
            return item

        text = json.dumps(redact(value), ensure_ascii=False)
    return re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", text)[:8192]


def _send_http(request):
    status, body = bounded_http(request)
    return {"status": status, "body": _safe_body(body, request)}


def invoke_sdk(execution, step, method, params, call_index):
    """Dispatch positional JSON SDK arguments, returning JSON or a sanitized SDK error.

    HTTP must be called outside any caller-owned transaction: its running ledger must
    commit before an external effect. Both create/update use the public workflow
    prepare/verify path; arbitrary model fields remain unavailable.
    """
    params_hash = _hash_params(method, params)
    if isinstance(call_index, bool) or not isinstance(call_index, int) or not 1 <= call_index <= MAX_ACTIONS:
        _reject("ACTION_LIMIT")
    prepared = None
    preparation_error = None
    if method in {"createWorkItem", "updateWorkItem"}:
        # A caller-owned outer transaction would retain row locks while prepare waits.
        if connection.in_atomic_block:
            _reject("WORKFLOW_TRANSACTION_BOUNDARY")
        with transaction.atomic():
            current, current_step, project, actor, _ = _lock_context(execution, step, method)
            replay = _replay(current, current_step, method, params_hash, call_index)
            if replay:
                return replay.result
            try:
                creating = method == "createWorkItem"
                if len(params) != (1 if creating else 2):
                    _reject("INVALID_PARAMS")
                issue = None if creating else _issue(current, params[0])
                data = params[0] if creating else params[1]
                attrs = _fields(data, creating=creating, issue=issue, project_id=project.pk)
            except WorkflowSDKError as exc:
                preparation_error = exc
        # Preparing can wait for another Runner; never hold any database locks here.
        if preparation_error is None:
            try:
                prepared = prepare_workflow_write(
                    project.pk,
                    attrs,
                    instance=issue,
                    actor=actor,
                    raw_data=data,
                    context={"runner_depth": current.depth + 1, "runner_dry_run": current.dry_run},
                )
            except APIException:
                preparation_error = WorkflowSDKError("WORKFLOW_VALIDATION_FAILED")
    if method == "http" and connection.in_atomic_block:
        _reject("HTTP_TRANSACTION_BOUNDARY")
    failure = None
    request = None
    with transaction.atomic():
        current, current_step, project, actor, version = _lock_context(execution, step, method)
        replay = _replay(current, current_step, method, params_hash, call_index)
        if replay:
            return replay.result
        action = WorkflowAction.objects.filter(step=current_step, index=call_index).first()
        history = list((action.error or {}).get("attempts", [])) if action else []
        if action is None:
            action = WorkflowAction.objects.create(
                project=project,
                workspace_id=project.workspace_id,
                execution=current,
                step=current_step,
                index=call_index,
                method=method,
                params_hash=params_hash,
            )
        else:
            # _replay only releases a failed row after an explicit step retry.
            action.status, action.result = "running", None
        try:
            # A failed internal action rolls back all its effects but keeps a safe failure ledger.
            with transaction.atomic():
                if preparation_error is not None:
                    raise preparation_error
                if method == "http":
                    request = _http_request(current, current_step, version, params)
                    result = _plan(method, {"origin": _origin(request["url"]), "method": request["method"]})
                else:
                    result = _internal(current, project, actor, method, params, prepared)
        except APIException as exc:
            failure = exc if isinstance(exc, WorkflowSDKError) else WorkflowSDKError("WORKFLOW_VALIDATION_FAILED")
            action.status = "failed"
            history.append({"attempt": current_step.attempt, "code": failure.sdk_code})
            action.error = {"code": failure.sdk_code, "attempt": current_step.attempt, "attempts": history}
        else:
            action.error = {"attempts": history} if history else None
            if method != "http":
                action.status = "completed"
                action.result = result
        action.save(disable_auto_set_user=True)
    if failure:
        raise failure
    if method != "http":
        return result
    if current.dry_run:
        # Even DNS validation runs outside DB locks under the same process deadline.
        try:
            bounded_http(request, validate_only=True)
        except WorkflowHTTPTransportError:
            WorkflowAction.objects.filter(pk=action.pk, status="running").update(
                status="failed",
                error={"code": "HTTP_POLICY_DENIED", "attempt": current_step.attempt},
            )
            raise WorkflowSDKError("HTTP_POLICY_DENIED") from None
        WorkflowAction.objects.filter(pk=action.pk, status="running").update(status="completed", result=result)
        return result
    # Only the thread which inserted running is allowed to send. All replay paths
    # above refuse running/unknown; a crash never causes an automatic second send.
    try:
        # Revalidate after the durable running record commits. In particular a
        # dry-run/pre switch, revoked membership, expired lease or deleted credential
        # in this gap must prevent any network request. No locks cross the socket.
        with transaction.atomic():
            current, current_step, _, _, version = _lock_context(execution, step, method)
            if current.dry_run:
                _reject("EXECUTION_INVALID")
            running = WorkflowAction.objects.filter(pk=action.pk, status="running").first()
            if not running:
                _reject("HTTP_OUTCOME_UNKNOWN")
            request = _http_request(current, current_step, version, params)
        result = _send_http(request)
    except Exception:
        # Transport exceptions can include credentials, full URLs or response bodies.
        WorkflowAction.objects.filter(pk=action.pk, status="running").update(
            status="unknown",
            error={"code": "HTTP_OUTCOME_UNKNOWN"},
        )
        raise WorkflowSDKError("HTTP_OUTCOME_UNKNOWN") from None
    WorkflowAction.objects.filter(pk=action.pk, status="running").update(status="completed", result=result)
    return result
