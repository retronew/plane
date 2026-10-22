from django.conf import settings
from django.db import models
from django.db.models import Q

from .base import BaseModel


class NotificationPreference(BaseModel):
    """Personal channel/event overrides; never adds rows to the legacy preference table."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="unified_notification_preferences"
    )
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, null=True, blank=True)
    project = models.ForeignKey("db.Project", on_delete=models.CASCADE, null=True, blank=True)
    # Global only. Missing keys use system defaults.
    channels = models.JSONField(default=dict)
    override_scopes = models.JSONField(default=dict)
    # channel -> event -> bool. Missing/null means inherit for local scopes.
    events = models.JSONField(default=dict)

    class Meta:
        db_table = "notification_preferences"
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(workspace__isnull=True, project__isnull=True),
                name="notif_pref_global_unique",
            ),
            models.UniqueConstraint(
                fields=["user", "workspace"],
                condition=Q(workspace__isnull=False, project__isnull=True),
                name="notif_pref_workspace_unique",
            ),
            models.UniqueConstraint(
                fields=["user", "project"], condition=Q(project__isnull=False), name="notif_pref_project_unique"
            ),
            models.CheckConstraint(
                condition=Q(project__isnull=True) | Q(workspace__isnull=False), name="notif_pref_project_workspace"
            ),
        ]
