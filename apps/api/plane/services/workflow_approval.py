"""Approval snapshots and decisions. All writes use project -> issue -> approval locks."""

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from plane.db.models import Issue, IssueActivity, Notification, Project
from plane.db.models.workflow import WorkflowApproval, WorkflowTransition
from plane.utils.workflow import (
    _eligible_actor,
    eligible_workflow_members,
    resolve_issue_workflow,
    workflow_conflict,
    workflow_error,
    workflow_is_enforced,
)


def member_snapshot(member):
    return {"id": str(member.pk), "name": member.display_name or member.first_name or member.email}


def state_snapshot(state):
    return {"id": str(state.pk), "name": state.name} if state else None


def transition_snapshot(rule, approval=False):
    members = list(rule.members.all().order_by("id"))
    approvers = list(rule.approvers.all().order_by("id"))
    if approval and rule.approver_mode == "all":
        approvers = [row.member for row in eligible_workflow_members(rule.project).order_by("member_id")]
    return {
        "id": str(rule.id),
        "version": rule.version,
        "source": state_snapshot(rule.source),
        "destination": state_snapshot(rule.destination),
        "source_id": str(rule.source_id),
        "destination_id": str(rule.destination_id),
        "kind": rule.kind,
        "reject_state": state_snapshot(rule.reject_state),
        "reject_state_id": str(rule.reject_state_id) if rule.reject_state_id else None,
        "member_mode": "explicit" if members else "all",
        "members": [member_snapshot(m) for m in members],
        "member_ids": [str(m.pk) for m in members],
        "approver_mode": rule.approver_mode,
        "approvers": [member_snapshot(m) for m in approvers],
        "steps": rule.steps,
    }


def branch_matches(rule, branch):
    # Display names and All membership are immutable entry snapshots. A newly joined
    # member does not become an approver for an existing request.
    return (
        str(rule.pk) == branch["id"]
        and rule.version == branch["version"]
        and str(rule.source_id) == branch["source_id"]
        and str(rule.destination_id) == branch["destination_id"]
        and (str(rule.reject_state_id) if rule.reject_state_id else None) == branch["reject_state_id"]
        and rule.kind == branch["kind"]
        and rule.approver_mode == branch["approver_mode"]
        and rule.steps == branch["steps"]
        and set(map(str, rule.members.values_list("pk", flat=True))) == set(branch["member_ids"])
        and (
            rule.approver_mode == "all"
            or set(map(str, rule.approvers.values_list("pk", flat=True))) == {p["id"] for p in branch["approvers"]}
        )
    )


def cancel_approvals(project_id, workflow_id=None, issue_ids=None, reason="policy_changed"):
    pending = WorkflowApproval.objects.filter(project_id=project_id, status="pending")
    if workflow_id is not None:
        pending = pending.filter(workflow_id=workflow_id)
    if issue_ids is not None:
        pending = pending.filter(issue_id__in=issue_ids)
    from django.db.models import F

    return pending.update(
        status="cancelled", invalidation_reason=reason, version=F("version") + 1, updated_at=timezone.now()
    )


def _activity(issue, approval, actor, action):
    IssueActivity.objects.create(
        project_id=issue.project_id,
        workspace_id=issue.workspace_id,
        issue=issue,
        actor=actor,
        field="approval",
        verb=action,
        new_value=approval.status,
        new_identifier=approval.pk,
        comment=f"Approval {action}",
    )


def sync_issue_approval(issue, actor=None, force=False):
    """Call inside the final write transaction with the project and issue locked."""
    workflow = resolve_issue_workflow(issue.project_id, issue.type_id)
    pending = WorkflowApproval.objects.filter(issue=issue, status="pending").first()
    eligible = not issue.is_draft and issue.archived_at is None and workflow_is_enforced(issue.project_id, workflow)
    rules = (
        list(
            WorkflowTransition.objects.filter(workflow=workflow, source_id=issue.state_id, kind="approval")
            .select_related("source", "destination", "reject_state", "project")
            .prefetch_related("members", "approvers")
            .order_by("id")
        )
        if eligible
        else []
    )
    branches = [transition_snapshot(rule, approval=True) for rule in rules]
    if pending:
        same = (
            pending.workflow_id == getattr(workflow, "pk", None)
            and pending.source_id == issue.state_id
            and len(pending.branches) == len(rules)
            and all(branch_matches(rule, branch) for rule, branch in zip(rules, pending.branches, strict=True))
        )
        if same and not force:
            return pending
        pending.status = "cancelled"
        pending.version += 1
        pending.invalidation_reason = "reapplied" if force else "context_changed"
        pending.save(update_fields=["status", "version", "invalidation_reason", "updated_at"])
    if not branches:
        return None
    sequence = (WorkflowApproval.objects.filter(issue=issue).aggregate(value=Max("entry_sequence"))["value"] or 0) + 1
    project = Project.objects.get(pk=issue.project_id)
    approval = WorkflowApproval.objects.create(
        project=project,
        issue=issue,
        workflow=workflow,
        source_id=issue.state_id,
        entry_sequence=sequence,
        policy_version=project.workflow_version,
        branches=branches,
    )
    _activity(issue, approval, actor, "requested")
    recipients = {person["id"] for branch in branches for person in branch["approvers"]}
    Notification.objects.bulk_create(
        [
            Notification(
                workspace_id=issue.workspace_id,
                project_id=issue.project_id,
                entity_identifier=issue.pk,
                entity_name="issue",
                title=f"Approval requested: {issue.name}",
                sender="in_app",
                receiver_id=receiver_id,
                triggered_by=actor,
                data={
                    "issue_id": str(issue.pk),
                    "project_id": str(issue.project_id),
                    "approval_id": str(approval.pk),
                    "event": "approval_requested",
                    "entry_sequence": sequence,
                },
                message={"approval_id": str(approval.pk), "status": "pending"},
            )
            for receiver_id in recipients
        ]
    )

    def queue_email():
        from plane.bgtasks.workflow_runner_task import queue_approval_email

        queue_approval_email(str(approval.pk))

    transaction.on_commit(queue_email)
    return approval


def approval_representation(approval, actor=None):
    can_decide = (
        approval.status == "pending"
        and _eligible_actor(approval.project_id, actor)
        and any(str(actor.pk) in {person["id"] for person in branch["approvers"]} for branch in approval.branches)
    )
    return {
        "id": approval.pk,
        "issue_id": approval.issue_id,
        "workflow_id": approval.workflow_id,
        "source_id": approval.source_id,
        "entry_sequence": approval.entry_sequence,
        "status": approval.status,
        "version": approval.version,
        "branches": approval.branches,
        "can_decide": can_decide,
        "decision": approval.decision or None,
        "created_at": approval.created_at,
        "invalidation_reason": approval.invalidation_reason,
    }


def _decision_context(approval, issue, transition_id, actor, outcome):
    if approval.status != "pending":
        workflow_conflict("WORKFLOW_APPROVAL_ALREADY_DECIDED")
    workflow = resolve_issue_workflow(issue.project_id, issue.type_id)
    if (
        issue.archived_at
        or issue.is_draft
        or not workflow_is_enforced(issue.project_id, workflow)
        or workflow.pk != approval.workflow_id
        or issue.state_id != approval.source_id
    ):
        workflow_conflict("WORKFLOW_APPROVAL_STALE")
    branch = next((b for b in approval.branches if b["id"] == str(transition_id)), None)
    rule = (
        WorkflowTransition.objects.filter(
            pk=transition_id, workflow=workflow, source_id=approval.source_id, kind="approval"
        )
        .select_related("source", "destination", "reject_state", "project")
        .first()
    )
    if not branch or not rule or not branch_matches(rule, branch):
        workflow_conflict("WORKFLOW_APPROVAL_STALE")
    if not _eligible_actor(issue.project_id, actor) or str(actor.pk) not in {m["id"] for m in branch["approvers"]}:
        workflow_error("WORKFLOW_APPROVER_NOT_ALLOWED")
    state = rule.destination if outcome == "approve" else rule.reject_state
    if not state:
        workflow_error("WORKFLOW_INVALID_APPROVAL_TARGET")
    return rule, state


def decide_approval(project_id, issue_id, approval_id, transition_id, outcome, version, idempotency_key, actor):
    if outcome not in ("approve", "reject") or not idempotency_key:
        workflow_error("WORKFLOW_INVALID_APPROVAL_DECISION")
    approval = WorkflowApproval.objects.get(pk=approval_id, project_id=project_id, issue_id=issue_id)
    if approval.idempotency_key == idempotency_key and approval.decision:
        if (
            approval.decision.get("actor_id") != str(actor.pk)
            or approval.decision.get("transition_id") != str(transition_id)
            or approval.decision.get("outcome") != outcome
        ):
            workflow_conflict("WORKFLOW_IDEMPOTENCY_CONFLICT")
        return approval
    if approval.version != version:
        workflow_conflict()
    issue = Issue.objects.get(pk=issue_id, project_id=project_id)
    rule, state = _decision_context(approval, issue, transition_id, actor, outcome)
    attrs = {"state": state}
    evidence = None
    if any(step.get("outcome") == outcome for step in rule.steps):
        from plane.utils.workflow_runner import prepare_runner_execution

        evidence = prepare_runner_execution(
            project_id,
            attrs,
            instance=issue,
            actor=actor,
            rule=rule,
            outcome=outcome,
            context={"approval_id": str(approval.pk), "approval_version": version},
        )
    with transaction.atomic():
        Project.objects.select_for_update().get(pk=project_id)
        issue = Issue.objects.select_for_update().get(pk=issue_id, project_id=project_id)
        approval = WorkflowApproval.objects.select_for_update().get(pk=approval_id)
        if approval.idempotency_key == idempotency_key and approval.decision:
            if (
                approval.decision.get("actor_id") == str(actor.pk)
                and approval.decision.get("transition_id") == str(transition_id)
                and approval.decision.get("outcome") == outcome
            ):
                return approval
            workflow_conflict("WORKFLOW_IDEMPOTENCY_CONFLICT")
        if approval.version != version:
            workflow_conflict()
        rule, state = _decision_context(approval, issue, transition_id, actor, outcome)
        if evidence:
            from plane.utils.workflow_runner import verify_runner_execution

            verify_runner_execution(evidence, issue, attrs, rule=rule)
        elif any(step.get("outcome") == outcome for step in rule.steps):
            workflow_conflict("WORKFLOW_CONTEXT_STALE")
        before_state_id = issue.state_id
        issue.state = state
        issue.save()
        approval.status = "approved" if outcome == "approve" else "rejected"
        approval.version += 1
        approval.idempotency_key = idempotency_key
        approval.decision = {
            "outcome": outcome,
            "transition_id": str(rule.pk),
            "actor_id": str(actor.pk),
            "at": timezone.now().isoformat(),
        }
        approval.save()
        _activity(issue, approval, actor, "approved" if outcome == "approve" else "rejected")
        IssueActivity.objects.create(
            project_id=project_id,
            issue=issue,
            actor=actor,
            field="state",
            verb="updated",
            old_identifier=before_state_id,
            new_identifier=state.pk,
            old_value=str(before_state_id),
            new_value=state.name,
        )
        sync_issue_approval(issue, actor)
        if evidence:
            from plane.utils.workflow_runner import finish_runner_execution

            finish_runner_execution(evidence, issue, actor=actor, rule=rule, outcome=outcome)
        return approval
