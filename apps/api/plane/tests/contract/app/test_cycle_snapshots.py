from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import close_old_connections

from plane.bgtasks.cycle_snapshot_task import capture_cycle_progress
from plane.db.models import (
    Cycle,
    CycleIssue,
    CycleProgressSnapshot,
    Issue,
    Project,
    ProjectMember,
    State,
    WorkspaceMember,
)
from plane.utils.cycle_snapshots import observe_cycle_progress

NOW = datetime(2026, 10, 16, 1, tzinfo=timezone.utc)


@pytest.fixture
def context(db, workspace, create_user):
    project = Project.objects.create(
        name="History", identifier="HISTORY", workspace=workspace, cycle_view=True, timezone="Asia/Shanghai"
    )
    ProjectMember.objects.create(project=project, member=create_user, role=15)
    cycle = Cycle.objects.create(
        name="Observed",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=NOW - timedelta(days=4),
        end_date=NOW + timedelta(days=5),
    )
    states = {
        g: State.objects.create(name=g, group=g, project=project, workspace=workspace)
        for g in ["backlog", "unstarted", "started", "completed", "cancelled", "triage"]
    }
    return workspace, project, cycle, states


def add(context, group="started", **fields):
    workspace, project, cycle, states = context
    issue = Issue.objects.create(
        name="Observed task", project=project, workspace=workspace, state=states[group], **fields
    )
    bridge = CycleIssue.objects.create(project=project, workspace=workspace, cycle=cycle, issue=issue)
    return issue, bridge


def history(client, context):
    workspace, project, cycle, _ = context
    return client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/cycles/{cycle.id}/cycle-progress/")


pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def test_first_observation_never_invents_yesterday(context, session_client):
    add(context, "completed", completed_at=NOW - timedelta(days=3))
    with patch("django.utils.timezone.now", return_value=NOW):
        result = history(session_client, context)
    assert result.status_code == 200
    assert len(result.data) == 1
    assert result.data[0]["progress_date"].isoformat() == "2026-10-16"
    assert result.data[0]["completed_issues"] == 1
    assert CycleProgressSnapshot.objects.count() == 1


def test_same_day_is_updated_and_prior_days_are_frozen(context, session_client):
    workspace, _, cycle, states = context
    task, bridge = add(context)
    add(context, "cancelled")
    with patch("django.utils.timezone.now", return_value=NOW):
        history(session_client, context)
    Issue.objects.filter(pk=task.id).update(state=states["completed"], completed_at=NOW)
    with patch("django.utils.timezone.now", return_value=NOW + timedelta(hours=2)):
        history(session_client, context)
    assert CycleProgressSnapshot.objects.count() == 1
    day = CycleProgressSnapshot.objects.get()
    assert (day.total_issues, day.completed_issues, day.cancelled_issues) == (2, 1, 1)
    before = (day.observed_at, day.updated_at)
    # Reopen and remove work: tomorrow's observation cannot rewrite yesterday.
    Issue.objects.filter(pk=task.id).update(state=states["started"], completed_at=None)
    bridge.delete()
    with patch("django.utils.timezone.now", return_value=NOW + timedelta(days=1)):
        result = history(session_client, context)
        stats = session_client.get(f"/api/workspaces/{workspace.slug}/active-cycles/").data["results"][0]
    assert len(result.data) == 2
    day.refresh_from_db()
    assert (day.observed_at, day.updated_at) == before
    assert day.completed_issues == 1
    assert stats["progress_chart"]["2026-10-16"]["total_issues"] == 2
    assert stats["progress_chart"]["2026-10-17"]["total_issues"] == 1
    assert stats["completion_chart"]["2026-10-16"] == 0
    assert stats["completion_chart"]["2026-10-17"] == 0


def test_scheduler_retry_and_missing_days_do_not_backfill(context, session_client):
    workspace, _, cycle, _ = context
    add(context)
    with patch("django.utils.timezone.now", return_value=NOW):
        capture_cycle_progress()
        capture_cycle_progress()
    with patch("django.utils.timezone.now", return_value=NOW + timedelta(days=3)):
        capture_cycle_progress()
        stats = session_client.get(f"/api/workspaces/{workspace.slug}/active-cycles/").data["results"][0]
    assert list(CycleProgressSnapshot.objects.values_list("progress_date", flat=True)) == [
        NOW.date(),
        (NOW + timedelta(days=3)).date(),
    ]
    assert stats["progress_chart"]["2026-10-17"] is None
    assert stats["progress_chart"]["2026-10-18"] is None


def test_project_timezone_controls_dates_across_midnight(context, session_client):
    _, _, cycle, _ = context
    instant = datetime(2026, 10, 15, 15, 59, tzinfo=timezone.utc)
    with patch("django.utils.timezone.now", return_value=instant):
        history(session_client, context)
    with patch("django.utils.timezone.now", return_value=instant + timedelta(minutes=2)):
        history(session_client, context)
    assert list(CycleProgressSnapshot.objects.values_list("progress_date", flat=True)) == [instant.date(), NOW.date()]


@pytest.mark.parametrize("role,active", [(5, True), (15, False)])
def test_project_permission_rejection_neither_reads_nor_collects(context, session_client, create_user, role, active):
    _, project, _, _ = context
    ProjectMember.objects.filter(project=project, member=create_user).update(role=role, is_active=active)
    with patch("django.utils.timezone.now", return_value=NOW):
        assert history(session_client, context).status_code == 404
    assert not CycleProgressSnapshot.objects.exists()


def test_workspace_guest_cannot_read_or_collect(context, session_client, create_user):
    workspace, *_ = context
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
    assert history(session_client, context).status_code == 403
    assert not CycleProgressSnapshot.objects.exists()


def test_history_cannot_be_posted_or_edited(context, session_client):
    workspace, project, cycle, _ = context
    url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/cycles/{cycle.id}/cycle-progress/"
    assert session_client.post(url, {"progress_date": "2000-01-01", "total_issues": 999}).status_code == 405
    assert session_client.patch(url, {"completed_issues": 999}).status_code == 405
    assert not CycleProgressSnapshot.objects.exists()


def test_ended_cycles_keep_history_without_a_fabricated_final_sample(context, session_client):
    _, _, cycle, _ = context
    with patch("django.utils.timezone.now", return_value=NOW):
        history(session_client, context)
    with patch("django.utils.timezone.now", return_value=NOW + timedelta(days=6)):
        result = history(session_client, context)
        assert capture_cycle_progress()["observed_cycles"] == 0
    assert result.status_code == 200
    assert len(result.data) == 1


@pytest.mark.parametrize("field,value", [("cycle_view", False), ("archived_at", NOW), ("deleted_at", NOW)])
def test_scheduler_skips_disabled_archived_deleted_projects(context, field, value):
    _, project, _, _ = context
    Project.objects.filter(pk=project.id).update(**{field: value})
    with patch("django.utils.timezone.now", return_value=NOW):
        assert capture_cycle_progress()["observed_cycles"] == 0
    assert not CycleProgressSnapshot.objects.exists()


def test_scheduler_uses_same_visible_issue_scope_as_live_api(context, session_client):
    workspace, project, cycle, states = context
    add(context)
    add(context, "triage")
    add(context, is_draft=True)
    add(context, archived_at=NOW)
    deleted, _ = add(context)
    Issue.objects.filter(pk=deleted.id).update(deleted_at=NOW)
    other = Project.objects.create(name="Other", identifier=uuid4().hex[:10], workspace=workspace)
    foreign = Issue.objects.create(name="Malformed link", project=other, workspace=workspace, state=states["started"])
    CycleIssue.objects.create(issue=foreign, cycle=cycle, project=project, workspace=workspace)
    with patch("django.utils.timezone.now", return_value=NOW):
        capture_cycle_progress()
        result = session_client.get(f"/api/workspaces/{workspace.slug}/active-cycles/")
    snapshot = CycleProgressSnapshot.objects.get()
    assert snapshot.total_issues == snapshot.started_issues == result.data["results"][0]["total_issues"] == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_observations_are_unique_and_keep_the_latest_time(context):
    _, _, cycle, _ = context
    add(context)

    def observe(_):
        close_old_connections()
        try:
            return observe_cycle_progress([cycle.id])[0]
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        observed = list(executor.map(observe, range(2)))
    assert CycleProgressSnapshot.objects.count() == 1
    assert CycleProgressSnapshot.objects.get().observed_at == max(observed)


def test_activity_delivery_schedules_current_project_observation(context, create_user):
    from plane.bgtasks.issue_activities_task import issue_activity

    _, project, _, _ = context
    with (
        patch("plane.bgtasks.issue_activities_task.delete_cycle_issue_activity"),
        patch("plane.bgtasks.issue_activities_task.capture_cycle_progress.delay") as enqueue,
    ):
        issue_activity(
            type="cycle.activity.deleted",
            requested_data="{}",
            current_instance="{}",
            issue_id=None,
            actor_id=str(create_user.id),
            project_id=str(project.id),
            epoch=NOW.timestamp(),
        )
    enqueue.assert_called_once_with(str(project.id))


def test_activity_collector_only_observes_the_selected_project(context, workspace, create_user):
    _, project, cycle, _ = context
    other_project = Project.objects.create(name="Unrelated", identifier="UNRELATED", workspace=workspace)
    Cycle.objects.create(
        project=other_project,
        workspace=workspace,
        owned_by=create_user,
        name="Not requested",
        start_date=NOW - timedelta(days=1),
        end_date=NOW + timedelta(days=1),
    )
    with patch("django.utils.timezone.now", return_value=NOW):
        assert capture_cycle_progress(str(project.id))["observed_cycles"] == 1
    assert list(CycleProgressSnapshot.objects.values_list("cycle_id", flat=True)) == [cycle.id]
