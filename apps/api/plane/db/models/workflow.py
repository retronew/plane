from django.db import models
from django.db.models import Q

from .project import ProjectBaseModel


class ProjectWorkflow(ProjectBaseModel):
    # Compatibility mirror only. Runtime reads Project.workflow_enabled exclusively.
    enabled = models.BooleanField(default=False)
    name = models.CharField(max_length=255, default="Default workflow")
    description = models.TextField(blank=True, default="")
    is_default = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    states = models.ManyToManyField("db.State", blank=True, related_name="explicit_workflows")
    initial_state = models.ForeignKey(
        "db.State", null=True, blank=True, on_delete=models.SET_NULL, related_name="initial_workflows"
    )
    restricted_creation_states = models.ManyToManyField("db.State", blank=True, related_name="creation_workflows")

    def save(self, *args, **kwargs):
        # Legacy ORM callers can still create/update the default workflow using enabled.
        # The mirror is never consulted by the rule resolver.
        from .project import Project

        previous = type(self).objects.filter(pk=self.pk).values("enabled").first() if not self._state.adding else None
        super().save(*args, **kwargs)
        if self.is_default and (previous is None or previous["enabled"] != self.enabled):
            Project.objects.filter(pk=self.project_id).update(workflow_enabled=self.enabled)

    class Meta:
        db_table = "project_workflows"
        constraints = [
            models.UniqueConstraint(
                fields=["project"],
                condition=Q(deleted_at__isnull=True, is_default=True),
                name="unique_default_project_workflow",
            ),
            models.UniqueConstraint(
                fields=["project", "name"],
                condition=Q(deleted_at__isnull=True),
                name="unique_project_workflow_name",
            ),
        ]


class WorkflowTransition(ProjectBaseModel):
    workflow = models.ForeignKey(ProjectWorkflow, on_delete=models.CASCADE, related_name="transitions")
    source = models.ForeignKey("db.State", on_delete=models.CASCADE, related_name="outgoing_workflow_transitions")
    destination = models.ForeignKey("db.State", on_delete=models.CASCADE, related_name="incoming_workflow_transitions")
    members = models.ManyToManyField("db.User", blank=True, related_name="workflow_transitions")
    kind = models.CharField(
        max_length=20, choices=(("transition", "Transition"), ("approval", "Approval")), default="transition"
    )
    reject_state = models.ForeignKey(
        "db.State", null=True, blank=True, on_delete=models.CASCADE, related_name="rejected_workflow_transitions"
    )
    approver_mode = models.CharField(max_length=20, choices=(("all", "All"), ("explicit", "Explicit")), default="all")
    approvers = models.ManyToManyField("db.User", blank=True, related_name="approval_workflow_transitions")
    version = models.PositiveIntegerField(default=1)
    steps = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "workflow_transitions"
        constraints = [
            models.UniqueConstraint(
                fields=["workflow", "source", "destination"],
                condition=Q(deleted_at__isnull=True),
                name="unique_active_workflow_transition",
            )
        ]


class WorkflowActivity(ProjectBaseModel):
    workflow = models.ForeignKey(
        ProjectWorkflow, null=True, blank=True, on_delete=models.SET_NULL, related_name="activities"
    )
    workflow_name = models.CharField(max_length=255, blank=True, default="")
    action = models.CharField(max_length=40)
    data = models.JSONField(default=dict)

    class Meta:
        db_table = "workflow_activities"
        ordering = ["-created_at", "-id"]


class WorkflowApproval(ProjectBaseModel):
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="workflow_approvals")
    workflow = models.ForeignKey(ProjectWorkflow, on_delete=models.CASCADE, related_name="approvals")
    source = models.ForeignKey("db.State", on_delete=models.CASCADE, related_name="workflow_approvals")
    entry_sequence = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20,
        default="pending",
        choices=(
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("cancelled", "Cancelled"),
        ),
    )
    version = models.PositiveIntegerField(default=1)
    policy_version = models.PositiveIntegerField(default=0)
    branches = models.JSONField(default=list)
    decision = models.JSONField(default=dict, blank=True)
    invalidation_reason = models.CharField(max_length=80, blank=True, default="")
    idempotency_key = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        db_table = "workflow_approvals"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue"],
                condition=Q(deleted_at__isnull=True, status="pending"),
                name="unique_pending_workflow_approval",
            ),
            models.UniqueConstraint(
                fields=["issue", "entry_sequence"],
                condition=Q(deleted_at__isnull=True),
                name="unique_workflow_approval_entry",
            ),
        ]
