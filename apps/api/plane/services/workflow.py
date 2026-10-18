"""Configuration snapshots and explicit administrative migration previews."""

import hashlib
import json

from django.core import signing
from django.utils import timezone

from plane.db.models import Issue, IssueActivity, ProjectIssueType, State
from plane.db.models.workflow import ProjectWorkflow, WorkflowActivity, WorkflowApproval, WorkflowTransition
from plane.services.workflow_approval import cancel_approvals, sync_issue_approval
from plane.utils.workflow import resolve_issue_workflow, workflow_conflict, workflow_error, workflow_states


def record_workflow_activity(project, workflow, action, before=None, after=None, **legacy):
    return WorkflowActivity.objects.create(
        project=project,
        workflow=workflow,
        workflow_name=workflow.name if workflow else "",
        action=action,
        data={"schema_version": 2, "before": before, "after": after, **legacy},
    )


def bump_policy(project, workflow=None, reason="policy_changed"):
    project.workflow_version += 1
    project.save(update_fields=["workflow_version", "updated_at"])
    if workflow:
        workflow.version += 1
        workflow.save(update_fields=["version", "updated_at"])
    cancel_approvals(project.pk, workflow_id=workflow.pk if workflow else None, reason=reason)


def workflow_issues(project, workflow):
    bound = ProjectIssueType.objects.filter(project=project, workflow=workflow).values("issue_type_id")
    issues = Issue.objects.filter(project=project, is_draft=False, archived_at__isnull=True)
    if workflow.is_default:
        other = (
            ProjectIssueType.objects.filter(project=project, workflow__isnull=False)
            .exclude(workflow=workflow)
            .values("issue_type_id")
        )
        return issues.exclude(type_id__in=other)
    return issues.filter(type_id__in=bound)


def preview_migration(project, data):
    operation = data.get("operation")
    if operation not in ("bind_type", "states", "delete", "enable", "remove_type"):
        workflow_error("WORKFLOW_INVALID_OPERATION")
    workflow = None
    if data.get("workflow_id"):
        workflow = ProjectWorkflow.objects.filter(project=project, pk=data["workflow_id"]).first()
        if not workflow:
            workflow_error("WORKFLOW_INVALID_WORKFLOW")
    binding = None
    disabling = operation == "enable" and data.get("enabled", project.workflow_enabled) is False
    if operation == "enable" and workflow is not None and data.get("is_active", workflow.is_active) is False:
        disabling = True
    if disabling and data.get("state_mapping"):
        workflow_error("WORKFLOW_DISABLE_DOES_NOT_MAP_STATES")
    if operation in ("bind_type", "remove_type"):
        binding = ProjectIssueType.objects.filter(project=project, issue_type_id=data.get("type_id")).first()
        if not binding:
            workflow_error("WORKFLOW_INVALID_TYPE")
        if operation == "remove_type" and binding.is_default:
            workflow_error("WORKFLOW_DEFAULT_PROTECTED")
        if operation == "remove_type" and project.hierarchy_enabled:
            from plane.services.hierarchy import hierarchy_error

            remaining = set(
                ProjectIssueType.objects.filter(project=project).exclude(pk=binding.pk).values_list("level", flat=True)
            ) | {0}
            if project.hierarchy_default_level not in remaining or sorted(remaining) != list(range(len(remaining))):
                hierarchy_error("HIERARCHY_PREVIEW_REQUIRED")
        issues = Issue.objects.filter(
            project=project, type_id=binding.issue_type_id, is_draft=False, archived_at__isnull=True
        )
        target_workflow = (
            workflow
            if operation == "bind_type"
            else ProjectWorkflow.objects.filter(project=project, is_default=True).first()
        )
        target_states = workflow_states(project.pk, target_workflow)
    elif operation in ("states", "delete"):
        if not workflow or workflow.is_default:
            workflow_error("WORKFLOW_DEFAULT_PROTECTED")
        issues = workflow_issues(project, workflow)
        if operation == "states":
            ids = set(map(str, data.get("state_ids", [])))
            target_states = State.objects.filter(project=project, is_triage=False, pk__in=ids)
            if not ids or set(map(str, target_states.values_list("id", flat=True))) != ids:
                workflow_error("WORKFLOW_INVALID_STATE")
            if workflow.initial_state_id and str(workflow.initial_state_id) not in ids:
                workflow_error("WORKFLOW_STATE_IN_USE")
            if (
                WorkflowTransition.objects.filter(workflow=workflow).exclude(source_id__in=ids).exists()
                or WorkflowTransition.objects.filter(workflow=workflow).exclude(destination_id__in=ids).exists()
                or WorkflowTransition.objects.filter(workflow=workflow, reject_state__isnull=False)
                .exclude(reject_state_id__in=ids)
                .exists()
            ):
                workflow_error("WORKFLOW_STATE_IN_USE")
            if not target_states.exclude(id__in=workflow.restricted_creation_states.values("id")).exists():
                workflow_error("WORKFLOW_NO_CREATION_STATE")
            target_workflow = workflow
        else:
            target_workflow = ProjectWorkflow.objects.filter(project=project, is_default=True).first()
            target_states = workflow_states(project.pk, target_workflow)
    else:
        issues = (
            workflow_issues(project, workflow)
            if workflow
            else Issue.objects.filter(project=project, is_draft=False, archived_at__isnull=True)
        )
        target_workflow = workflow
        target_states = workflow_states(project.pk, workflow)
        targets = [workflow] if workflow else list(ProjectWorkflow.objects.filter(project=project))
        for target in targets:
            if (
                not disabling
                and not workflow_states(project.pk, target)
                .exclude(pk__in=target.restricted_creation_states.values("id"))
                .exists()
            ):
                workflow_error("WORKFLOW_NO_CREATION_STATE")
    valid_ids = set(map(str, target_states.values_list("id", flat=True)))
    # Enabling the project may resolve each issue to a different typed workflow.
    rows = list(issues.order_by("id").values("id", "name", "state_id", "type_id", "updated_at"))
    mapping = {str(k): str(v) for k, v in data.get("state_mapping", {}).items()}
    required = set()
    for row in rows:
        if disabling:
            continue
        row_valid = valid_ids
        if operation == "enable" and workflow is None:
            row_workflow = resolve_issue_workflow(project.pk, row["type_id"])
            row_valid = set(map(str, workflow_states(project.pk, row_workflow).values_list("id", flat=True)))
        source = str(row["state_id"])
        if row["state_id"] and source not in row_valid:
            required.add(source)
        if source in mapping and mapping[source] not in row_valid:
            workflow_error("WORKFLOW_INVALID_STATE_MAPPING")
    if operation != "enable" and not set(mapping.values()).issubset(valid_ids):
        workflow_error("WORKFLOW_INVALID_STATE_MAPPING")
    required = sorted(required)
    count = WorkflowApproval.objects.filter(
        project=project, status="pending", issue_id__in=[r["id"] for r in rows]
    ).count()
    payload = {k: v for k, v in data.items() if k != "token"}
    fingerprint = hashlib.sha256(
        json.dumps(
            {"policy": project.workflow_version, "input": payload, "issues": rows}, sort_keys=True, default=str
        ).encode()
    ).hexdigest()
    result = {
        "policy_version": project.workflow_version,
        "affected_count": len(rows),
        "examples": [
            {k: str(v) if v is not None else None for k, v in row.items() if k != "updated_at"} for row in rows[:10]
        ],
        "required_state_ids": required,
        "invalidated_approval_count": count,
        "state_mapping": mapping,
        "warnings": ["WORKFLOW_ADMIN_MIGRATION_SKIPS_SCRIPTS"],
    }
    result["token"] = signing.dumps({"project": str(project.pk), "fingerprint": fingerprint}, salt="workflow-preview")
    return result, rows, workflow, binding, target_workflow


def apply_migration(project, data, actor):
    preview, rows, workflow, binding, target_workflow = preview_migration(project, data)
    try:
        supplied = signing.loads(data.get("token", ""), salt="workflow-preview", max_age=1800)
        expected = signing.loads(preview["token"], salt="workflow-preview")
    except signing.BadSignature:
        workflow_conflict("WORKFLOW_PREVIEW_STALE")
    if supplied != expected:
        workflow_conflict("WORKFLOW_PREVIEW_STALE")
    if any(state_id not in preview["state_mapping"] for state_id in preview["required_state_ids"]):
        workflow_error("WORKFLOW_STATE_MAPPING_REQUIRED")
    operation = data["operation"]
    cancel_approvals(project.pk, issue_ids=[row["id"] for row in rows], reason="admin_migration")
    if operation == "bind_type":
        binding.workflow = workflow
        binding.save()
    elif operation == "remove_type":
        # Type removal changes the effective level to zero. It must never silently
        # break incoming or outgoing hierarchy edges, including archived items/drafts.
        from plane.db.models import DraftIssue
        from plane.services.hierarchy import validate_hierarchy_write

        for issue in Issue.objects.filter(project=project, type_id=binding.issue_type_id).order_by("id"):
            validate_hierarchy_write(project.pk, {"type": None}, issue)
        for draft in DraftIssue.objects.filter(project=project, type_id=binding.issue_type_id).order_by("id"):
            validate_hierarchy_write(project.pk, {"type": None}, draft)
        # Preserve the shared workspace IssueType; only unlink this project.
        Issue.objects.filter(project=project, type_id=binding.issue_type_id).update(type=None)
        DraftIssue.objects.filter(project=project, type_id=binding.issue_type_id).update(type=None)
        binding.delete(soft=False)
    elif operation == "states":
        workflow.states.set(data["state_ids"])
    elif operation == "delete":
        ProjectIssueType.objects.filter(workflow=workflow).update(workflow=None)
        WorkflowTransition.objects.filter(workflow=workflow).delete(soft=False)
        workflow.deleted_at = timezone.now()
        workflow.save()
    elif operation == "enable":
        if workflow and "is_active" in data:
            workflow.is_active = data["is_active"]
            workflow.save()
        if "enabled" in data:
            project.workflow_enabled = data["enabled"]
            project.save(update_fields=["workflow_enabled", "updated_at"])
            ProjectWorkflow.objects.filter(project=project, is_default=True).update(enabled=project.workflow_enabled)
            if workflow and workflow.is_default:
                workflow.enabled = project.workflow_enabled
    bump_policy(project, workflow)
    if operation == "enable" and "enabled" in data:
        cancel_approvals(project.pk, reason="project_switch_changed")
    for row in rows:
        issue = Issue.objects.select_for_update().get(pk=row["id"])
        before = {"state_id": str(row["state_id"]), "type_id": str(row["type_id"]) if row["type_id"] else None}
        mapped = preview["state_mapping"].get(str(issue.state_id))
        if mapped:
            issue.state_id = mapped
            issue.save()
        after = {"state_id": str(issue.state_id), "type_id": str(issue.type_id) if issue.type_id else None}
        IssueActivity.objects.create(
            project=project,
            issue=issue,
            actor=actor,
            field="workflow",
            verb="updated",
            old_value=json.dumps(before),
            new_value=json.dumps(after),
            comment="Administrative workflow migration",
        )
        sync_issue_approval(issue, actor=actor)
    record_workflow_activity(
        project,
        workflow,
        "migration",
        before={"operation": operation},
        after={"affected_count": len(rows), "state_mapping": preview["state_mapping"]},
    )
    return preview, workflow if workflow and operation != "delete" else None
