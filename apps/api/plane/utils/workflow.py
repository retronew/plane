"""Project-level workflow policy shared by app, public API and intake writes."""

from crum import get_current_user
from django.db import transaction
from rest_framework.exceptions import ValidationError

from plane.db.models import IntakeIssue, Issue, Project, ProjectMember, State, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowTransition


def workflow_error(code):
    raise ValidationError({"workflow": [code]})


def effective_creation_state(project_id, workflow=None):
    states = State.objects.filter(project_id=project_id, is_triage=False)
    if workflow and workflow.enabled and workflow.is_active:
        states = states.exclude(id__in=workflow.restricted_creation_states.values("id"))
        if workflow.initial_state_id:
            initial = states.filter(pk=workflow.initial_state_id).first()
            if initial:
                return initial
    return states.filter(default=True).first() or states.first()


def intake_creation_state(project_id):
    return effective_creation_state(project_id, ProjectWorkflow.objects.filter(project_id=project_id).first())


def validate_workflow_state_deletion(state):
    from django.db.models import Q

    if (
        ProjectWorkflow.objects.filter(initial_state=state).exists()
        or WorkflowTransition.objects.filter(Q(source=state) | Q(destination=state)).exists()
    ):
        workflow_error("WORKFLOW_STATE_IN_USE")


def validate_workflow_write(project_id, attrs, instance=None, actor=None):
    workflow = ProjectWorkflow.objects.filter(project_id=project_id, enabled=True, is_active=True).first()
    if not workflow:
        return attrs
    was_draft = instance is not None and instance.is_draft
    is_draft = attrs.get("is_draft", instance.is_draft if instance else False)
    if is_draft and (instance is None or was_draft):
        return attrs
    creating = instance is None or was_draft or (instance.state and instance.state.group == "triage")
    if not creating and "state" not in attrs:
        return attrs
    state = attrs.get("state")
    if creating and state is None:
        state = effective_creation_state(project_id, workflow)
        attrs["state"] = state
    if not state:
        workflow_error("WORKFLOW_NO_CREATION_STATE")
    # Incoming requests are triaged outside the normal workflow. Acceptance uses creation policy.
    if state.group == "triage":
        return attrs
    if creating:
        if workflow.restricted_creation_states.filter(pk=state.id).exists():
            workflow_error("WORKFLOW_CREATION_NOT_ALLOWED")
        return attrs
    if instance.state_id == state.id:
        return attrs
    rules = WorkflowTransition.objects.filter(
        workflow=workflow,
        source_id=instance.state_id,
        source__deleted_at__isnull=True,
        destination__deleted_at__isnull=True,
    )
    if not rules.exists():
        return attrs
    rule = rules.filter(destination=state).first()
    if not rule:
        workflow_error("WORKFLOW_TRANSITION_NOT_ALLOWED")
    members = rule.members.all()
    if members.exists():
        actor = actor or get_current_user()
        if not actor or not actor.is_authenticated or not members.filter(pk=actor.pk, is_active=True).exists():
            workflow_error("WORKFLOW_MEMBER_NOT_ALLOWED")
        if (
            not ProjectMember.objects.filter(project_id=project_id, member=actor, is_active=True).exists()
            or not WorkspaceMember.objects.filter(
                workspace_id=instance.workspace_id, member=actor, is_active=True
            ).exists()
        ):
            workflow_error("WORKFLOW_MEMBER_NOT_ALLOWED")
    return attrs


class WorkflowIssueWriteMixin:
    """Recheck under the same project lock used to edit policies, before any related writes."""

    @transaction.atomic
    def save(self, **kwargs):
        project_id = self.context["project_id"]
        changes_state = self.instance is None or "state" in self.validated_data or "is_draft" in self.validated_data
        if changes_state:
            Project.objects.select_for_update().get(pk=project_id)
        if self.instance:
            self.instance = Issue.objects.select_for_update().get(pk=self.instance.pk)
        actor = getattr(self.context.get("request"), "user", None) or get_current_user()
        if changes_state:
            validate_workflow_write(project_id, self.validated_data, self.instance, actor)
        return super().save(**kwargs)


class WorkflowIntakeWriteMixin:
    @transaction.atomic
    def save(self, **kwargs):
        Project.objects.select_for_update().get(pk=self.instance.project_id)
        self.instance = IntakeIssue.objects.select_for_update().get(pk=self.instance.pk)
        self.instance.issue = Issue.objects.select_for_update().get(pk=self.instance.issue_id)
        if self.validated_data.get("status") == 1 and self.instance.issue.state.group == "triage":
            if not intake_creation_state(self.instance.project_id):
                workflow_error("WORKFLOW_NO_CREATION_STATE")
        return super().save(**kwargs)
