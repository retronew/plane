"""Project-admin Runner management and the short-lived, token-only SDK broker."""

import hashlib
import json
import re
from collections.abc import Mapping
from uuid import UUID, uuid4

from django.core import signing
from django.db import transaction
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from plane.app.views.project.workflow import WorkflowBaseView
from plane.db.models import Issue
from plane.db.models.workflow import WorkflowTransition
from plane.db.models.workflow_runner import (
    WorkflowCredential,
    WorkflowExecution,
    WorkflowExecutionStep,
    WorkflowScript,
    WorkflowScriptVersion,
)
from plane.services.workflow_sdk import invoke_sdk
from plane.utils import workflow_runner as runner

MAX_RPC_CALLS = 20
MAX_JSON_BYTES = 256 * 1024
HEADER_TOKEN = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")


class StrictStringField(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictUUIDField(serializers.UUIDField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictListField(serializers.ListField):
    def to_internal_value(self, data):
        if not isinstance(data, list):
            self.fail("not_a_list", input_type=type(data).__name__)
        return super().to_internal_value(data)


class ObjectField(serializers.JSONField):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            self.fail("invalid")
        try:
            encoded = json.dumps(data, allow_nan=False).encode()
        except (TypeError, ValueError, UnicodeError, RecursionError):
            self.fail("invalid")
        if len(encoded) > MAX_JSON_BYTES:
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            raise ValidationError({"detail": "Expected a JSON object."})
        unknown = set(data) - set(self.fields)
        if unknown:
            raise ValidationError({str(field): "Unknown field." for field in unknown})
        return super().to_internal_value(data)


class HTTPPolicySerializer(StrictSerializer):
    origins = StrictListField(child=StrictStringField(trim_whitespace=False), max_length=20, required=False)
    methods = StrictListField(child=StrictStringField(trim_whitespace=False), max_length=8, required=False)
    credential_id = StrictUUIDField(required=False)

    def to_internal_value(self, data):
        result = super().to_internal_value(data)
        if "credential_id" in result:
            result["credential_id"] = str(result["credential_id"])
        return result


class ScriptMetadataSerializer(StrictSerializer):
    name = StrictStringField(max_length=255)
    description = StrictStringField(required=False, default="", allow_blank=True)


class ScriptVersionSerializer(StrictSerializer):
    source = StrictStringField(trim_whitespace=False, max_length=65536)
    capabilities = StrictListField(child=StrictStringField(trim_whitespace=False), max_length=7)
    http_policy = HTTPPolicySerializer()

    def validate(self, attrs):
        try:
            attrs["capabilities"], attrs["http_policy"] = runner.validate_script(
                self.context["project"], attrs["source"], attrs["capabilities"], attrs["http_policy"]
            )
        except UnicodeError:
            raise ValidationError({"source": "WORKFLOW_INVALID_SCRIPT"}) from None
        return attrs


class ScriptCreateSerializer(ScriptVersionSerializer, ScriptMetadataSerializer):
    pass


class TestContextSerializer(StrictSerializer):
    before = ObjectField(required=False, allow_null=True)
    proposed = ObjectField(required=False, allow_null=True)
    after = ObjectField(required=False, allow_null=True)
    work_item = ObjectField(required=False, allow_null=True)
    metadata = ObjectField(required=False, allow_null=True)


class ScriptTestSerializer(ScriptVersionSerializer):
    phase = serializers.ChoiceField(choices=("pre", "post"))
    issue_id = StrictUUIDField(required=False, allow_null=True)
    context = TestContextSerializer(required=False, default=dict)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs["phase"] == "pre" and set(attrs["capabilities"]) - {"getWorkItem"}:
            raise ValidationError({"capabilities": "WORKFLOW_PRECONDITION_READ_ONLY"})
        return attrs


class ExecutionResolutionSerializer(StrictSerializer):
    resolution = serializers.ChoiceField(choices=("completed", "abandoned"))
    note = StrictStringField(max_length=1000)


class CredentialSerializer(StrictSerializer):
    name = StrictStringField(max_length=255)
    secret = StrictStringField(max_length=8192, trim_whitespace=False, write_only=True)
    header_name = StrictStringField(max_length=100, default="Authorization", trim_whitespace=False)
    origin = StrictStringField(max_length=2048, trim_whitespace=False)

    def validate_header_name(self, value):
        if (
            not HEADER_TOKEN.fullmatch(value)
            or value.lower()
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
            or value.lower().startswith(("proxy-", "x-forwarded-"))
        ):
            raise ValidationError("WORKFLOW_INVALID_CREDENTIAL")
        return value

    def validate_secret(self, value):
        if re.search(r"[\x00-\x1f\x7f]", value):
            raise ValidationError("WORKFLOW_INVALID_CREDENTIAL")
        return value

    def validate_origin(self, value):
        if re.search(r"[\x00-\x20\x7f\\\\]", value):
            raise ValidationError("WORKFLOW_INVALID_CREDENTIAL")
        return runner.validate_http_policy(self.context["project"], {"origins": [value]})["origins"][0]


def version_json(version):
    return {
        "id": version.id,
        "version": version.version,
        "source": version.source,
        "capabilities": version.capabilities,
        "http_policy": version.http_policy,
        "created_at": version.created_at,
    }


def script_json(script):
    return {
        "id": script.id,
        "name": script.name,
        "description": script.description,
        "versions": [version_json(version) for version in script.versions.all()],
    }


def credential_json(credential):
    # Keep this explicit: ModelSerializer or __dict__ could expose the ciphertext/key.
    return {
        "id": credential.id,
        "name": credential.name,
        "header_name": credential.header_name,
        "origin": credential.origin,
        "created_at": credential.created_at,
    }


def execution_json(execution):
    return {
        "id": execution.id,
        "status": execution.status,
        "phase": execution.phase,
        "outcome": execution.outcome,
        "issue_id": execution.issue_id,
        "attempt": execution.attempt,
        "dry_run": execution.dry_run,
        "draft_hash": execution.draft_hash,
        "created_at": execution.created_at,
        "started_at": execution.started_at,
        "finished_at": execution.finished_at,
        "error": execution.error,
        "logs": execution.logs,
        "actions": [
            {
                "id": action.id,
                "method": action.method,
                "status": action.status,
                "result": action.result,
                "error": action.error,
            }
            for action in execution.actions.all()
        ],
        "steps": [
            {
                "id": step.id,
                "script_version_id": step.script_version_id,
                "index": step.index,
                "status": step.status,
                "result": step.result,
                "error": step.error,
                "logs": step.logs,
                "history": step.history,
            }
            for step in execution.steps.all()
        ],
        "can_retry": runner.can_retry_execution(execution),
    }


def publish_version(project, script, data):
    # The caller holds both project/script locks. Versions are append-only, including
    # any historical soft-deleted version numbers.
    latest = WorkflowScriptVersion.all_objects.filter(script=script).aggregate(latest=Max("version"))["latest"] or 0
    return WorkflowScriptVersion.objects.create(
        project=project,
        script=script,
        version=latest + 1,
        source=data["source"],
        source_hash=hashlib.sha256(data["source"].encode()).hexdigest(),
        capabilities=data["capabilities"],
        http_policy=data["http_policy"],
    )


class RunnerAdminView(WorkflowBaseView):
    parser_classes = [JSONParser]

    def admin_project(self, request, slug, project_id, *, write=False):
        project, can_manage = self.project(request, slug, project_id, write=write)
        if not can_manage:
            raise PermissionDenied()
        return project

    def execution(self, project, pk):
        return get_object_or_404(
            WorkflowExecution.objects.filter(project=project).prefetch_related("steps", "actions"), pk=pk
        )


class WorkflowScriptEndpoint(RunnerAdminView):
    http_method_names = ["get", "post", "head", "options"]

    def get(self, request, slug, project_id, pk=None):
        project = self.admin_project(request, slug, project_id)
        scripts = WorkflowScript.objects.filter(project=project).prefetch_related("versions").order_by("name", "id")
        if pk is not None:
            return Response(script_json(get_object_or_404(scripts, pk=pk)))
        return Response([script_json(script) for script in scripts])

    @transaction.atomic
    def post(self, request, slug, project_id):
        project = self.admin_project(request, slug, project_id, write=True)
        serializer = ScriptCreateSerializer(data=request.data, context={"project": project})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if WorkflowScript.objects.filter(project=project, name=data["name"]).exists():
            raise ValidationError({"name": "WORKFLOW_DUPLICATE_SCRIPT"})
        script = WorkflowScript.objects.create(project=project, name=data["name"], description=data["description"])
        publish_version(project, script, data)
        return Response(script_json(script), status=status.HTTP_201_CREATED)

    @transaction.atomic
    def patch(self, request, slug, project_id, pk):
        project = self.admin_project(request, slug, project_id, write=True)
        script = get_object_or_404(WorkflowScript.objects.select_for_update(), project=project, pk=pk)
        serializer = ScriptMetadataSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "name" in data and WorkflowScript.objects.filter(project=project, name=data["name"]).exclude(pk=pk).exists():
            raise ValidationError({"name": "WORKFLOW_DUPLICATE_SCRIPT"})
        for key, value in data.items():
            setattr(script, key, value)
        script.save()
        return Response(script_json(script))

    @transaction.atomic
    def delete(self, request, slug, project_id, pk):
        project = self.admin_project(request, slug, project_id, write=True)
        script = get_object_or_404(WorkflowScript.objects.select_for_update(), project=project, pk=pk)
        version_ids = {str(pk) for pk in script.versions.values_list("id", flat=True)}
        rules = WorkflowTransition.objects.filter(project=project, workflow__deleted_at__isnull=True)
        for steps in rules.values_list("steps", flat=True):
            if any(isinstance(step, dict) and str(step.get("script_version_id")) in version_ids for step in steps):
                raise ValidationError({"workflow": "WORKFLOW_SCRIPT_IN_USE"})
        # Retain immutable versions and execution references; never cascade deletion.
        WorkflowScript.objects.filter(pk=script.pk).update(deleted_at=timezone.now(), updated_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowScriptDetailEndpoint(WorkflowScriptEndpoint):
    http_method_names = ["get", "patch", "delete", "head", "options"]


class WorkflowScriptVersionEndpoint(RunnerAdminView):
    @transaction.atomic
    def post(self, request, slug, project_id, pk):
        project = self.admin_project(request, slug, project_id, write=True)
        script = get_object_or_404(WorkflowScript.objects.select_for_update(), project=project, pk=pk)
        serializer = ScriptVersionSerializer(data=request.data, context={"project": project})
        serializer.is_valid(raise_exception=True)
        version = publish_version(project, script, serializer.validated_data)
        return Response(version_json(version), status=status.HTTP_201_CREATED)


class WorkflowScriptTestEndpoint(RunnerAdminView):
    def post(self, request, slug, project_id):
        # Only draft persistence is atomic. The Runner and its HTTP callbacks must
        # execute after this transaction has committed and released all locks.
        with transaction.atomic():
            project = self.admin_project(request, slug, project_id, write=True)
            serializer = ScriptTestSerializer(data=request.data, context={"project": project})
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            issue = None
            if data.get("issue_id"):
                issue = get_object_or_404(
                    Issue.objects,
                    pk=data["issue_id"],
                    project=project,
                    workspace_id=project.workspace_id,
                    archived_at__isnull=True,
                    is_draft=False,
                )
            before = runner.issue_snapshot(issue)
            test_context = data["context"]
            simulated_before = test_context.get("before", before)
            proposed = test_context.get("proposed", {})
            after = {**(simulated_before or {}), **(proposed or {})}
            context = {
                "work_item": before if issue else test_context.get("work_item", simulated_before),
                "before": simulated_before,
                "after": test_context.get("after", after),
                "proposed": proposed,
                "flow": None,
                "actor": {"id": str(request.user.pk), "name": request.user.display_name},
                "project_id": str(project.pk),
                "outcome": "transition",
                "metadata": test_context.get("metadata", {}),
            }
            snapshot = {
                "source": data["source"],
                "phase": data["phase"],
                "context": context,
                "capabilities": data["capabilities"],
                "http_policy": data["http_policy"],
            }
            execution = WorkflowExecution.objects.create(
                project=project,
                issue=issue,
                actor=request.user,
                phase=data["phase"],
                dry_run=True,
                draft_hash=runner.digest(snapshot),
                context=context,
                policy_version=project.workflow_version,
                capabilities=data["capabilities"],
                http_policy=data["http_policy"],
            )
            WorkflowExecutionStep.objects.create(
                project=project,
                execution=execution,
                index=0,
                source=data["source"],
                capabilities=data["capabilities"],
                http_policy=data["http_policy"],
            )
        runner.execute_workflow_run(execution.pk)
        return Response(execution_json(self.execution(project, execution.pk)))


class WorkflowExecutionEndpoint(RunnerAdminView):
    def get(self, request, slug, project_id, pk=None):
        project = self.admin_project(request, slug, project_id)
        if pk is not None:
            return Response(execution_json(self.execution(project, pk)))
        executions = WorkflowExecution.objects.filter(project=project).prefetch_related("steps", "actions")
        issue_id = request.query_params.get("issue_id")
        if issue_id is not None:
            issue_id = StrictUUIDField().run_validation(issue_id)
            executions = executions.filter(issue_id=issue_id)
        workflow_id = request.query_params.get("workflow_id")
        if workflow_id is not None:
            workflow_id = StrictUUIDField().run_validation(workflow_id)
            executions = executions.filter(
                Q(rule__workflow_id=workflow_id) | Q(context__flow__workflow_id=str(workflow_id))
            )
        raw_offset = request.query_params.get("offset", "0")
        if not re.fullmatch(r"[0-9]{1,9}", raw_offset):
            raise ValidationError({"offset": "Invalid offset."})
        offset = int(raw_offset)
        count = executions.count()
        executions = executions.order_by("-created_at", "-id")[offset : offset + 25]
        return Response(
            {
                "results": [execution_json(execution) for execution in executions],
                "count": count,
                "next_offset": offset + 25 if count > offset + 25 else None,
            }
        )


class WorkflowExecutionRetryEndpoint(RunnerAdminView):
    def post(self, request, slug, project_id, pk):
        with transaction.atomic():
            project = self.admin_project(request, slug, project_id, write=True)
            execution = self.execution(project, pk)
            execution = runner.retry_execution(execution)
        return Response(execution_json(self.execution(project, execution.pk)))


class WorkflowExecutionResolveEndpoint(RunnerAdminView):
    @transaction.atomic
    def post(self, request, slug, project_id, pk):
        project = self.admin_project(request, slug, project_id, write=True)
        serializer = ExecutionResolutionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        execution = get_object_or_404(WorkflowExecution.objects.select_for_update(), project=project, pk=pk)
        steps = list(execution.steps.select_for_update())
        actions = list(execution.actions.select_for_update(of=("self",)))
        if (
            execution.status != "unknown"
            or any(step.status == "running" for step in steps)
            or any(action.status == "running" for action in actions)
        ):
            raise ValidationError({"workflow": "WORKFLOW_EXECUTION_NOT_RESOLVABLE"})
        now = timezone.now()
        audit = {
            "code": "WORKFLOW_EXECUTION_RESOLVED",
            "resolution": data["resolution"],
            "note": data["note"],
            "actor": str(request.user.pk),
            "at": now.isoformat(),
        }
        for action in actions:
            if action.status != "unknown":
                continue
            action.status = "completed" if data["resolution"] == "completed" else "failed"
            action.result = (
                {"manually_resolved": True, "resolution": "completed"} if action.status == "completed" else None
            )
            action.error = None if action.status == "completed" else audit
            action.save(update_fields=["status", "result", "error", "updated_at"])
        for step in steps:
            if step.status != "succeeded":
                step.status, step.finished_at = "cancelled", now
                step.save(update_fields=["status", "finished_at", "updated_at"])
        # Confirming one external action cannot claim the remaining script ran.
        # End this execution permanently; only later queued events may proceed.
        execution.status, execution.finished_at, execution.error = "cancelled", now, audit
        execution.lease, execution.lease_expires_at = uuid4(), None
        execution.save(update_fields=["status", "finished_at", "error", "lease", "lease_expires_at", "updated_at"])
        return Response(execution_json(self.execution(project, execution.pk)))


class WorkflowCredentialEndpoint(RunnerAdminView):
    http_method_names = ["get", "post", "head", "options"]

    def get(self, request, slug, project_id):
        project = self.admin_project(request, slug, project_id)
        credentials = WorkflowCredential.objects.filter(project=project).order_by("name", "id")
        return Response([credential_json(credential) for credential in credentials])

    @transaction.atomic
    def post(self, request, slug, project_id):
        project = self.admin_project(request, slug, project_id, write=True)
        serializer = CredentialSerializer(data=request.data, context={"project": project})
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if WorkflowCredential.objects.filter(project=project, name=data["name"]).exists():
            raise ValidationError({"name": "WORKFLOW_DUPLICATE_CREDENTIAL"})
        ciphertext, key_id = runner.encrypt_credential(data.pop("secret"))
        credential = WorkflowCredential.objects.create(
            project=project, encrypted_secret=ciphertext, key_id=key_id, **data
        )
        return Response(credential_json(credential), status=status.HTTP_201_CREATED)

    @transaction.atomic
    def delete(self, request, slug, project_id, pk):
        project = self.admin_project(request, slug, project_id, write=True)
        credential = get_object_or_404(WorkflowCredential.objects.select_for_update(), project=project, pk=pk)
        WorkflowCredential.objects.filter(pk=credential.pk).update(deleted_at=timezone.now(), updated_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowCredentialDetailEndpoint(WorkflowCredentialEndpoint):
    http_method_names = ["delete", "options"]


def rpc_error(request_id, code):
    return Response(
        {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {"code": -32000, "message": "Workflow SDK request rejected.", "data": {"code": code}},
        }
    )


class WorkflowRunnerRPCEndpoint(APIView):
    authentication_classes = []
    permission_classes = []
    parser_classes = [JSONParser]
    # Internal callbacks use primary rows, including lease changes just committed.
    throttle_classes = []

    def handle_exception(self, exc):
        # Parsing/DRF errors must also use the same non-reflective JSON-RPC envelope.
        return rpc_error(None, "INVALID_REQUEST")

    def post(self, request):
        request_id = None
        try:
            body = request.data
            if not isinstance(body, dict):
                return rpc_error(None, "INVALID_REQUEST")
            candidate = body.get("id")
            if type(candidate) is not int or not 1 <= candidate <= MAX_RPC_CALLS:
                return rpc_error(None, "INVALID_REQUEST")
            request_id = candidate
            if (
                set(body) != {"jsonrpc", "id", "method", "params"}
                or body.get("jsonrpc") != "2.0"
                or not isinstance(body["method"], str)
                or body["method"] not in runner.CAPABILITIES
                or not isinstance(body["params"], list)
            ):
                return rpc_error(request_id, "INVALID_REQUEST")
            if len(json.dumps(body["params"], allow_nan=False).encode()) > 65536:
                return rpc_error(request_id, "INVALID_REQUEST")
            execution, step = self.token_context(request)
            # Replay of a recorded index is handled by the SDK's parameter hash.
            # Check again under the SDK's locks to close concurrent-call races.
            indexes = list(step.actions.values_list("index", flat=True))
            if request_id not in indexes and request_id != max(indexes, default=0) + 1:
                return rpc_error(request_id, "INVALID_CALL_INDEX")
            result = invoke_sdk(execution, step, body["method"], body["params"], request_id)
            return Response({"jsonrpc": "2.0", "id": request_id, "result": result})
        except APIException as exc:
            code = getattr(exc, "sdk_code", None)
            return rpc_error(
                request_id,
                code if isinstance(code, str) and re.fullmatch(r"[A-Z0-9_]{1,80}", code) else "SDK_REQUEST_REJECTED",
            )
        except (signing.BadSignature, ValueError, TypeError, UnicodeError, RecursionError):
            return rpc_error(request_id, "INVALID_REQUEST")
        except Exception:
            # Do not reflect exception strings, SQL, headers, URLs or token contents.
            return rpc_error(request_id, "SDK_REQUEST_FAILED")

    def token_context(self, request):
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer ") or len(authorization) > 8192:
            raise PermissionDenied()
        payload = signing.loads(authorization[7:], salt=runner.TOKEN_SALT, max_age=120)
        keys = {"execution", "step", "lease", "step_lease"}
        if not isinstance(payload, dict) or set(payload) != keys:
            raise PermissionDenied()
        ids = {key: UUID(payload[key]) for key in keys}
        execution = WorkflowExecution.objects.filter(pk=ids["execution"]).first()
        step = WorkflowExecutionStep.objects.filter(pk=ids["step"], execution_id=ids["execution"]).first()
        if (
            execution is None
            or step is None
            or execution.status != "running"
            or step.status != "running"
            or execution.lease != ids["lease"]
            or step.lease != ids["step_lease"]
            or execution.lease_expires_at is None
            or execution.lease_expires_at <= timezone.now()
            or step.project_id != execution.project_id
            or step.workspace_id != execution.workspace_id
            or step.attempt != execution.attempt
        ):
            raise PermissionDenied()
        header_id = request.headers.get("X-Workflow-Execution-Id")
        if header_id is not None and header_id != str(execution.pk):
            raise PermissionDenied()
        return execution, step
