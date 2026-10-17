"""Shared typed workflow write contract for application, public API and system writes."""

from crum import get_current_user
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import APIException, ValidationError

from plane.db.models import IntakeIssue, Issue, Project, ProjectIssueType, ProjectMember, State, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowTransition


class WorkflowConflict(APIException):
    status_code = 409
    default_code = "workflow_conflict"


def workflow_error(code):
    raise ValidationError({"workflow": [code]})


def workflow_conflict(code="WORKFLOW_VERSION_CONFLICT"):
    raise WorkflowConflict({"workflow": [code]})


def check_issue_type_conflict(data):
    if "type" in data and "type_id" in data:
        left, right = data["type"], data["type_id"]
        if str(getattr(left, "pk", left)) != str(getattr(right, "pk", right)):
            workflow_error("WORKFLOW_CONFLICTING_TYPE")


def normalize_issue_type(project_id, attrs, instance=None, raw_data=None):
    if raw_data is not None:
        check_issue_type_conflict(raw_data)
    check_issue_type_conflict(attrs)
    if "type_id" in attrs:
        attrs["type"] = attrs.pop("type_id")
    if "type" not in attrs:
        if instance is not None:
            if str(getattr(instance, "project_id", None)) != str(project_id):
                existing_type = getattr(instance, "type", None)
                # DraftIssue stores a raw UUID; Issue stores a related object.
                if existing_type:
                    normalize_issue_type(project_id, {"type": existing_type})
            return attrs
        binding = (
            ProjectIssueType.objects.filter(
                project_id=project_id,
                is_default=True,
                issue_type__is_active=True,
                issue_type__deleted_at__isnull=True,
                issue_type__workspace_id=Project.objects.values("workspace_id").filter(pk=project_id)[:1],
            ).first()
            if project_id
            else None
        )
        if binding:
            attrs["type"] = binding.issue_type
        return attrs
    value = attrs["type"]
    if value is None:
        return attrs
    value_id = getattr(value, "pk", value)
    binding = (
        ProjectIssueType.objects.filter(
            project_id=project_id,
            issue_type_id=value_id,
            issue_type__is_active=True,
            issue_type__deleted_at__isnull=True,
            issue_type__workspace_id=Project.objects.values("workspace_id").filter(pk=project_id)[:1],
        )
        .select_related("issue_type")
        .first()
        if project_id
        else None
    )
    if not binding:
        workflow_error("WORKFLOW_INVALID_TYPE")
    attrs["type"] = binding.issue_type
    return attrs


def resolve_issue_workflow(project_id, type_id=None):
    if type_id:
        binding = (
            ProjectIssueType.objects.filter(project_id=project_id, issue_type_id=type_id)
            .select_related("workflow")
            .first()
        )
        if binding and binding.workflow and binding.workflow.deleted_at is None:
            return binding.workflow
    return ProjectWorkflow.objects.filter(project_id=project_id, is_default=True).first()


def workflow_states(project_id, workflow=None):
    states = State.objects.filter(project_id=project_id, is_triage=False)
    if workflow and not workflow.is_default:
        states = states.filter(explicit_workflows=workflow)
    return states


def workflow_is_enforced(project_id, workflow):
    return bool(
        workflow and workflow.is_active and Project.objects.filter(pk=project_id, workflow_enabled=True).exists()
    )


def effective_creation_state(project_id, workflow=None, type_id=None):
    if workflow is None:
        workflow = resolve_issue_workflow(project_id, type_id)
    enforced = workflow_is_enforced(project_id, workflow)
    states = workflow_states(project_id, workflow if enforced else None)
    if enforced:
        states = states.exclude(id__in=workflow.restricted_creation_states.values("id"))
        if workflow.initial_state_id:
            initial = states.filter(pk=workflow.initial_state_id).first()
            if initial:
                return initial
    return states.filter(default=True).first() or states.order_by("sequence", "id").first()


def intake_creation_state(project_id, type_id=None):
    return effective_creation_state(project_id, type_id=type_id)


def validate_workflow_state_deletion(state):
    if (
        ProjectWorkflow.objects.filter(initial_state=state).exists()
        or WorkflowTransition.objects.filter(Q(source=state) | Q(destination=state) | Q(reject_state=state)).exists()
    ):
        workflow_error("WORKFLOW_STATE_IN_USE")
    for workflow in ProjectWorkflow.objects.filter(project_id=state.project_id):
        states = workflow_states(state.project_id, workflow)
        if (
            states.filter(pk=state.pk).exists()
            and not states.exclude(pk=state.pk)
            .exclude(pk__in=workflow.restricted_creation_states.values("id"))
            .exists()
        ):
            workflow_error("WORKFLOW_NO_CREATION_STATE")


def _eligible_actor(project_id, actor):
    return bool(
        actor
        and getattr(actor, "is_authenticated", False)
        and actor.is_active
        and ProjectMember.objects.filter(
            project_id=project_id,
            member=actor,
            is_active=True,
            role__gte=15,
        ).exists()
        and WorkspaceMember.objects.filter(
            workspace__workspace_project__id=project_id,
            member=actor,
            is_active=True,
            role__gte=15,
        ).exists()
    )


def eligible_workflow_members(project):
    return ProjectMember.objects.filter(
        project=project,
        is_active=True,
        role__gte=15,
        member__is_active=True,
        member__is_bot=False,
        member__member_workspace__workspace_id=project.workspace_id,
        member__member_workspace__is_active=True,
        member__member_workspace__role__gte=15,
    ).select_related("member")


def resolve_workflow_transition(project_id, attrs, instance=None, actor=None):
    if instance is None or instance.is_draft or not instance.state_id or instance.state.group == "triage":
        return None
    destination = attrs.get("state", instance.state)
    if not destination or destination.id == instance.state_id:
        return None
    source_workflow = resolve_issue_workflow(project_id, instance.type_id)
    if not workflow_is_enforced(project_id, source_workflow):
        return None
    rules = WorkflowTransition.objects.filter(workflow=source_workflow, source_id=instance.state_id)
    if not rules.exists():
        return None
    if rules.filter(kind="approval").exists():
        workflow_error("WORKFLOW_APPROVAL_REQUIRED")
    rule = rules.filter(destination=destination).first()
    if not rule:
        workflow_error("WORKFLOW_TRANSITION_NOT_ALLOWED")
    if rule.members.exists():
        actor = actor or get_current_user()
        if not _eligible_actor(project_id, actor) or not rule.members.filter(pk=actor.pk).exists():
            workflow_error("WORKFLOW_MEMBER_NOT_ALLOWED")
    return rule


def validate_workflow_write(project_id, attrs, instance=None, actor=None, raw_data=None):
    normalize_issue_type(project_id, attrs, instance, raw_data)
    was_draft = instance is not None and instance.is_draft
    if attrs.get("is_draft", instance.is_draft if instance else False) and (instance is None or was_draft):
        return attrs
    if instance and instance.state_id and instance.state.group == "triage" and "state" not in attrs:
        return attrs
    creating = instance is None or was_draft or bool(instance.state_id and instance.state.group == "triage")
    target_type = attrs.get("type", instance.type if instance else None)
    workflow = resolve_issue_workflow(project_id, getattr(target_type, "pk", target_type))
    enforced = workflow_is_enforced(project_id, workflow)
    if creating and attrs.get("state") is None:
        attrs["state"] = effective_creation_state(project_id, workflow)
    state = attrs.get("state", instance.state if instance else None)
    if not state:
        if enforced:
            workflow_error("WORKFLOW_NO_CREATION_STATE")
        return attrs
    if state.project_id != project_id and str(state.project_id) != str(project_id):
        workflow_error("WORKFLOW_INVALID_STATE")
    if state.group == "triage":
        if instance and instance.state_id and instance.state.group != "triage" and not was_draft:
            workflow_error("WORKFLOW_INVALID_STATE")
        return attrs
    if enforced:
        if not workflow_states(project_id, workflow).filter(pk=state.pk).exists():
            workflow_error(
                "WORKFLOW_STATE_MAPPING_REQUIRED"
                if "state" not in attrs and "type" in attrs
                else "WORKFLOW_INVALID_STATE"
            )
        if creating and workflow.restricted_creation_states.filter(pk=state.pk).exists():
            workflow_error("WORKFLOW_CREATION_NOT_ALLOWED")
    if not creating:
        source_workflow = resolve_issue_workflow(project_id, instance.type_id)
        changed_type = "type" in attrs and getattr(attrs["type"], "pk", None) != instance.type_id
        if (
            changed_type
            and workflow_is_enforced(project_id, source_workflow)
            and WorkflowTransition.objects.filter(
                workflow=source_workflow, source_id=instance.state_id, kind="approval"
            ).exists()
        ):
            workflow_error("WORKFLOW_APPROVAL_REQUIRED")
        resolve_workflow_transition(project_id, attrs, instance, actor)
    return attrs


def prepare_workflow_write(project_id, attrs, instance=None, actor=None, raw_data=None, context=None):
    validate_workflow_write(project_id, attrs, instance, actor, raw_data)
    rule = resolve_workflow_transition(project_id, attrs, instance, actor)
    evidence = None
    if rule and rule.steps:
        from plane.utils.workflow_runner import prepare_runner_execution

        evidence = prepare_runner_execution(
            project_id, attrs, instance=instance, actor=actor, rule=rule, context=context
        )
    return {"project_id": project_id, "attrs": attrs, "rule": rule, "evidence": evidence}


def verify_workflow_write(prepared, instance=None, attrs=None, actor=None):
    attrs = prepared["attrs"] if attrs is None else attrs
    validate_workflow_write(prepared["project_id"], attrs, instance, actor)
    rule = resolve_workflow_transition(prepared["project_id"], attrs, instance, actor)
    if prepared["evidence"]:
        from plane.utils.workflow_runner import verify_runner_execution

        verify_runner_execution(prepared["evidence"], instance, attrs, rule=rule)
    elif rule and rule.steps:
        workflow_conflict("WORKFLOW_CONTEXT_STALE")
    prepared["rule"] = rule
    return attrs


def finish_workflow_write(prepared, issue, actor=None):
    from plane.services.workflow_approval import sync_issue_approval

    sync_issue_approval(issue, actor=actor)
    if prepared.get("evidence"):
        from plane.utils.workflow_runner import finish_runner_execution

        finish_runner_execution(prepared["evidence"], issue, actor=actor, rule=prepared["rule"])
    return issue


class WorkflowIssueTypeMixin:
    def to_internal_value(self, data):
        check_issue_type_conflict(data)
        attrs = super().to_internal_value(data)
        instance = self.instance
        parent_instance = getattr(getattr(self, "parent", None), "instance", None)
        if instance is None and isinstance(parent_instance, IntakeIssue):
            instance = parent_instance.issue
        return normalize_issue_type(self.context.get("project_id"), attrs, instance, raw_data=data)


class WorkflowIssueWriteMixin(WorkflowIssueTypeMixin):
    """Prepare scripts outside locks, then atomically recheck and persist all related writes."""

    def save(self, **kwargs):
        project_id = self.context["project_id"]
        actor = getattr(self.context.get("request"), "user", None) or get_current_user()
        attrs = self.validated_data
        if self.instance:
            self.instance = Issue.objects.get(pk=self.instance.pk)
        prepared = prepare_workflow_write(
            project_id, attrs, self.instance, actor, raw_data=getattr(self, "initial_data", None)
        )
        self._workflow_children_prepared = [
            prepare_workflow_write(project_id, child, actor=actor) for child in attrs.get("template_children", [])
        ]
        with transaction.atomic():
            Project.objects.select_for_update().get(pk=project_id)
            if self.instance:
                self.instance = Issue.objects.select_for_update().get(pk=self.instance.pk)
            verify_workflow_write(prepared, self.instance, actor=actor)
            for child in self._workflow_children_prepared:
                verify_workflow_write(child, actor=actor)
            issue = super().save(**kwargs)
            finish_workflow_write(prepared, issue, actor)
            return issue


class WorkflowIntakeWriteMixin:
    def save(self, **kwargs):
        project_id = self.instance.project_id
        actor = getattr(self.context.get("request"), "user", None) or get_current_user()
        issue_serializer = self.context.get("issue_serializer")
        issue = Issue.objects.get(pk=self.instance.issue_id)
        attrs = dict(issue_serializer.validated_data) if issue_serializer else {}
        attrs.update(self.validated_data.pop("issue", {}))
        accepting = self.validated_data.get("status") == 1 and issue.state_id and issue.state.group == "triage"
        if accepting:
            normalize_issue_type(project_id, attrs, issue)
            target_type = attrs.get("type", issue.type)
            attrs["state"] = effective_creation_state(project_id, type_id=getattr(target_type, "pk", None))
        prepared = prepare_workflow_write(project_id, attrs, issue, actor) if accepting or attrs else None
        with transaction.atomic():
            Project.objects.select_for_update().get(pk=project_id)
            self.instance = IntakeIssue.objects.select_for_update().get(pk=self.instance.pk)
            issue = Issue.objects.select_for_update().get(pk=self.instance.issue_id)
            self.instance.issue = issue
            if prepared:
                verify_workflow_write(prepared, issue, attrs, actor)
                if issue_serializer:
                    issue_serializer.instance = issue_serializer.update(issue, attrs)
                    self.instance.issue = issue_serializer.instance
                else:
                    for key, value in attrs.items():
                        setattr(issue, key, value)
                    issue.save()
            result = super().save(**kwargs)
            if prepared:
                finish_workflow_write(prepared, self.instance.issue, actor)
            return result
