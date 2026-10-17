from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, local

import pytest
from django.db import close_old_connections, transaction

from plane.db.models import Issue, IssueActivity, Project, ProjectMember, State, User, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowApproval, WorkflowTransition
from plane.services import workflow_approval
from plane.utils.workflow import WorkflowConflict

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]


def test_two_simultaneous_approvers_commit_one_decision_and_one_successor(workspace, create_user, monkeypatch):
    from plane.bgtasks import workflow_runner_task

    monkeypatch.setattr(workflow_runner_task, "queue_approval_email", lambda approval_id: None)
    project = Project.objects.create(workspace=workspace, name="Concurrent approval", identifier="CONCUR")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    other = User.objects.create(email="concurrent-approver@example.invalid", username="concurrent-approver")
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
    ProjectMember.objects.create(project=project, member=other, role=15)
    start = State.objects.create(project=project, name="Review", group="started", default=True)
    second = State.objects.create(project=project, name="Second review", group="started")
    done = State.objects.create(project=project, name="Done", group="completed")
    rejected = State.objects.create(project=project, name="Rejected", group="cancelled")
    workflow = ProjectWorkflow.objects.create(project=project, enabled=True)
    first_rule = WorkflowTransition.objects.create(
        project=project, workflow=workflow, source=start, destination=second, kind="approval", reject_state=rejected
    )
    WorkflowTransition.objects.create(
        project=project, workflow=workflow, source=second, destination=done, kind="approval", reject_state=rejected
    )
    issue = Issue.objects.create(project=project, state=start, name="Race")
    with transaction.atomic():
        Project.objects.select_for_update().get(pk=project.pk)
        Issue.objects.select_for_update().get(pk=issue.pk)
        approval = workflow_approval.sync_issue_approval(issue, create_user)

    # Both requests finish their lock-free eligibility check before either acquires
    # project -> issue -> approval locks. Calls after the barrier are lock-protected.
    prepared = Barrier(2, timeout=10)
    original = workflow_approval._decision_context
    local_calls = local()

    def check_then_barrier(*args, **kwargs):
        result = original(*args, **kwargs)
        count = getattr(local_calls, "count", 0)
        local_calls.count = count + 1
        if count == 0:
            prepared.wait()
        return result

    monkeypatch.setattr(workflow_approval, "_decision_context", check_then_barrier)

    def decide(actor_id):
        close_old_connections()
        try:
            actor = User.objects.get(pk=actor_id)
            result = workflow_approval.decide_approval(
                project.pk, issue.pk, approval.pk, first_rule.pk, "approve", 1, f"concurrent-{actor_id}", actor
            )
            return result.status
        except WorkflowConflict:
            return "conflict"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(decide, [create_user.pk, other.pk]))
    assert sorted(results) == ["approved", "conflict"]
    issue.refresh_from_db()
    approval.refresh_from_db()
    assert issue.state_id == second.pk
    assert approval.status == "approved" and approval.version == 2
    assert WorkflowApproval.objects.filter(issue=issue, status="pending", source=second, entry_sequence=2).count() == 1
    assert WorkflowApproval.objects.filter(issue=issue).count() == 2
    assert IssueActivity.objects.filter(issue=issue, field="approval", verb="approved").count() == 1
    assert IssueActivity.objects.filter(issue=issue, field="state", new_identifier=second.pk).count() == 1
