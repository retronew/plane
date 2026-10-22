from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from plane.bgtasks import notification_task as tasks
from plane.bgtasks import workflow_runner_task as workflow_tasks

pytestmark = pytest.mark.unit


def test_completed_state_has_precedence():
    with patch.object(tasks.State.objects, "filter") as states:
        states.return_value.exists.return_value = True
        assert tasks.activity_event({"field": "state", "new_identifier": "state"}, "project") == "issue_completed"
        states.return_value.exists.return_value = False
        assert tasks.activity_event({"field": "state", "new_identifier": "state"}, "project") == "state_change"


@pytest.mark.parametrize("activity", [{"field": "comment"}, {"field": "other", "issue_comment": "comment-id"}])
def test_comments_do_not_fall_back_to_property_changes(activity):
    assert tasks.activity_event(activity, "project") == "comment"


def test_mention_outbox_key_uses_activity_and_separate_event():
    project = SimpleNamespace(pk="project", workspace_id="workspace")
    issue = SimpleNamespace(pk="issue", name="Issue")
    preference = Mock()
    preference.should_notify.return_value = True
    with patch.object(tasks, "enqueue_feishu_notification") as enqueue:
        tasks.queue_activity_feishu(project, issue, "receiver", {"id": "activity"}, "mention", "Mention", preference)
    assert enqueue.call_args.kwargs["event_key"] == "issue-activity:activity:mention"
    assert enqueue.call_args.kwargs["user_id"] == "receiver"
    preference.should_notify.assert_called_once_with("mention", "feishu")


def test_approval_feishu_does_not_depend_on_email_delivery_status():
    approval = SimpleNamespace(
        pk="approval",
        workspace_id="workspace",
        project_id="project",
        issue_id="issue",
        issue=SimpleNamespace(name="Issue"),
        branches=[{"approvers": [{"id": "receiver"}]}],
    )
    with (
        patch.object(workflow_tasks.WorkflowApproval.objects, "filter") as approvals,
        patch.object(workflow_tasks.WorkflowApprovalEmail.objects, "get_or_create") as deliveries,
        patch.object(workflow_tasks, "should_notify", return_value=True),
        patch.object(workflow_tasks, "enqueue_feishu_notification") as enqueue,
        patch.object(workflow_tasks.send_approval_email, "delay") as email,
    ):
        approvals.return_value.first.return_value = approval
        deliveries.return_value = (SimpleNamespace(status="sent"), False)
        workflow_tasks.queue_approval_email("approval")
    assert enqueue.call_args.kwargs["event_key"] == "approval-requested:approval"
    assert enqueue.call_args.kwargs["kind"] == "approval_requested"
    email.assert_not_called()
