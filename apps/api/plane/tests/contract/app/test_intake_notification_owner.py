import json

import pytest

from plane.bgtasks.notification_task import notifications
from plane.db.models import (
    EmailNotificationLog,
    Intake,
    IntakeIssue,
    Issue,
    IssueActivity,
    Notification,
    Project,
    ProjectMember,
    State,
    User,
    UserNotificationPreference,
    WorkspaceMember,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def context(workspace, create_user):
    project = Project.objects.create(
        workspace=workspace, name="Intake notifications", identifier="INTAKE", intake_view=True
    )
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
    recipient = User.objects.create(email="triage@example.com", username="triage", first_name="Triage")
    WorkspaceMember.objects.create(workspace=workspace, member=recipient, role=15)
    ProjectMember.objects.create(workspace=workspace, project=project, member=recipient, role=15)
    UserNotificationPreference.objects.get_or_create(user=recipient)
    intake, _ = Intake.objects.get_or_create(
        workspace=workspace, project=project, defaults={"name": "Default", "is_default": True}
    )
    return workspace, project, intake, recipient, create_user


def url(context):
    workspace, project, intake, *_ = context
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/intakes/{intake.id}/"


def test_admin_can_set_and_clear_owner(session_client, context):
    _, _, intake, recipient, _ = context
    response = session_client.patch(url(context), {"notification_assignee": str(recipient.id)}, format="json")
    assert response.status_code == 200, response.data
    intake.refresh_from_db()
    assert intake.notification_assignee_id == recipient.id
    response = session_client.patch(url(context), {"notification_assignee": None}, format="json")
    assert response.status_code == 200
    intake.refresh_from_db()
    assert intake.notification_assignee_id is None


@pytest.mark.parametrize("kind", ["outsider", "guest", "inactive_project", "inactive_workspace"])
def test_rejects_ineligible_recipients(session_client, context, kind):
    workspace, project, _, recipient, _ = context
    if kind == "outsider":
        recipient = User.objects.create(email="outsider@example.com", username="outsider")
    elif kind == "guest":
        ProjectMember.objects.filter(project=project, member=recipient).update(role=5)
    elif kind == "inactive_project":
        ProjectMember.objects.filter(project=project, member=recipient).update(is_active=False)
    else:
        WorkspaceMember.objects.filter(workspace=workspace, member=recipient).update(is_active=False)
    assert (
        session_client.patch(url(context), {"notification_assignee": str(recipient.id)}, format="json").status_code
        == 400
    )


def test_member_cannot_change_owner(session_client, context):
    recipient = context[3]
    session_client.force_authenticate(user=recipient)
    assert (
        session_client.patch(url(context), {"notification_assignee": str(recipient.id)}, format="json").status_code
        == 403
    )


def new_request(context):
    workspace, project, intake, recipient, actor = context
    intake.notification_assignee = recipient
    intake.save(update_fields=["notification_assignee"])
    state = State.objects.create(workspace=workspace, project=project, name="Triage", group="triage")
    issue = Issue.objects.create(
        workspace=workspace, project=project, state=state, name="New request", created_by=actor
    )
    IntakeIssue.objects.create(workspace=workspace, project=project, intake=intake, issue=issue)
    IssueActivity.objects.create(
        workspace=workspace, project=project, issue=issue, actor=actor, verb="created", comment="created the issue"
    )
    return issue


def deliver(context, issue, kind="issue.activity.created", actor=None):
    notifications.run(
        type=kind,
        issue_id=str(issue.id),
        project_id=str(context[1].id),
        actor_id=str((actor or context[4]).id),
        subscriber=True,
        issue_activities_created="[]",
        requested_data=json.dumps({"issue": {"name": issue.name}}),
        current_instance=None,
    )


def test_creation_notifies_owner_once_without_changing_assignee(context):
    issue = new_request(context)
    deliver(context, issue)
    notification = Notification.objects.get(receiver=context[3], entity_identifier=issue.id)
    assert notification.sender == "in_app:intake:created"
    assert notification.data["issue"]["name"] == "New request"
    assert EmailNotificationLog.objects.filter(receiver=context[3], entity_identifier=issue.id).count() == 1
    assert not issue.assignees.exists()
    deliver(context, issue)
    assert Notification.objects.filter(receiver=context[3], entity_identifier=issue.id).count() == 1


@pytest.mark.parametrize("kind", ["cleared", "inactive", "disabled", "self", "update", "normal_issue"])
def test_does_not_notify_when_not_applicable(context, kind):
    issue = new_request(context)
    if kind == "cleared":
        Intake.objects.filter(pk=context[2].id).update(notification_assignee=None)
    elif kind == "inactive":
        ProjectMember.objects.filter(project=context[1], member=context[3]).update(is_active=False)
    elif kind == "disabled":
        Project.objects.filter(pk=context[1].id).update(intake_view=False)
    elif kind == "normal_issue":
        IntakeIssue.objects.filter(issue=issue).delete()
    deliver(
        context,
        issue,
        kind="issue.activity.updated" if kind == "update" else "issue.activity.created",
        actor=context[3] if kind == "self" else None,
    )
    assert not Notification.objects.filter(receiver=context[3], entity_identifier=issue.id).exists()


def test_email_follows_existing_preference(context):
    issue = new_request(context)
    UserNotificationPreference.objects.filter(user=context[3]).update(property_change=False)
    deliver(context, issue)
    assert Notification.objects.filter(receiver=context[3], entity_identifier=issue.id).exists()
    assert not EmailNotificationLog.objects.filter(receiver=context[3], entity_identifier=issue.id).exists()


def test_created_request_runs_through_the_activity_notification_pipeline(session_client, context):
    from unittest.mock import patch
    from plane.bgtasks.issue_activities_task import issue_activity

    workspace, project, intake, recipient, _ = context
    intake.notification_assignee = recipient
    intake.save(update_fields=["notification_assignee"])
    with (
        patch("plane.app.views.intake.base.issue_activity.delay") as enqueue,
        patch("plane.app.views.intake.base.issue_description_version_task.delay"),
    ):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/intake-issues/",
            {"issue": {"name": "Pipeline request"}},
            format="json",
        )
    assert response.status_code == 200, response.data
    with (
        patch("plane.bgtasks.issue_activities_task.notifications.delay") as notify,
        patch("plane.bgtasks.issue_activities_task.redis_instance"),
        patch("plane.bgtasks.issue_activities_task.capture_cycle_progress.delay"),
    ):
        issue_activity.run(**enqueue.call_args.kwargs)
    notify.assert_called_once()
    notifications.run(**notify.call_args.kwargs)
    assert (
        Notification.objects.filter(receiver=recipient, entity_identifier=enqueue.call_args.kwargs["issue_id"]).count()
        == 1
    )


def test_new_owner_without_preferences_uses_defaults(context):
    issue = new_request(context)
    UserNotificationPreference.objects.filter(user=context[3]).delete()
    deliver(context, issue)
    assert Notification.objects.filter(receiver=context[3], entity_identifier=issue.id).exists()
