# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from plane.db.models import Issue, IssueActivity, IssueComment, Project, ProjectMember, State, User
from plane.db.models.feishu import FeishuBinding, FeishuCardAction, FeishuDelivery
from plane.db.models.workflow import ProjectWorkflow, WorkflowApproval, WorkflowTransition
from plane.services.workflow_approval import transition_snapshot
from plane.utils.feishu import delivery_card
from plane.utils.feishu_card_security import action_token
from plane.utils.feishu_client import FeishuCallbackConfig

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def card_context(workspace, create_user, settings):
    settings.WEB_URL = "https://plane.example"
    project = Project.objects.create(workspace=workspace, name="Cards", identifier="CARD")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    review = State.objects.create(project=project, name="Review", group="started", default=True)
    done = State.objects.create(project=project, name="Done", group="completed")
    rejected = State.objects.create(project=project, name="Rejected", group="cancelled")
    issue = Issue.objects.create(project=project, name="Ship cards", state=review, priority="high")
    binding = FeishuBinding.objects.create(user=create_user, app_id="app", tenant_key="tenant", open_id="open")
    delivery = FeishuDelivery.objects.create(
        user=create_user,
        binding=binding,
        workspace=workspace,
        project=project,
        issue=issue,
        event_key="event",
        kind="state_change",
        title="Ship cards",
    )
    with patch(
        "plane.utils.feishu_cards.get_feishu_callback_config", return_value=FeishuCallbackConfig("token", "key")
    ):
        yield delivery, issue, review, done, rejected


def controls(card):
    return [action for element in card["elements"] if element["tag"] == "action" for action in element["actions"]]


def text(card):
    return "\n".join(element["text"]["content"] for element in card["elements"] if element["tag"] == "div")


def approval_context(context):
    delivery, issue, review, done, rejected = context
    workflow = ProjectWorkflow.objects.create(project=issue.project, enabled=True)
    rule = WorkflowTransition.objects.create(
        project=issue.project,
        workflow=workflow,
        source=review,
        destination=done,
        kind="approval",
        reject_state=rejected,
        approver_mode="explicit",
    )
    rule.approvers.add(delivery.user)
    approval = WorkflowApproval.objects.create(
        project=issue.project,
        issue=issue,
        source=review,
        workflow=workflow,
        branches=[transition_snapshot(rule, approval=True)],
    )
    delivery.kind = "approval_requested"
    delivery.event_key = f"approval-requested:{approval.pk}"
    delivery.save()
    return approval, rule


@pytest.mark.parametrize(
    "kind,color",
    [
        ("property_change", "blue"),
        ("state_change", "blue"),
        ("issue_completed", "green"),
        ("comment", "turquoise"),
        ("mention", "purple"),
        ("due_reminder", "orange"),
        ("approval_requested", "orange"),
        ("intake_created", "purple"),
    ],
)
def test_event_theme_and_current_issue_details(card_context, kind, color):
    delivery, issue, *_ = card_context
    delivery.kind = kind
    card = delivery_card(delivery)
    assert card["header"]["template"] == color
    assert f"CARD-{issue.sequence_id} · Ship cards" in text(card)
    assert "Current status：Review" in text(card)
    assert "Priority：High" in text(card)
    assert controls(card)[-1]["url"] == (
        f"https://plane.example/{delivery.workspace.slug}/browse/CARD-{issue.sequence_id}/"
    )


def test_activity_snapshot_contains_actor_old_new_and_plain_text(card_context):
    delivery, issue, *_ = card_context
    activity = IssueActivity.objects.create(
        project=issue.project, issue=issue, actor=delivery.user, field="state", old_value="Todo", new_value="Review"
    )
    delivery.event_key = f"issue-activity:{activity.pk}:state_change"
    card = delivery_card(delivery)
    assert "Todo → Review" in text(card)
    assert delivery.user.display_name in text(card)
    assert all(e["text"]["tag"] == "plain_text" for e in card["elements"] if e["tag"] == "div")


def test_comment_snapshot_and_anchor(card_context):
    delivery, issue, *_ = card_context
    comment = IssueComment.objects.create(
        project=issue.project, issue=issue, actor=delivery.user, comment_html="<p>Later edit</p>"
    )
    activity = IssueActivity.objects.create(
        project=issue.project,
        issue=issue,
        actor=delivery.user,
        field="comment",
        issue_comment=comment,
        new_value="<p>Original <b>comment</b> &amp; details</p><script>hidden</script>",
    )
    delivery.kind = "mention"
    delivery.event_key = f"issue-activity:{activity.pk}:mention"
    card = delivery_card(delivery)
    assert "Original comment & details" in text(card)
    assert "Later edit" not in text(card) and "hidden" not in text(card)
    assert controls(card)[-1]["url"].endswith(f"/browse/CARD-{issue.sequence_id}/#comment-{comment.pk}")


def test_activity_from_another_issue_is_not_exposed(card_context):
    delivery, issue, *_ = card_context
    other = Issue.objects.create(project=issue.project, name="Other")
    activity = IssueActivity.objects.create(
        project=issue.project, issue=other, field="name", new_value="Private activity"
    )
    delivery.event_key = f"issue-activity:{activity.pk}:property_change"
    assert "Private activity" not in text(delivery_card(delivery))


def test_signed_state_options_keep_fixed_context_and_expiry(card_context):
    delivery, issue, review, *_ = card_context
    card = delivery_card(delivery)
    select = next(action for action in controls(card) if action["tag"] == "select_static")
    assert select["behaviors"] == [{"type": "callback", "value": {"kind": "state"}}]
    actions = list(FeishuCardAction.objects.filter(delivery=delivery))
    assert {option["value"] for option in select["options"]} == {action_token(action) for action in actions}
    assert all(len(option["value"]) <= 100 for option in select["options"])
    assert len(actions) == 2
    for action in actions:
        assert action.payload["expected_state_id"] == str(review.pk)
        assert action.payload["expected_updated_at"] == issue.updated_at.isoformat()
        assert action.expires_at == delivery.created_at + timedelta(hours=24)
    original = {action.pk: (action.payload, action.expires_at) for action in actions}
    delivery_card(delivery)
    issue.name = "Changed after notification"
    issue.save()
    refreshed = delivery_card(delivery)
    assert "Changed after notification" in text(refreshed)
    assert not any(action["tag"] == "select_static" for action in controls(refreshed))
    assert {
        action.pk: (action.payload, action.expires_at) for action in FeishuCardAction.objects.filter(delivery=delivery)
    } == original


@pytest.mark.parametrize("status", ["queued", "processing", "succeeded", "failed"])
def test_claimed_action_hides_every_other_operation(card_context, status):
    delivery, *_ = card_context
    delivery_card(delivery)
    action = FeishuCardAction.objects.filter(delivery=delivery).first()
    action.status = status
    action.save()
    card = delivery_card(delivery)
    assert len(controls(card)) == 1 and "url" in controls(card)[0]
    assert "Action" in text(card)


def test_expiry_does_not_extend_on_resend(card_context):
    delivery, *_ = card_context
    delivery.created_at = timezone.now() - timedelta(hours=23)
    delivery.save()
    delivery_card(delivery)
    original = list(FeishuCardAction.objects.filter(delivery=delivery).values_list("expires_at", flat=True))
    with patch("plane.utils.feishu_cards.timezone.now", return_value=timezone.now() + timedelta(hours=2)):
        card = delivery_card(delivery)
    assert len(controls(card)) == 1 and "expired" in text(card)
    assert list(FeishuCardAction.objects.filter(delivery=delivery).values_list("expires_at", flat=True)) == original


@pytest.mark.parametrize("token,key", [("", "key"), ("token", ""), ("", "")])
def test_incomplete_callback_config_disables_operations(card_context, token, key):
    delivery, *_ = card_context
    with patch("plane.utils.feishu_cards.get_feishu_callback_config", return_value=FeishuCallbackConfig(token, key)):
        assert len(controls(delivery_card(delivery))) == 1
    assert not FeishuCardAction.objects.filter(delivery=delivery).exists()


def test_guest_or_revoked_membership_has_no_quick_actions(card_context):
    delivery, issue, *_ = card_context
    ProjectMember.objects.filter(project=issue.project, member=delivery.user).update(role=5)
    assert len(controls(delivery_card(delivery))) == 1
    ProjectMember.objects.filter(project=issue.project, member=delivery.user).update(role=15, is_active=False)
    assert len(controls(delivery_card(delivery))) == 1
    assert not FeishuCardAction.objects.filter(delivery=delivery).exists()


def test_transition_member_restriction_filters_state_options(card_context):
    delivery, issue, review, done, _ = card_context
    workflow = ProjectWorkflow.objects.create(project=issue.project, enabled=True)
    rule = WorkflowTransition.objects.create(project=issue.project, workflow=workflow, source=review, destination=done)
    other = User.objects.create(email="other-card@example.com", username="other-card")
    rule.members.add(other)
    assert len(controls(delivery_card(delivery))) == 1
    rule.members.add(delivery.user)
    select = next(action for action in controls(delivery_card(delivery)) if action["tag"] == "select_static")
    assert [option["text"]["content"] for option in select["options"]] == ["Done"]


def test_approval_exposes_only_recipient_branches_with_confirmation(card_context):
    delivery, issue, review, _, rejected = card_context
    approval, rule = approval_context(card_context)
    other_target = State.objects.create(project=issue.project, name="Other approval", group="completed")
    other_rule = WorkflowTransition.objects.create(
        project=issue.project,
        workflow=rule.workflow,
        source=review,
        destination=other_target,
        kind="approval",
        reject_state=rejected,
        approver_mode="explicit",
    )
    other = User.objects.create(email="other-approver-card@example.com", username="other-approver-card")
    other_rule.approvers.add(other)
    approval.branches.append(transition_snapshot(other_rule, approval=True))
    approval.save()
    buttons = [action for action in controls(delivery_card(delivery)) if "behaviors" in action]
    assert len(buttons) == 2
    assert all(button["tag"] == "button" and "confirm" in button for button in buttons)
    assert all(button["behaviors"][0]["value"].get("token") for button in buttons)
    actions = FeishuCardAction.objects.filter(delivery=delivery)
    assert set(actions.values_list("operation", flat=True)) == {"approve", "reject"}
    assert all(
        action.payload == {"approval_id": str(approval.pk), "transition_id": str(rule.pk), "version": approval.version}
        for action in actions
    )
    rule.approvers.clear()
    assert len(controls(delivery_card(delivery))) == 1
    assert actions.count() == 2


def test_every_recipient_approval_branch_gets_its_own_pair(card_context):
    delivery, issue, review, _, rejected = card_context
    approval, rule = approval_context(card_context)
    target = State.objects.create(project=issue.project, name="Second branch", group="completed")
    second = WorkflowTransition.objects.create(
        project=issue.project,
        workflow=rule.workflow,
        source=review,
        destination=target,
        kind="approval",
        reject_state=rejected,
        approver_mode="explicit",
    )
    second.approvers.add(delivery.user)
    approval.branches.append(transition_snapshot(second, approval=True))
    approval.save()
    buttons = [action for action in controls(delivery_card(delivery)) if "behaviors" in action]
    assert len(buttons) == 4
    assert {action.payload["transition_id"] for action in FeishuCardAction.objects.filter(delivery=delivery)} == {
        str(rule.pk),
        str(second.pk),
    }
    assert len({button["text"]["content"] for button in buttons}) == 4


def test_chinese_profile_localizes_event_and_actions(card_context):
    delivery, *_ = card_context
    from plane.db.models import Profile

    Profile.objects.update_or_create(user=delivery.user, defaults={"language": "zh-CN"})
    card = delivery_card(delivery)
    assert card["header"]["title"]["content"] == "状态已变更"
    assert "优先级：高" in text(card)
    assert controls(card)[-1]["text"]["content"] == "在 Plane 中查看"


def test_archived_project_does_not_expose_actions(card_context):
    delivery, issue, *_ = card_context
    Project.objects.filter(pk=issue.project_id).update(archived_at=timezone.now())
    assert len(controls(delivery_card(delivery))) == 1
    assert not FeishuCardAction.objects.filter(delivery=delivery).exists()


def test_pending_approval_blocks_state_picker_on_other_events(card_context):
    delivery, *_ = card_context
    approval_context(card_context)
    delivery.kind = "state_change"
    delivery.event_key = "other-event"
    delivery.save()
    assert len(controls(delivery_card(delivery))) == 1
    assert not FeishuCardAction.objects.filter(delivery=delivery).exists()


def test_stale_approval_version_never_rebinds_old_actions(card_context):
    delivery, *_ = card_context
    approval, _ = approval_context(card_context)
    delivery_card(delivery)
    approval.version += 1
    approval.save()
    assert len(controls(delivery_card(delivery))) == 1
    assert all(action.payload["version"] == 1 for action in FeishuCardAction.objects.filter(delivery=delivery))
