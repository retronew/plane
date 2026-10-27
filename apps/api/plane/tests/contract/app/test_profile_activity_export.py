import csv
from datetime import datetime
from io import StringIO
from zoneinfo import ZoneInfo

import pytest

from plane.db.models import Issue, IssueActivity, Project, ProjectMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def test_export_uses_global_historical_state_and_event_timezone(session_client, workspace, create_user):
    workspace.timezone = "Asia/Shanghai"
    workspace.save()
    project = Project.objects.create(workspace=workspace, name="Export", identifier="EXP")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    issue = Issue.objects.create(project=project, name="=Unsafe title")
    zone = ZoneInfo(workspace.timezone)

    def activity(actor, hour, state):
        return IssueActivity.objects.create(
            project=project,
            workspace=workspace,
            issue=issue,
            actor=actor,
            field="state",
            new_value=state,
            epoch=datetime(2026, 10, 20, hour, tzinfo=zone).timestamp(),
        )

    activity(create_user, 1, "Done")
    # Later delivery of an older event must not win; another actor's final state must win.
    activity(None, 23, "In progress")
    activity(create_user, 2, "Cancelled")
    IssueActivity.objects.create(
        project=project,
        workspace=workspace,
        issue=issue,
        actor=create_user,
        field="state",
        new_value="Outside",
        epoch=datetime(2026, 10, 21, tzinfo=zone).timestamp(),
    )
    endpoint = f"/api/workspaces/{workspace.slug}/user-activity/{create_user.id}/export/"
    data = {"period": "custom", "start_date": "2026-10-20", "end_date": "2026-10-20"}
    response = session_client.post(endpoint, {**data, "preview": True}, format="json")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["state"] == "In progress"
    response = session_client.post(endpoint, data, format="json")
    rows = list(csv.reader(StringIO(response.content.decode())))
    assert len(rows) == 2
    assert rows[1][2:4] == ["'=Unsafe title", "In progress"]
    assert rows[1][4] == "2026-10-20T23:00:00+08:00"
    project.archived_at = datetime(2026, 10, 21, tzinfo=zone)
    project.save()
    response = session_client.post(endpoint, {**data, "preview": True}, format="json")
    assert response.data["count"] == 0


def test_export_rejects_reversed_and_invalid_dates(session_client, workspace, create_user):
    endpoint = f"/api/workspaces/{workspace.slug}/user-activity/{create_user.id}/export/"
    for start, end in [("2026-10-21", "2026-10-20"), ("bad", "2026-10-20")]:
        response = session_client.post(
            endpoint, {"period": "custom", "start_date": start, "end_date": end}, format="json"
        )
        assert response.status_code == 400


@pytest.fixture
def export_case(session_client, workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Boundary", identifier="BND")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    issue = Issue.objects.create(project=project, name="Boundary task")

    def make_activity(issue=issue, **overrides):
        return IssueActivity.objects.create(
            **{
                "project": issue.project,
                "workspace": workspace,
                "issue": issue,
                "actor": create_user,
                "field": "state",
                "new_value": "Todo",
                "epoch": datetime(2026, 10, 20, 12, tzinfo=ZoneInfo("UTC")).timestamp(),
                **overrides,
            }
        )

    def preview(day="2026-10-20"):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/user-activity/{create_user.id}/export/",
            {"period": "custom", "start_date": day, "end_date": day, "preview": True},
            format="json",
        )
        assert response.status_code == 200
        return response.data

    return project, issue, make_activity, preview


def test_same_epoch_uses_created_at_then_id_deterministically(export_case):
    _, _, activity, preview = export_case
    first = activity(new_value="Earlier delivery")
    second = activity(actor=None, new_value="Later delivery")
    assert preview()["results"][0]["state"] == "Later delivery"
    IssueActivity.objects.filter(pk__in=[first.pk, second.pk]).update(created_at=first.created_at)
    expected = max([first, second], key=lambda event: event.id).new_value
    assert preview()["results"][0]["state"] == expected
    assert preview()["results"][0]["state"] == expected


def test_export_excludes_projects_without_active_membership(export_case, workspace, create_user):
    project, _, activity, preview = export_case
    private = Project.objects.create(workspace=workspace, name="Private", identifier="PRV")
    hidden = Issue.objects.create(project=private, name="Hidden")
    activity(issue=hidden)
    activity()
    assert preview()["count"] == 1
    ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)
    assert preview()["count"] == 0


def test_more_than_10000_changes_are_not_truncated_before_deduplication(export_case, workspace, create_user):
    project, issue, activity, preview = export_case
    original = activity()
    other = Issue.objects.create(project=project, name="Must survive dedupe")
    # One bulk insert keeps this regression inexpensive while crossing the old hard limit.
    IssueActivity.objects.bulk_create(
        [
            IssueActivity(
                project=project,
                workspace=workspace,
                issue=issue,
                actor=create_user,
                field="state",
                new_value="Repeated",
                epoch=original.epoch + offset,
            )
            for offset in range(10001)
        ],
        batch_size=2000,
    )
    activity(issue=other, epoch=original.epoch - 1)
    result = preview()
    assert result["count"] == 2
    assert {row["name"] for row in result["results"]} == {issue.name, other.name}
    assert next(row for row in result["results"] if row["name"] == issue.name)["state"] == "Repeated"


@pytest.mark.parametrize("day,next_day,hours", [("2026-03-08", "2026-03-09", 23), ("2026-11-01", "2026-11-02", 25)])
def test_workspace_dst_day_includes_entire_local_day(export_case, workspace, day, next_day, hours):
    _, _, activity, preview = export_case
    workspace.timezone = "America/New_York"
    workspace.save()
    zone = ZoneInfo(workspace.timezone)
    start = datetime.fromisoformat(day).replace(tzinfo=zone).timestamp()
    end = datetime.fromisoformat(next_day).replace(tzinfo=zone).timestamp()
    assert end - start == hours * 3600
    activity(epoch=start - 1, new_value="Before")
    activity(epoch=start, new_value="Start")
    activity(epoch=end - 0.5, new_value="Last local instant")
    activity(epoch=end, new_value="Next day")
    result = preview(day)
    assert result["count"] == 1
    assert result["results"][0]["state"] == "Last local instant"
