"""Durable outbox delivery and explicit recovery for workflow automation."""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from plane.db.models import ProjectMember, WorkspaceMember
from plane.db.models.workflow import WorkflowApproval
from plane.db.models.workflow_runner import WorkflowApprovalEmail, WorkflowExecution
from plane.license.utils.instance_value import get_email_configuration
from plane.utils.workflow_runner import execute_workflow_run, recover_workflow_executions
from plane.utils.feishu import enqueue_feishu_notification
from plane.utils.notification_preferences import should_notify

logger = logging.getLogger(__name__)


def queue_workflow_execution(execution_id):
    try:
        run_workflow_execution.delay(execution_id)
    except Exception:
        # The committed queued row remains available to the periodic dispatcher.
        logger.warning("Workflow outbox wakeup failed; periodic delivery will retry")


@shared_task
def run_workflow_execution(execution_id):
    execute_workflow_run(execution_id)


def queue_approval_email(approval_id):
    approval = WorkflowApproval.objects.filter(pk=approval_id, status="pending").first()
    if not approval:
        return
    recipients = {person["id"] for branch in approval.branches for person in branch["approvers"]}
    for receiver_id in recipients:
        if should_notify(receiver_id, approval.workspace_id, approval.project_id, "approval_requested", "feishu"):
            enqueue_feishu_notification(
                event_key=f"approval-requested:{approval.pk}",
                user_id=receiver_id,
                kind="approval_requested",
                title=f"Approval requested: {approval.issue.name}",
                body=approval.issue.name,
                workspace_id=approval.workspace_id,
                project_id=approval.project_id,
                issue_id=approval.issue_id,
            )
        delivery, _ = WorkflowApprovalEmail.objects.get_or_create(
            approval=approval,
            receiver_id=receiver_id,
            defaults={"project_id": approval.project_id, "workspace_id": approval.workspace_id},
        )
        if delivery.status == "queued":
            try:
                send_approval_email.delay(str(delivery.pk))
            except Exception:
                logger.warning("Approval email wakeup failed; periodic delivery will retry")


@shared_task
def dispatch_workflow_outbox():
    recover_workflow_executions()
    blocking = WorkflowExecution.objects.filter(
        issue_id=OuterRef("issue_id"),
        phase="post",
        status__in=["queued", "running", "unknown"],
    ).filter(Q(created_at__lt=OuterRef("created_at")) | Q(created_at=OuterRef("created_at"), id__lt=OuterRef("pk")))
    for execution_id in (
        WorkflowExecution.objects.filter(status="queued", phase="post")
        .annotate(blocked=Exists(blocking))
        .filter(blocked=False)
        .order_by("created_at", "id")
        .values_list("id", flat=True)[:100]
    ):
        queue_workflow_execution(str(execution_id))
    # Creation of delivery rows is also recoverable if the initial wakeup failed.
    for approval_id in (
        WorkflowApproval.objects.filter(status="pending").order_by("created_at").values_list("id", flat=True)[:100]
    ):
        queue_approval_email(str(approval_id))


@shared_task
def send_approval_email(delivery_id):
    with transaction.atomic():
        delivery = (
            WorkflowApprovalEmail.objects.select_for_update(of=("self",))
            .select_related(
                "approval__issue__project__workspace",
                "receiver__profile",
            )
            .filter(pk=delivery_id)
            .first()
        )
        if not delivery or delivery.status != "queued":
            return
        approval, receiver = delivery.approval, delivery.receiver
        issue = approval.issue
        valid_member = (
            ProjectMember.objects.filter(
                project_id=approval.project_id, member=receiver, is_active=True, role__gte=15
            ).exists()
            and WorkspaceMember.objects.filter(
                workspace_id=approval.workspace_id, member=receiver, is_active=True
            ).exists()
        )
        if (
            approval.status != "pending"
            or approval.deleted_at is not None
            or issue.deleted_at is not None
            or issue.archived_at is not None
            or issue.project.deleted_at is not None
            or issue.project.archived_at is not None
            or issue.project.workspace.deleted_at is not None
            or not valid_member
            or not receiver.is_active
            or not should_notify(receiver, approval.workspace_id, approval.project_id, "approval_requested", "email")
        ):
            delivery.status = "cancelled"
            delivery.save(update_fields=["status", "updated_at"])
            return
        host, username, password, port, use_tls, use_ssl, from_email = get_email_configuration()
        base_url = (settings.WEB_URL or settings.APP_BASE_URL or "").rstrip("/")
        if not host or not base_url:
            return
        chinese = getattr(getattr(receiver, "profile", None), "language", "en").startswith("zh")
        heading = "工作项等待审批" if chinese else "Work item awaiting approval"
        identifier = f"{issue.project.identifier}-{issue.sequence_id}"
        url = f"{base_url}/{issue.project.workspace.slug}/projects/{issue.project_id}/issues/{issue.pk}/"
        # Mark before SMTP: an uncertain delivery is not automatically resent.
        delivery.status = "sending"
        delivery.save(update_fields=["status", "updated_at"])
    try:
        message = EmailMultiAlternatives(
            subject=f"{heading}: {identifier}",
            body=f"{heading}: {identifier} {issue.name}\n{url}",
            from_email=from_email,
            to=[receiver.email],
            connection=get_connection(
                host=host,
                port=int(port),
                username=username,
                password=password,
                use_tls=use_tls == "1",
                use_ssl=use_ssl == "1",
                timeout=15,
            ),
        )
        sent = message.send() == 1
    except Exception:
        WorkflowApprovalEmail.objects.filter(pk=delivery_id, status="sending").update(status="unknown")
        logger.warning("Approval email delivery outcome is unknown")
        return
    WorkflowApprovalEmail.objects.filter(pk=delivery_id, status="sending").update(
        status="sent" if sent else "failed",
        sent_at=timezone.now() if sent else None,
    )
