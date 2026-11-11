"""Content-free, transactionally ordered workspace change log."""

from django.db import models


class WorkspaceSyncCursor(models.Model):
    workspace = models.OneToOneField("db.Workspace", primary_key=True, on_delete=models.CASCADE)
    cursor = models.PositiveBigIntegerField(default=0)
    retained_from = models.PositiveBigIntegerField(default=0)


class WorkspaceSyncEvent(models.Model):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE)
    project_id = models.UUIDField()
    event_id = models.UUIDField(unique=True)
    cursor = models.PositiveBigIntegerField()
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "cursor"], name="workspace_sync_cursor_unique")]
        indexes = [models.Index(fields=["published_at", "id"], name="sync_unpublished_idx")]
