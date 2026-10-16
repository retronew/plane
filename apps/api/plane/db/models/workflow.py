from django.db import models
from django.db.models import Q

from .project import ProjectBaseModel


class ProjectWorkflow(ProjectBaseModel):
    enabled = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    initial_state = models.ForeignKey(
        "db.State", null=True, blank=True, on_delete=models.SET_NULL, related_name="initial_workflows"
    )
    restricted_creation_states = models.ManyToManyField("db.State", blank=True, related_name="creation_workflows")

    class Meta:
        db_table = "project_workflows"
        constraints = [
            models.UniqueConstraint(
                fields=["project"], condition=Q(deleted_at__isnull=True), name="unique_active_project_workflow"
            )
        ]


class WorkflowTransition(ProjectBaseModel):
    workflow = models.ForeignKey(ProjectWorkflow, on_delete=models.CASCADE, related_name="transitions")
    source = models.ForeignKey("db.State", on_delete=models.CASCADE, related_name="outgoing_workflow_transitions")
    destination = models.ForeignKey("db.State", on_delete=models.CASCADE, related_name="incoming_workflow_transitions")
    members = models.ManyToManyField("db.User", blank=True, related_name="workflow_transitions")

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
    action = models.CharField(max_length=40)
    data = models.JSONField(default=dict)

    class Meta:
        db_table = "workflow_activities"
        ordering = ["-created_at", "-id"]
