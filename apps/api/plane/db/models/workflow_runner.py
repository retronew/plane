"""Immutable scripts and durable execution/outbox records for the isolated Runner."""

import uuid

from django.db import models
from django.db.models import Q

from .project import ProjectBaseModel


class WorkflowScript(ProjectBaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "workflow_scripts"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], condition=Q(deleted_at__isnull=True), name="unique_workflow_script_name"
            )
        ]


class WorkflowScriptVersion(ProjectBaseModel):
    script = models.ForeignKey(WorkflowScript, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField()
    source = models.TextField()
    source_hash = models.CharField(max_length=64)
    sdk_version = models.CharField(max_length=20, default="1")
    capabilities = models.JSONField(default=list)
    http_policy = models.JSONField(default=dict)

    class Meta:
        db_table = "workflow_script_versions"
        constraints = [models.UniqueConstraint(fields=["script", "version"], name="unique_workflow_script_version")]
        ordering = ["-version"]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError("Published workflow script versions are immutable")
        return super().save(*args, **kwargs)


class WorkflowCredential(ProjectBaseModel):
    name = models.CharField(max_length=255)
    origin = models.CharField(max_length=2048)
    header_name = models.CharField(max_length=100, default="Authorization")
    encrypted_secret = models.TextField()
    key_id = models.CharField(max_length=80)

    class Meta:
        db_table = "workflow_credentials"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], condition=Q(deleted_at__isnull=True), name="unique_workflow_credential_name"
            )
        ]


class WorkflowExecution(ProjectBaseModel):
    issue = models.ForeignKey(
        "db.Issue", null=True, blank=True, on_delete=models.SET_NULL, related_name="workflow_executions"
    )
    actor = models.ForeignKey(
        "db.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="workflow_executions"
    )
    rule = models.ForeignKey(
        "db.WorkflowTransition", null=True, blank=True, on_delete=models.SET_NULL, related_name="executions"
    )
    phase = models.CharField(max_length=8)
    outcome = models.CharField(max_length=20, default="transition")
    status = models.CharField(max_length=20, default="queued")
    attempt = models.PositiveIntegerField(default=1)
    dry_run = models.BooleanField(default=False)
    draft_hash = models.CharField(max_length=64, blank=True, default="")
    context = models.JSONField(default=dict)
    capabilities = models.JSONField(default=list)
    http_policy = models.JSONField(default=dict)
    policy_version = models.PositiveIntegerField(default=0)
    rule_version = models.PositiveIntegerField(default=0)
    depth = models.PositiveSmallIntegerField(default=0)
    lease = models.UUIDField(default=uuid.uuid4)
    lease_expires_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error = models.JSONField(null=True, blank=True)
    logs = models.JSONField(default=list)
    # Captures the IDs/versions read through the SDK, checked again at commit.
    read_dependencies = models.JSONField(default=dict)

    class Meta:
        db_table = "workflow_executions"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="workflow_execution_outbox_idx"),
            models.Index(fields=["issue", "created_at"], name="workflow_execution_issue_idx"),
        ]


class WorkflowExecutionStep(ProjectBaseModel):
    execution = models.ForeignKey(WorkflowExecution, on_delete=models.CASCADE, related_name="steps")
    script_version = models.ForeignKey(
        WorkflowScriptVersion, null=True, blank=True, on_delete=models.PROTECT, related_name="executions"
    )
    index = models.PositiveSmallIntegerField()
    # Test drafts are snapshots too, but are never published as script versions.
    source = models.TextField(blank=True, default="")
    capabilities = models.JSONField(default=list)
    http_policy = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default="queued")
    attempt = models.PositiveIntegerField(default=1)
    lease = models.UUIDField(default=uuid.uuid4)
    result = models.JSONField(null=True, blank=True)
    error = models.JSONField(null=True, blank=True)
    logs = models.JSONField(default=list)
    metrics = models.JSONField(default=dict)
    history = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "workflow_execution_steps"
        ordering = ["index"]
        constraints = [models.UniqueConstraint(fields=["execution", "index"], name="unique_workflow_execution_step")]


class WorkflowApprovalEmail(ProjectBaseModel):
    approval = models.ForeignKey("db.WorkflowApproval", on_delete=models.CASCADE, related_name="email_deliveries")
    receiver = models.ForeignKey("db.User", on_delete=models.CASCADE, related_name="workflow_approval_emails")
    status = models.CharField(max_length=20, default="queued")
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "workflow_approval_emails"
        constraints = [models.UniqueConstraint(fields=["approval", "receiver"], name="unique_workflow_approval_email")]


class WorkflowAction(ProjectBaseModel):
    execution = models.ForeignKey(WorkflowExecution, on_delete=models.CASCADE, related_name="actions")
    step = models.ForeignKey(WorkflowExecutionStep, on_delete=models.CASCADE, related_name="actions")
    index = models.PositiveSmallIntegerField()
    method = models.CharField(max_length=40)
    params_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=20, default="running")
    result = models.JSONField(null=True, blank=True)
    error = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "workflow_actions"
        ordering = ["step__index", "index"]
        constraints = [models.UniqueConstraint(fields=["step", "index"], name="unique_workflow_action")]
