from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest

from plane.app.serializers import CycleWriteSerializer
from plane.db.models import (
    Cycle,
    CycleIssue,
    CycleProgressSnapshot,
    Issue,
    Project,
    ProjectMember,
    State,
    Workspace,
    WorkspaceMember,
)

NOW = datetime(2026, 10, 18, 8, tzinfo=timezone.utc)
pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def context(workspace, create_user):
    project = Project.objects.create(name="Complete", identifier="COMPLETE", workspace=workspace, cycle_view=True)
    ProjectMember.objects.create(project=project, member=create_user, role=15)
    source = Cycle.objects.create(
        name="Current",
        workspace=workspace,
        project=project,
        owned_by=create_user,
        start_date=NOW - timedelta(days=2),
        end_date=NOW + timedelta(days=2),
    )
    target = Cycle.objects.create(
        name="Future",
        workspace=workspace,
        project=project,
        owned_by=create_user,
        start_date=NOW + timedelta(days=3),
        end_date=NOW + timedelta(days=7),
    )
    states = {
        group: State.objects.create(name=group, group=group, workspace=workspace, project=project)
        for group in ("backlog", "unstarted", "started", "completed", "cancelled", "triage")
    }
    return workspace, project, source, target, states


def add(context, group="started", **fields):
    workspace, project, source, _, states = context
    issue = Issue.objects.create(name="Task", workspace=workspace, project=project, state=states[group], **fields)
    bridge = CycleIssue.objects.create(workspace=workspace, project=project, cycle=source, issue=issue)
    return issue, bridge


def complete(client, context, action="keep", **fields):
    workspace, project, source, *_ = context
    with patch("django.utils.timezone.now", return_value=NOW):
        return client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/cycles/{source.id}/complete/",
            {"incomplete_action": action, **fields},
            format="json",
        )


def assert_detail(data):
    assert {
        "id",
        "name",
        "description",
        "workspace_id",
        "project_id",
        "owned_by_id",
        "start_date",
        "end_date",
        "completed_at",
        "view_props",
        "sort_order",
        "external_source",
        "external_id",
        "progress_snapshot",
        "logo_props",
        "version",
        "created_by",
        "is_favorite",
        "assignee_ids",
        "sub_issues",
        "status",
        "total_issues",
        "backlog_issues",
        "unstarted_issues",
        "started_issues",
        "completed_issues",
        "cancelled_issues",
    } <= set(data)


@pytest.mark.parametrize("role", [15, 20])
def test_keep_preserves_dates_and_membership_and_observes_final_state(context, session_client, create_user, role):
    _, project, source, _, states = context
    ProjectMember.objects.filter(project=project, member=create_user).update(role=role)
    issue, bridge = add(context)
    add(context, "cancelled")
    original_dates = source.start_date, source.end_date
    result = complete(session_client, context)
    assert result.status_code == 200, result.data
    assert set(result.data) == {"cycle", "target_cycle", "transferred_issues_count"}
    assert result.data["target_cycle"] is None
    assert result.data["transferred_issues_count"] == 0
    assert_detail(result.data["cycle"])
    assert result.data["cycle"]["status"] == "COMPLETED"
    assert result.data["cycle"]["started_issues"] == result.data["cycle"]["cancelled_issues"] == 1
    source.refresh_from_db()
    bridge.refresh_from_db()
    assert source.completed_at == NOW
    assert (source.start_date, source.end_date) == original_dates
    assert bridge.cycle_id == source.id
    assert source.progress_snapshot == {}
    snapshot = CycleProgressSnapshot.objects.get(cycle=source)
    assert snapshot.observed_at == NOW
    assert snapshot.total_issues == 2
    assert snapshot.started_issues == snapshot.cancelled_issues == 1


def test_transfer_only_visible_incomplete_issues_and_settles_before_transfer(
    context, session_client, django_capture_on_commit_callbacks
):
    _, _, source, target, _ = context
    bridges = {
        group: add(context, group)[1]
        for group in ("backlog", "unstarted", "started", "completed", "cancelled", "triage")
    }
    excluded = [add(context, is_draft=True)[1], add(context, archived_at=NOW)[1]]
    issue, bridge = add(context)
    Issue.objects.filter(pk=issue.id).update(deleted_at=NOW)
    excluded.append(bridge)
    _, deleted_bridge = add(context)
    deleted_bridge.delete()
    dates = source.start_date, source.end_date, target.start_date, target.end_date
    with patch("plane.utils.cycle_transfer_issues.issue_activity.delay") as activity:
        with django_capture_on_commit_callbacks(execute=True):
            result = complete(session_client, context, "transfer", target_cycle_id=str(target.id))
            activity.assert_not_called()
        activity.assert_called_once()
    assert result.status_code == 200, result.data
    assert result.data["transferred_issues_count"] == 3
    assert_detail(result.data["cycle"])
    assert_detail(result.data["target_cycle"])
    assert result.data["cycle"]["status"] == "COMPLETED"
    assert result.data["target_cycle"]["status"] == "UPCOMING"
    assert result.data["target_cycle"]["total_issues"] == 3
    for group, bridge in bridges.items():
        bridge.refresh_from_db()
        assert bridge.cycle_id == (target.id if group in ("backlog", "unstarted", "started") else source.id)
    for bridge in excluded:
        bridge.refresh_from_db()
        assert bridge.cycle_id == source.id
    source.refresh_from_db()
    target.refresh_from_db()
    assert (source.start_date, source.end_date, target.start_date, target.end_date) == dates
    assert source.progress_snapshot["started_issues"] == 1
    assert source.progress_snapshot["total_issues"] == 6  # Legacy snapshot includes triage.
    final = CycleProgressSnapshot.objects.get(cycle=source)
    assert final.total_issues == 5
    assert final.backlog_issues == final.unstarted_issues == final.started_issues == 1
    assert final.completed_issues == final.cancelled_issues == 1


@pytest.mark.parametrize("member_role,workspace_role,active", [(5, 15, True), (15, 15, False)])
def test_permission_denied_has_no_writes(context, session_client, create_user, member_role, workspace_role, active):
    workspace, project, source, *_ = context
    ProjectMember.objects.filter(project=project, member=create_user).update(role=member_role, is_active=active)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=workspace_role)
    assert complete(session_client, context).status_code == 403
    source.refresh_from_db()
    assert source.completed_at is None
    assert not CycleProgressSnapshot.objects.exists()


@pytest.mark.parametrize(
    "changes",
    [
        {"start_date": None},
        {"end_date": None},
        {"archived_at": NOW},
        {"start_date": NOW + timedelta(days=1)},
        {"end_date": NOW - timedelta(seconds=1)},
    ],
)
def test_source_must_be_current_unarchived(context, session_client, changes):
    source = context[2]
    Cycle.objects.filter(pk=source.id).update(**changes)
    assert complete(session_client, context).status_code == 400
    source.refresh_from_db()
    assert source.completed_at is None
    assert not CycleProgressSnapshot.objects.exists()


@pytest.mark.parametrize(
    "changes",
    [
        {"start_date": None},
        {"end_date": None},
        {"archived_at": NOW},
        {"completed_at": NOW},
        {"start_date": NOW},
        {"start_date": NOW - timedelta(days=1)},
        {"end_date": NOW + timedelta(days=1)},
    ],
)
def test_invalid_target_is_rejected_atomically(context, session_client, changes):
    source, target = context[2:4]
    _, bridge = add(context)
    Cycle.objects.filter(pk=target.id).update(**changes)
    assert complete(session_client, context, "transfer", target_cycle_id=str(target.id)).status_code == 400
    source.refresh_from_db()
    bridge.refresh_from_db()
    assert source.completed_at is None
    assert source.progress_snapshot == {}
    assert bridge.cycle_id == source.id
    assert not CycleProgressSnapshot.objects.exists()


@pytest.mark.parametrize("kind", ["missing", "self", "project", "workspace", "deleted"])
def test_target_tenant_scope(context, session_client, create_user, kind):
    workspace, project, source, target, _ = context
    if kind == "missing":
        target_id = uuid4()
    elif kind == "self":
        target_id = source.id
    else:
        if kind == "workspace":
            workspace = Workspace.objects.create(name="Other", slug="other-complete", owner=create_user)
        if kind in ("workspace", "project"):
            project = Project.objects.create(name="Other", identifier="OTHER", workspace=workspace)
        Cycle.objects.filter(pk=target.id).update(
            project=project, workspace=workspace, **({"deleted_at": NOW} if kind == "deleted" else {})
        )
        target_id = target.id
    assert complete(session_client, context, "transfer", target_cycle_id=str(target_id)).status_code == 400
    source.refresh_from_db()
    assert source.completed_at is None
    assert source.progress_snapshot == {}


def test_transfer_does_not_move_malformed_foreign_issue(context, session_client, create_user):
    workspace, project, source, target, states = context
    other = Project.objects.create(name="Foreign", identifier="FOREIGN", workspace=workspace)
    issue = Issue.objects.create(name="Foreign", project=other, workspace=workspace, state=states["started"])
    bridge = CycleIssue.objects.create(project=project, workspace=workspace, cycle=source, issue=issue)
    result = complete(session_client, context, "transfer", target_cycle_id=str(target.id))
    assert result.status_code == 200, result.data
    assert result.data["transferred_issues_count"] == 0
    bridge.refresh_from_db()
    assert bridge.cycle_id == source.id


def test_failure_rolls_back_transfer_snapshot_and_activity(context, session_client, django_capture_on_commit_callbacks):
    source, target = context[2:4]
    _, bridge = add(context)
    original_save = Cycle.save

    def fail_completion(cycle, *args, **kwargs):
        if "completed_at" in kwargs.get("update_fields", []):
            raise RuntimeError("failed completion write")
        return original_save(cycle, *args, **kwargs)

    with patch.object(Cycle, "save", fail_completion):
        with patch("plane.utils.cycle_transfer_issues.issue_activity.delay") as activity:
            with django_capture_on_commit_callbacks(execute=True):
                result = complete(session_client, context, "transfer", target_cycle_id=str(target.id))
            activity.assert_not_called()
    assert result.status_code == 500
    source.refresh_from_db()
    bridge.refresh_from_db()
    assert source.completed_at is None
    assert source.progress_snapshot == {}
    assert bridge.cycle_id == source.id
    assert not CycleProgressSnapshot.objects.exists()


def test_duplicate_completion_is_conflict_without_writes(context, session_client):
    assert complete(session_client, context).status_code == 200
    source = context[2]
    source.refresh_from_db()
    before = source.updated_at
    snapshot_before = CycleProgressSnapshot.objects.get().updated_at
    with patch("plane.utils.cycle_completion.observe_cycle_progress") as observe:
        result = complete(session_client, context)
    assert result.status_code == 409
    observe.assert_not_called()
    source.refresh_from_db()
    assert source.updated_at == before
    assert CycleProgressSnapshot.objects.get().updated_at == snapshot_before


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"incomplete_action": "unknown"},
        {"incomplete_action": "transfer"},
        {"incomplete_action": "transfer", "target_cycle_id": "bad-uuid"},
        {"incomplete_action": "keep", "target_cycle_id": str(uuid4())},
    ],
)
def test_request_contract(context, session_client, payload):
    workspace, project, source, *_ = context
    result = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/{project.id}/cycles/{source.id}/complete/",
        payload,
        format="json",
    )
    assert result.status_code == 400
    assert not CycleProgressSnapshot.objects.exists()


def test_completed_at_is_read_only(context):
    source = context[2]
    serializer = CycleWriteSerializer(source, data={"completed_at": NOW.isoformat()}, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert "completed_at" not in serializer.validated_data


def test_expiry_between_validation_and_observation_has_no_writes(context, session_client):
    source = context[2]
    with patch(
        "plane.utils.cycle_completion.observe_cycle_progress", return_value=(source.end_date + timedelta(seconds=1), {})
    ):
        result = complete(session_client, context)
    assert result.status_code == 400
    source.refresh_from_db()
    assert source.completed_at is None
    assert not CycleProgressSnapshot.objects.exists()


def test_transfer_recounts_current_state_at_submission(context, session_client):
    _, _, source, target, states = context
    issue, bridge = add(context)
    Issue.objects.filter(pk=issue.id).update(state=states["completed"], completed_at=NOW)
    result = complete(session_client, context, "transfer", target_cycle_id=str(target.id))
    assert result.status_code == 200, result.data
    assert result.data["transferred_issues_count"] == 0
    bridge.refresh_from_db()
    assert bridge.cycle_id == source.id
    assert CycleProgressSnapshot.objects.get(cycle=source).completed_issues == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_completion_transfers_once(context, create_user):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import close_old_connections
    from rest_framework.test import APIClient

    workspace, project, source, target, _ = context
    _, bridge = add(context)
    barrier = Barrier(2)

    def submit():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user=create_user)
            barrier.wait(timeout=10)
            return client.post(
                f"/api/workspaces/{workspace.slug}/projects/{project.id}/cycles/{source.id}/complete/",
                {"incomplete_action": "transfer", "target_cycle_id": str(target.id)},
                format="json",
            )
        finally:
            close_old_connections()

    with patch("django.utils.timezone.now", return_value=NOW):
        with patch("plane.utils.cycle_transfer_issues.issue_activity.delay") as activity:
            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(lambda _: submit(), range(2)))
            assert sorted(result.status_code for result in results) == [200, 409]
            activity.assert_called_once()
    success = next(result for result in results if result.status_code == 200)
    assert success.data["transferred_issues_count"] == 1
    bridge.refresh_from_db()
    assert bridge.cycle_id == target.id
    assert CycleProgressSnapshot.objects.filter(cycle=source).count() == 1
    assert CycleProgressSnapshot.objects.get(cycle=source).started_issues == 1


def test_response_detail_failure_rolls_back_completion(context, session_client, django_capture_on_commit_callbacks):
    source, target = context[2:4]
    _, bridge = add(context)
    with patch(
        "plane.app.views.cycle.complete.CycleCompleteEndpoint.cycle_detail", side_effect=RuntimeError("detail failed")
    ):
        with patch("plane.utils.cycle_transfer_issues.issue_activity.delay") as activity:
            with django_capture_on_commit_callbacks(execute=True):
                result = complete(session_client, context, "transfer", target_cycle_id=str(target.id))
            activity.assert_not_called()
    assert result.status_code == 500
    source.refresh_from_db()
    bridge.refresh_from_db()
    assert source.completed_at is None
    assert source.progress_snapshot == {}
    assert bridge.cycle_id == source.id
    assert not CycleProgressSnapshot.objects.exists()


def test_keep_completed_cycle_rejects_later_legacy_transfer(context, session_client):
    workspace, project, source, target, _ = context
    _, bridge = add(context)
    assert complete(session_client, context).status_code == 200
    with patch("django.utils.timezone.now", return_value=NOW):
        result = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/cycles/{source.id}/transfer-issues/",
            {"new_cycle_id": str(target.id)},
            format="json",
        )
    assert result.status_code == 400
    bridge.refresh_from_db()
    source.refresh_from_db()
    assert bridge.cycle_id == source.id
    assert source.progress_snapshot == {}
