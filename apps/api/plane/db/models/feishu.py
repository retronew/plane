# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class FeishuBinding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feishu_binding")
    app_id = models.CharField(max_length=128)
    tenant_key = models.CharField(max_length=128)
    open_id = models.CharField(max_length=128)
    display_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "feishu_bindings"
        constraints = [
            models.UniqueConstraint(fields=["app_id", "tenant_key", "open_id"], name="feishu_unique_identity")
        ]


class FeishuDirectoryPreview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    administrator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    config_digest = models.CharField(max_length=64)
    app_id = models.CharField(max_length=128)
    tenant_key = models.CharField(max_length=128, blank=True)
    mode = models.CharField(max_length=16, choices=[("unbound", "unbound"), ("all", "all")], default="unbound")
    status = models.CharField(max_length=16, default="partial")
    error = models.CharField(max_length=64, blank=True)
    rows = models.JSONField(default=list)
    members = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "feishu_directory_previews"


class FeishuAdminBindingAudit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    preview = models.ForeignKey(FeishuDirectoryPreview, null=True, on_delete=models.SET_NULL)
    row_id = models.UUIDField()
    administrator = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="feishu_admin_actions"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="feishu_admin_bindings"
    )
    binding = models.ForeignKey(FeishuBinding, null=True, on_delete=models.SET_NULL)
    source = models.CharField(max_length=32, default="admin_directory")
    match_basis = models.CharField(max_length=16)
    notifications_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "feishu_admin_binding_audits"
        constraints = [models.UniqueConstraint(fields=["preview", "row_id"], name="feishu_admin_unique_row")]


class FeishuOAuthState(models.Model):
    # Only the digest of the browser's random state and session key is stored.
    state_hash = models.CharField(max_length=64, primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    session_hash = models.CharField(max_length=64)
    app_id = models.CharField(max_length=128)
    verifier = models.TextField()
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "feishu_oauth_states"


class FeishuDelivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    binding = models.ForeignKey(FeishuBinding, null=True, on_delete=models.SET_NULL)
    event_key = models.CharField(max_length=255)
    channel = models.CharField(max_length=16, default="feishu", editable=False)
    kind = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    workspace = models.ForeignKey("db.Workspace", null=True, on_delete=models.CASCADE)
    project = models.ForeignKey("db.Project", null=True, on_delete=models.CASCADE)
    issue = models.ForeignKey("db.Issue", null=True, on_delete=models.CASCADE)
    is_test = models.BooleanField(default=False)
    status = models.CharField(max_length=16, default="pending")
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now)
    last_error = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    sent_at = models.DateTimeField(null=True)
    first_attempt_at = models.DateTimeField(null=True)
    message_id = models.CharField(max_length=128, blank=True)

    class Meta:
        db_table = "feishu_deliveries"
        constraints = [models.UniqueConstraint(fields=["event_key", "user", "channel"], name="feishu_unique_delivery")]
        indexes = [models.Index(fields=["status", "next_attempt_at"], name="feishu_pending_idx")]


class FeishuCardAction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    delivery = models.ForeignKey(FeishuDelivery, on_delete=models.CASCADE, related_name="card_actions")
    binding = models.ForeignKey(FeishuBinding, null=True, on_delete=models.SET_NULL)
    key = models.CharField(max_length=160)
    operation = models.CharField(max_length=16)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=16, default="pending")
    result = models.JSONField(default=dict)
    expires_at = models.DateTimeField()
    claimed_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    card_updated_at = models.DateTimeField(null=True)
    card_update_attempts = models.PositiveSmallIntegerField(default=0)
    next_card_update_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "feishu_card_actions"
        constraints = [models.UniqueConstraint(fields=["delivery", "key"], name="feishu_unique_card_action")]
        indexes = [models.Index(fields=["status", "claimed_at"], name="feishu_action_pending_idx")]
