from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from .base import BaseModel


class ProjectCategory(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE)
    kind = models.CharField(max_length=10, choices=[("status", "Status"), ("label", "Label")])
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#60646C")
    sort_order = models.PositiveIntegerField(default=0)
    group = models.CharField(
        max_length=16,
        default="draft",
        choices=[(g, g) for g in ["draft", "planning", "execution", "monitoring", "completed", "cancelled"]],
    )
    description = models.CharField(max_length=1000, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = "project_categories"
        ordering = ["sort_order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "workspace",
                "kind",
                condition=Q(deleted_at__isnull=True),
                name="unique_workspace_project_category",
            )
        ]


class WorkspaceTemplate(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE)
    kind = models.CharField(
        max_length=12, choices=[("project", "Project"), ("work_item", "Work item"), ("page", "Page")]
    )
    name = models.CharField(max_length=100)
    short_description = models.CharField(max_length=1000, blank=True)
    project = models.ForeignKey(
        "db.Project", null=True, blank=True, on_delete=models.CASCADE, related_name="workspace_templates"
    )
    configuration = models.JSONField(default=dict)
    title = models.CharField(max_length=255, blank=True)
    description_html = models.TextField(default="<p></p>", blank=True)
    priority = models.CharField(
        max_length=10, default="none", choices=[(p, p) for p in ["none", "low", "medium", "high", "urgent"]]
    )

    class Meta:
        db_table = "workspace_templates"
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "workspace",
                "kind",
                condition=Q(deleted_at__isnull=True),
                name="unique_workspace_template",
            )
        ]
