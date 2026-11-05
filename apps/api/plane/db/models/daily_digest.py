"""Personal digest configuration and durable, independently retried channel outbox."""

import uuid

from django.db import models
from django.utils import timezone as dj_timezone


def default_channels():
    return ["in_app"]


def default_modules():
    return ["completed", "open", "overdue", "due_today"]


class DailyDigestConfig(models.Model):
    user = models.OneToOneField("db.User", primary_key=True, on_delete=models.CASCADE, related_name="daily_digest")
    enabled = models.BooleanField(default=False)
    send_time = models.CharField(max_length=5, default="18:00")
    weekdays_only = models.BooleanField(default=False)
    channels = models.JSONField(default=default_channels)
    workspace_ids = models.JSONField(default=list)
    project_ids = models.JSONField(default=list)
    modules = models.JSONField(default=default_modules)
    include_details = models.BooleanField(default=True)
    send_empty = models.BooleanField(default=False)
    due_soon_days = models.PositiveSmallIntegerField(default=3)
    revision = models.UUIDField(default=uuid.uuid4)
    # A configuration change starts a new epoch; never replay past schedules.
    anchor_at = models.DateTimeField(default=dj_timezone.now)
    schedule_timezone = models.CharField(max_length=255, default="UTC")
    last_period_end = models.DateTimeField(null=True)

    class Meta:
        db_table = "daily_digest_configs"


class DailyDigest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    config = models.ForeignKey(DailyDigestConfig, on_delete=models.CASCADE, related_name="digests")
    revision = models.UUIDField()
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    timezone = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=dj_timezone.now)

    class Meta:
        db_table = "daily_digests"
        constraints = [models.UniqueConstraint(fields=["config", "period_end"], name="daily_digest_unique_period")]


class DailyDigestDelivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    digest = models.ForeignKey(DailyDigest, on_delete=models.CASCADE, related_name="deliveries")
    channel = models.CharField(max_length=16)
    status = models.CharField(max_length=16, default="pending")
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=dj_timezone.now)
    last_error = models.CharField(max_length=128, blank=True)
    sent_at = models.DateTimeField(null=True)
    notification = models.OneToOneField("db.Notification", null=True, on_delete=models.SET_NULL)
    feishu_delivery = models.OneToOneField("db.FeishuDelivery", null=True, on_delete=models.SET_NULL)

    class Meta:
        db_table = "daily_digest_deliveries"
        constraints = [models.UniqueConstraint(fields=["digest", "channel"], name="daily_digest_unique_channel")]
        indexes = [models.Index(fields=["status", "next_attempt_at"], name="daily_digest_pending_idx")]
