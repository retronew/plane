from django.db import models
from django.db.models import Q

from .project import ProjectBaseModel


class ProjectCustomProperty(ProjectBaseModel):
    PROPERTY_TYPES = [(kind, kind) for kind in ("text", "number", "dropdown", "boolean", "date", "url", "member")]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    property_type = models.CharField(max_length=20, choices=PROPERTY_TYPES)
    config = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    sort_order = models.FloatField(default=0)

    class Meta:
        db_table = "project_custom_properties"
        ordering = ("sort_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                condition=Q(deleted_at__isnull=True, is_archived=False),
                name="unique_active_project_property_name",
            ),
        ]


class CustomPropertyOption(ProjectBaseModel):
    property = models.ForeignKey(ProjectCustomProperty, related_name="options", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=7, default="#60646c")
    sort_order = models.FloatField(default=0)
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)

    class Meta:
        db_table = "custom_property_options"
        ordering = ("sort_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["property", "name"],
                condition=Q(deleted_at__isnull=True, is_archived=False),
                name="unique_active_property_option_name",
            ),
        ]


class IssueTypeCustomProperty(ProjectBaseModel):
    property = models.ForeignKey(ProjectCustomProperty, related_name="type_settings", on_delete=models.CASCADE)
    project_issue_type = models.ForeignKey(
        "db.ProjectIssueType", related_name="custom_property_settings", on_delete=models.CASCADE
    )
    is_active = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)

    class Meta:
        db_table = "issue_type_custom_properties"
        constraints = [
            models.UniqueConstraint(fields=["property", "project_issue_type"], name="unique_type_custom_property"),
        ]
