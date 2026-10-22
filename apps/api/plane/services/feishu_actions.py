"""Execute authenticated, persisted card intents through the normal issue write paths."""

import json
from types import SimpleNamespace
from uuid import UUID

from crum import impersonate
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from plane.app.serializers.issue import IssueCreateSerializer, IssueDetailSerializer
from plane.bgtasks.issue_activities_task import issue_activity
from plane.bgtasks.webhook_task import model_activity
from plane.db.models import Issue, Project, ProjectMember, User, Workspace, WorkspaceMember
from plane.db.models.feishu import FeishuBinding, FeishuCardAction, FeishuDelivery
from plane.services.workflow_approval import decide_approval
from plane.utils.feishu_client import get_feishu_config
from plane.utils.workflow import WorkflowConflict


def _invalid():
    raise ValidationError({"action": "FEISHU_ACTION_INVALID"})


def _uuid(payload, key):
    try:
        return UUID(str(payload[key]))
    except (KeyError, ValueError, TypeError, AttributeError):
        _invalid()


class _Completed(Exception):
    def __init__(self, result):
        self.result = result


def _context(action, *, locked=False, issue=None):
    """Recheck current authority; locked callers already hold project and issue locks.

    User precedes binding (OAuth/unbind), then delivery/action (callbacks/workers).
    Lock memberships too so revocation cannot race the final business write.
    """

    def rows(model):
        return model.objects.select_for_update() if locked else model.objects

    recipient_id = FeishuDelivery.objects.values_list("user_id", flat=True).get(pk=action.delivery_id)
    actor = rows(User).get(pk=recipient_id)
    binding = rows(FeishuBinding).filter(pk=action.binding_id).first()
    delivery = rows(FeishuDelivery).get(pk=action.delivery_id)
    current = rows(FeishuCardAction).get(pk=action.pk)
    if current.status == "succeeded":
        raise _Completed(current.result)
    if current.status not in ("queued", "processing"):
        raise WorkflowConflict({"action": "FEISHU_ACTION_NOT_PENDING"})
    if current.expires_at <= timezone.now():
        raise WorkflowConflict({"action": "FEISHU_ACTION_EXPIRED"})
    config = get_feishu_config()
    if (
        not config.enabled
        or current.delivery_id != action.delivery_id
        or current.binding_id != action.binding_id
        or current.operation != action.operation
        or current.payload != action.payload
        or not binding
        or binding.app_id != config.app_id
        or delivery.user_id != actor.pk
        or delivery.binding_id != binding.pk
        or delivery.user_id != binding.user_id
        or delivery.is_test
    ):
        raise PermissionDenied("FEISHU_ACTION_IDENTITY_CHANGED")
    project = (
        rows(Project)
        .filter(
            pk=delivery.project_id,
            workspace_id=delivery.workspace_id,
            archived_at__isnull=True,
            deleted_at__isnull=True,
        )
        .first()
    )
    workspace = rows(Workspace).filter(pk=delivery.workspace_id, deleted_at__isnull=True).first()
    issue = issue or rows(Issue).filter(pk=delivery.issue_id).first()
    if (
        not actor.is_active
        or not project
        or not workspace
        or not issue
        or issue.pk != delivery.issue_id
        or issue.project_id != project.pk
        or issue.workspace_id != workspace.pk
        or issue.archived_at
        or issue.is_draft
        or issue.deleted_at
    ):
        raise PermissionDenied("FEISHU_ACTION_UNAVAILABLE")
    project_member = (
        rows(ProjectMember).filter(project=project, workspace=workspace, member=actor, is_active=True).first()
    )
    workspace_member = rows(WorkspaceMember).filter(workspace=workspace, member=actor, is_active=True).first()
    if not project_member or not workspace_member:
        raise PermissionDenied("FEISHU_ACTION_PERMISSION_DENIED")
    if action.operation == "state" and not (
        project_member.role in (15, 20) or workspace_member.role == 20 or issue.created_by_id == actor.pk
    ):
        raise PermissionDenied("FEISHU_ACTION_PERMISSION_DENIED")
    # Approval eligibility and the branch's approver snapshot are checked by decide_approval.
    return current, delivery, actor, issue


def _succeed(action, result):
    action.status = "succeeded"
    action.result = result
    action.completed_at = timezone.now()
    action.save(update_fields=["status", "result", "completed_at"])
    return result


class _CardStateSerializer(IssueCreateSerializer):
    def verify_locked_write(self, issue):
        action = self.context["card_action"]
        self.card_action, self.delivery, actor, _ = _context(action, locked=True, issue=issue)
        if (
            issue.state_id != self.context["expected_state_id"]
            or issue.updated_at != self.context["expected_updated_at"]
        ):
            raise WorkflowConflict({"action": "FEISHU_ACTION_STALE"})
        self.state_before = issue.state.name
        self.before = json.dumps(IssueDetailSerializer(issue).data, cls=DjangoJSONEncoder)
        self.actor = actor

    def finish_locked_write(self, issue):
        _succeed(
            self.card_action,
            {
                "code": "state_updated",
                "state_before": self.state_before,
                "state_after": issue.state.name,
                "actor_name": self.actor.display_name or self.actor.first_name,
            },
        )
        data = {"state_id": str(issue.state_id)}
        activity_kwargs = {
            "type": "issue.activity.updated",
            "requested_data": json.dumps(data),
            "actor_id": str(self.actor.pk),
            "issue_id": str(issue.pk),
            "project_id": str(issue.project_id),
            "current_instance": self.before,
            "epoch": int(timezone.now().timestamp()),
            "notification": True,
            "origin": settings.APP_BASE_URL or settings.WEB_URL,
        }
        webhook_kwargs = {
            "model_name": "issue",
            "model_id": str(issue.pk),
            "requested_data": data,
            "current_instance": self.before,
            "actor_id": str(self.actor.pk),
            "slug": self.delivery.workspace.slug,
            "origin": activity_kwargs["origin"],
        }
        transaction.on_commit(lambda: issue_activity.delay(**activity_kwargs), robust=True)
        transaction.on_commit(lambda: model_activity.delay(**webhook_kwargs), robust=True)


def execute_card_action(action):
    """Return a safe result, or raise a DRF error for the worker to mark failed.

    Never wrap this function in atomic(): workflow scripts prepare outside locks.
    Successful replays do not repeat writes or enqueue duplicate activities.
    """
    try:
        action = FeishuCardAction.objects.get(pk=action.pk)
        action, delivery, actor, issue = _context(action)
        if not isinstance(action.payload, dict):
            _invalid()
        if action.operation == "state":
            target = _uuid(action.payload, "state_id")
            source = _uuid(action.payload, "expected_state_id")
            try:
                expected_at = parse_datetime(action.payload["expected_updated_at"])
            except (KeyError, TypeError, ValueError):
                _invalid()
            if expected_at is None or timezone.is_naive(expected_at):
                _invalid()
            serializer = _CardStateSerializer(
                issue,
                data={"state_id": str(target)},
                partial=True,
                context={
                    "request": SimpleNamespace(user=actor),
                    "project_id": issue.project_id,
                    "card_action": action,
                    "expected_state_id": source,
                    "expected_updated_at": expected_at,
                },
            )
            serializer.is_valid(raise_exception=True)
            with impersonate(actor):
                serializer.save()
            return serializer.card_action.result
        if action.operation in ("approve", "reject"):
            approval_id = _uuid(action.payload, "approval_id")
            transition_id = _uuid(action.payload, "transition_id")
            version = action.payload.get("version")
            if type(version) is not int or version < 1:
                _invalid()
            locked_action = None

            def verify(issue):
                nonlocal locked_action
                locked_action, _, _, _ = _context(action, locked=True, issue=issue)

            result = {"code": "approved" if action.operation == "approve" else "rejected"}

            def complete(approval):
                branch = next(branch for branch in approval.branches if branch["id"] == str(transition_id))
                target = branch["destination" if action.operation == "approve" else "reject_state"]
                result.update(
                    {
                        "state_before": branch["source"]["name"],
                        "state_after": target["name"],
                        "actor_name": actor.display_name or actor.first_name,
                    }
                )
                _succeed(locked_action, result)

            with impersonate(actor):
                decide_approval(
                    delivery.project_id,
                    delivery.issue_id,
                    approval_id,
                    transition_id,
                    action.operation,
                    version,
                    str(action.pk),
                    actor,
                    verify_locked=verify,
                    complete_locked=complete,
                )
            return result
        _invalid()
    except _Completed as completed:
        return completed.result
    except ObjectDoesNotExist:
        raise PermissionDenied("FEISHU_ACTION_UNAVAILABLE") from None
    except APIException:
        # A concurrent worker may have completed while this worker prepared its write.
        current = FeishuCardAction.objects.filter(pk=action.pk, status="succeeded").first()
        if current:
            return current.result
        raise
