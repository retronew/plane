# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

"""Schema 1 notification cards with recipient-scoped, immutable action contexts."""

from datetime import timedelta
from urllib.parse import quote
from uuid import UUID

from bs4 import BeautifulSoup
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from plane.db.models import Issue, IssueActivity, WorkflowApproval
from plane.db.models.feishu import FeishuCardAction, FeishuDelivery
from plane.services.workflow_approval import _decision_context
from plane.utils.feishu_client import get_feishu_callback_config
from plane.utils.workflow import (
    _eligible_actor,
    resolve_issue_workflow,
    validate_workflow_write,
    workflow_is_enforced,
    workflow_states,
)

EVENTS = {
    "property_change": ("工作项已更新", "Work item updated", "blue"),
    "state_change": ("状态已变更", "Status changed", "blue"),
    "issue_completed": ("工作项已完成", "Work item completed", "green"),
    "comment": ("新评论", "New comment", "turquoise"),
    "mention": ("有人提及你", "You were mentioned", "purple"),
    "due_reminder": ("工作项到期提醒", "Work item due reminder", "orange"),
    "approval_requested": ("待你审批", "Approval requested", "orange"),
    "intake_created": ("新接收请求", "New intake request", "purple"),
    "test": ("飞书通知测试", "Feishu notification test", "blue"),
}
FIELDS = {
    "name": ("名称", "Name"),
    "description": ("描述", "Description"),
    "state": ("状态", "Status"),
    "priority": ("优先级", "Priority"),
    "assignees": ("负责人", "Assignees"),
    "target_date": ("截止日期", "Due date"),
    "start_date": ("开始日期", "Start date"),
    "labels": ("标签", "Labels"),
    "cycle": ("周期", "Cycle"),
    "modules": ("模块", "Modules"),
    "estimate_point": ("估算", "Estimate"),
}
PRIORITIES = {
    "urgent": ("紧急", "Urgent"),
    "high": ("高", "High"),
    "medium": ("中", "Medium"),
    "low": ("低", "Low"),
    "none": ("无", "None"),
}


def _text(content):
    return {"tag": "plain_text", "content": str(content)}


def _div(content):
    return {"tag": "div", "text": _text(content)}


def _plain(value, limit=1000):
    soup = BeautifulSoup(str(value or "")[:20000], "html.parser")
    for node in soup(["script", "style"]):
        node.decompose()
    text = soup.get_text(" ", strip=True)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _event_id(delivery, prefix):
    key = getattr(delivery, "event_key", "")
    if not key.startswith(prefix):
        return None
    try:
        return UUID(key[len(prefix) :].split(":", 1)[0])
    except (ValueError, TypeError):
        return None


def _activity(delivery):
    activity_id = _event_id(delivery, "issue-activity:")
    approval_id = _event_id(delivery, "approval-requested:")
    if not activity_id and not approval_id:
        return None
    event_filter = (
        {"pk": activity_id}
        if activity_id
        else {"field": "approval", "verb": "requested", "new_identifier": approval_id}
    )
    return (
        IssueActivity.objects.filter(
            **event_filter,
            issue_id=delivery.issue_id,
            project_id=delivery.project_id,
            workspace_id=delivery.workspace_id,
        )
        .select_related("actor", "issue_comment")
        .first()
    )


def _approval(delivery):
    approval_id = _event_id(delivery, "approval-requested:")
    if not approval_id:
        return None
    return WorkflowApproval.objects.filter(
        pk=approval_id,
        issue_id=delivery.issue_id,
        project_id=delivery.project_id,
        workspace_id=delivery.workspace_id,
    ).first()


def _activity_elements(activity, chinese):
    if not activity:
        return []
    actor = activity.actor
    actor_name = (actor.display_name or actor.first_name) if actor else ("系统" if chinese else "System")
    elements = [_div(f"{'操作人' if chinese else 'By'}：{actor_name}")]
    if activity.field == "comment" or activity.issue_comment_id:
        # Prefer the event snapshot: a later edit must not rewrite this notification.
        content = activity.new_value
        if content is None and activity.issue_comment:
            content = activity.issue_comment.comment_html
        elements.append(_div(_plain(content) or ("评论已删除或内容不可用。" if chinese else "Comment unavailable.")))
    elif activity.old_value is not None or activity.new_value is not None:
        field = FIELDS.get(activity.field, (activity.field or "变更", activity.field or "Change"))[0 if chinese else 1]
        before, after = activity.old_value, activity.new_value
        if activity.field == "priority":
            before = PRIORITIES.get(before, (before, before))[0 if chinese else 1]
            after = PRIORITIES.get(after, (after, after))[0 if chinese else 1]
        elements.append(_div(f"{field}：{_plain(before, 350) or '—'} → {_plain(after, 350) or '—'}"))
    return elements


def _action_specs(delivery, issue, approval, chinese):
    """Return only operations that the recipient could perform through Plane now."""
    if (
        not issue
        or issue.archived_at
        or issue.project.archived_at
        or issue.project.deleted_at
        or issue.is_draft
        or not issue.state_id
        or issue.state.is_triage
        or issue.state.group == "triage"
        or not _eligible_actor(issue.project_id, delivery.user)
    ):
        return []
    specs = []
    if delivery.kind == "approval_requested":
        if not approval:
            return specs
        for branch in approval.branches:
            if str(delivery.user_id) not in {str(person.get("id")) for person in branch.get("approvers", [])}:
                continue
            for operation in ("approve", "reject"):
                try:
                    rule, target = _decision_context(approval, issue, branch["id"], delivery.user, operation)
                except APIException:
                    continue
                verb = {"approve": ("批准", "Approve"), "reject": ("拒绝", "Reject")}[operation][0 if chinese else 1]
                specs.append(
                    {
                        "key": f"{operation}:{approval.pk}:{branch['id']}",
                        "operation": operation,
                        "payload": {
                            "approval_id": str(approval.pk),
                            "transition_id": branch["id"],
                            "version": approval.version,
                        },
                        "label": (
                            f"{verb} → {target.name}"
                            if operation == "approve"
                            else f"{verb} {rule.destination.name} → {target.name}"
                        )[:100],
                    }
                )
        return specs
    # A pending approval must never expose an ordinary status shortcut.
    if WorkflowApproval.objects.filter(issue=issue, status="pending").exists():
        return specs
    workflow = resolve_issue_workflow(issue.project_id, issue.type_id)
    states = workflow_states(issue.project_id, workflow if workflow_is_enforced(issue.project_id, workflow) else None)
    for state in states.exclude(pk=issue.state_id).order_by("sequence", "id"):
        try:
            validate_workflow_write(issue.project_id, {"state": state}, instance=issue, actor=delivery.user)
        except APIException:
            continue
        specs.append(
            {
                "key": f"state:{state.pk}",
                "operation": "state",
                "payload": {
                    "state_id": str(state.pk),
                    "expected_state_id": str(issue.state_id),
                    "expected_updated_at": issue.updated_at.isoformat(),
                },
                "label": state.name[:100],
            }
        )
    return specs


def _interactive_elements(delivery, issue, approval, chinese):
    if not getattr(delivery, "pk", None) or getattr(delivery, "is_test", False):
        return []
    with transaction.atomic():
        # Serialize first rendering with retries and callbacks. Never supplement an
        # existing action set with actions for a different issue/approval context.
        locked = FeishuDelivery.objects.select_for_update().get(pk=delivery.pk)
        actions = list(FeishuCardAction.objects.filter(delivery=locked).order_by("created_at", "key"))
        used = next((action for action in actions if action.status != "pending"), None)
        if used:
            messages = {
                "queued": ("操作已提交，等待处理。", "Action submitted; waiting to be processed."),
                "processing": ("操作处理中。", "Action is being processed."),
                "succeeded": ("操作成功。", "Action completed successfully."),
                "failed": ("操作失败，请在 Plane 中查看并重试。", "Action failed. Open Plane to review and retry."),
            }
            return [
                _div(messages.get(used.status, ("操作已失效。", "Action is no longer available."))[0 if chinese else 1])
            ]
        expires_at = locked.created_at + timedelta(hours=24)
        if expires_at <= timezone.now():
            return (
                [
                    _div(
                        "快捷操作已过期，请在 Plane 中查看。"
                        if chinese
                        else "Quick actions expired. Open Plane to continue."
                    )
                ]
                if actions
                else []
            )
        config = get_feishu_callback_config()
        if not config.verification_token or not config.encrypt_key or not locked.binding_id:
            return []
        if locked.binding.user_id != delivery.user_id:
            return []
        specs = _action_specs(delivery, issue, approval, chinese)
        if not actions:
            for spec in specs:
                action, _ = FeishuCardAction.objects.get_or_create(
                    delivery=locked,
                    key=spec["key"],
                    defaults={
                        "binding_id": locked.binding_id,
                        "operation": spec["operation"],
                        "payload": spec["payload"],
                        "expires_at": expires_at,
                    },
                )
                actions.append(action)
        eligible = {
            action.key: action
            for action in actions
            if action.binding_id == locked.binding_id and action.expires_at > timezone.now()
        }
        from plane.utils.feishu_card_security import action_token

        buttons, options = [], []
        for spec in specs:
            action = eligible.get(spec["key"])
            if not action or action.payload != spec["payload"] or action.operation != spec["operation"]:
                continue
            token = action_token(action)
            if action.operation == "state":
                options.append({"text": _text(spec["label"]), "value": token})
            else:
                buttons.append(
                    {
                        "tag": "button",
                        "text": _text(spec["label"]),
                        "type": "primary" if action.operation == "approve" else "danger",
                        "behaviors": [{"type": "callback", "value": {"token": token}}],
                        "confirm": {
                            "title": _text("确认审批" if chinese else "Confirm decision"),
                            "text": _text(spec["label"]),
                        },
                    }
                )
        elements = [{"tag": "action", "actions": buttons[index : index + 2]} for index in range(0, len(buttons), 2)]
        if options:
            elements.append(
                {
                    "tag": "action",
                    "actions": [
                        {
                            "tag": "select_static",
                            "placeholder": _text("变更状态" if chinese else "Change status"),
                            "options": options,
                            "behaviors": [{"type": "callback", "value": {"kind": "state"}}],
                        }
                    ],
                }
            )
        return elements


def delivery_card(delivery):
    from plane.utils.feishu import web_url

    chinese = (getattr(getattr(delivery.user, "profile", None), "language", "en") or "en").startswith("zh")
    kind = getattr(delivery, "kind", "")
    event = EVENTS.get(kind, (delivery.title, delivery.title, "blue"))
    issue = None
    if getattr(delivery, "issue_id", None):
        # Refreshes must reflect the committed action even when delivery.issue was cached.
        issue = (
            Issue.objects.filter(
                pk=delivery.issue_id, project_id=delivery.project_id, workspace_id=delivery.workspace_id
            )
            .select_related("state", "project")
            .first()
        )
    activity = _activity(delivery) if issue else None
    approval = _approval(delivery) if issue and kind == "approval_requested" else None
    path = "settings/profile/notifications/"
    elements = []
    if delivery.workspace_id:
        slug = quote(delivery.workspace.slug, safe="")
        path = f"{slug}/notifications/"
        if issue:
            identifier = quote(f"{issue.project.identifier}-{issue.sequence_id}", safe="")
            path = f"{slug}/browse/{identifier}/"
            if activity and activity.issue_comment_id:
                path += f"#comment-{activity.issue_comment_id}"
    if issue:
        elements.append(_div(f"{issue.project.identifier}-{issue.sequence_id} · {issue.name}"[:500]))
        elements.extend(_activity_elements(activity, chinese))
        priority = PRIORITIES.get(issue.priority, (issue.priority, issue.priority))[0 if chinese else 1]
        state = issue.state.name if issue.state else "—"
        due = issue.target_date.isoformat() if issue.target_date else "—"
        elements.append(
            _div(
                f"{'当前状态' if chinese else 'Current status'}：{state}\n"
                f"{'优先级' if chinese else 'Priority'}：{priority}\n"
                f"{'截止日期' if chinese else 'Due date'}：{due}"
            )
        )
        if kind == "approval_requested" and approval:
            elements.append(_div("请确认下方属于你的审批分支。" if chinese else "Review your approval branches below."))
    else:
        elements.append(
            _div(
                delivery.body[:500]
                or ("你有一条新的 Plane 通知。" if chinese else "You have a new notification in Plane.")
            )
        )
    elements.extend(_interactive_elements(delivery, issue, approval, chinese))
    elements.append(
        {
            "tag": "action",
            "actions": [
                {
                    "tag": "button",
                    "text": _text("在 Plane 中查看" if chinese else "Open in Plane"),
                    "type": "default",
                    "url": web_url(path),
                }
            ],
        }
    )
    return {
        "config": {"wide_screen_mode": True, "update_multi": True},
        "header": {"title": _text(event[0 if chinese else 1][:100]), "template": event[2]},
        "elements": elements,
    }
