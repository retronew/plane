# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

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
from plane.utils.cycle_snapshots import current_snapshot_cycles, observe_cycle_progress
from plane.utils.cycle_status import cycle_completed_q, cycle_status_case, is_cycle_completed

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def completion_context(workspace, create_user):
    now = timezone.now()
    project = Project.objects.create(name="Consistency", identifier="CONS", workspace=workspace, cycle_view=True)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    cycle = Cycle.objects.create(
        name="Finished early",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=now - timedelta(days=1),
        end_date=now + timedelta(days=5),
    )
    state = State.objects.create(name="Started", group="started", project=project, workspace=workspace)
    issue = Issue.objects.create(name="Work", project=project, workspace=workspace, state=state)
    return workspace, project, cycle, issue, now


def mark_completed(cycle, now):
    Cycle.objects.filter(pk=cycle.pk).update(completed_at=now)
    cycle.refresh_from_db()


def cycle_url(context, api=False):
    workspace, project, cycle, *_ = context
    prefix = "/api/v1" if api else "/api"
    return f"{prefix}/workspaces/{workspace.slug}/projects/{project.pk}/cycles/{cycle.pk}/"


@pytest.mark.parametrize("dates", ["current", "upcoming", "draft", "expired"])
def test_explicit_completion_wins_all_date_states(completion_context, dates):
    _, _, cycle, _, now = completion_context
    values = {"completed_at": now}
    if dates == "upcoming":
        values["start_date"] = now + timedelta(days=2)
    elif dates == "draft":
        values.update(start_date=None, end_date=None)
    elif dates == "expired":
        values["end_date"] = now - timedelta(seconds=1)
    Cycle.objects.filter(pk=cycle.pk).update(**values)
    cycle.refresh_from_db()
    assert is_cycle_completed(cycle, now)
    assert Cycle.objects.filter(pk=cycle.pk).filter(cycle_completed_q(now)).exists()
    assert Cycle.objects.filter(pk=cycle.pk).annotate(status=cycle_status_case(now)).get().status == "COMPLETED"


def test_natural_expiry_boundary_remains_strict(completion_context):
    _, _, cycle, _, now = completion_context
    cycle.end_date = now
    assert not is_cycle_completed(cycle, now)
    assert is_cycle_completed(cycle, now + timedelta(microseconds=1))


def test_explicit_completion_stops_collection_but_preserves_history(completion_context, session_client):
    workspace, project, cycle, _, now = completion_context
    with patch("django.utils.timezone.now", return_value=now):
        observe_cycle_progress([cycle.pk])
    snapshot = CycleProgressSnapshot.objects.get(cycle=cycle)
    mark_completed(cycle, now)
    with patch("django.utils.timezone.now", return_value=now + timedelta(hours=2)):
        assert not current_snapshot_cycles(now).filter(pk=cycle.pk).exists()
        assert observe_cycle_progress([cycle.pk])[1] == {}
        active = session_client.get(f"/api/workspaces/{workspace.slug}/active-cycles/")
        history = session_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{project.pk}/cycles/{cycle.pk}/cycle-progress/"
        )
    assert active.status_code == 200
    assert active.data["results"] == []
    assert history.status_code == 200
    assert len(history.data) == 1
    snapshot.refresh_from_db()
    assert snapshot.observed_at == now
    assert CycleProgressSnapshot.objects.filter(cycle=cycle).count() == 1


@pytest.mark.parametrize("api", [False, True])
def test_completed_cycle_cannot_accept_work_items(completion_context, session_client, api_key_client, api):
    _, _, cycle, issue, now = completion_context
    mark_completed(cycle, now)
    client = api_key_client if api else session_client
    response = client.post(
        cycle_url(completion_context, api) + "cycle-issues/", {"issues": [str(issue.pk)]}, format="json"
    )
    assert response.status_code == 400, response.data
    assert not CycleIssue.objects.filter(cycle=cycle, issue=issue).exists()


@pytest.mark.parametrize("api", [False, True])
def test_sort_order_request_cannot_smuggle_completed_cycle_edits(
    completion_context, session_client, api_key_client, api
):
    _, _, cycle, _, now = completion_context
    mark_completed(cycle, now)
    client = api_key_client if api else session_client
    response = client.patch(cycle_url(completion_context, api), {"sort_order": 123, "name": "Bypassed"}, format="json")
    assert response.status_code == 200, response.data
    cycle.refresh_from_db()
    assert cycle.name == "Finished early"
    assert cycle.completed_at == now


@pytest.mark.parametrize("api", [False, True])
def test_explicit_completion_allows_archive(completion_context, session_client, api_key_client, api):
    _, _, cycle, _, now = completion_context
    mark_completed(cycle, now)
    client = api_key_client if api else session_client
    response = client.post(cycle_url(completion_context, api) + "archive/", {}, format="json")
    assert response.status_code in (200, 204), response.data
    cycle.refresh_from_db()
    assert cycle.archived_at is not None


def test_cycle_lists_agree_on_explicit_completion(completion_context, session_client, api_key_client):
    _, _, cycle, _, now = completion_context
    mark_completed(cycle, now)
    for api, client in [(False, session_client), (True, api_key_client)]:
        url = cycle_url(completion_context, api).removesuffix(f"{cycle.pk}/")
        result = client.get(url, {"cycle_view": "current"})
        assert result.status_code == 200
        assert result.data == []
    result = api_key_client.get(url, {"cycle_view": "completed"})
    assert result.status_code == 200
    assert result.data["results"][0]["status"] == "COMPLETED"
    assert result.data["results"][0]["completed_at"] is not None


def test_completed_cycle_does_not_block_new_dates(completion_context, session_client):
    workspace, project, cycle, _, now = completion_context
    url = f"/api/workspaces/{workspace.slug}/projects/{project.pk}/cycles/date-check/"
    dates = {"start_date": cycle.start_date.date().isoformat(), "end_date": cycle.end_date.date().isoformat()}
    assert session_client.post(url, dates, format="json").data["status"] is False
    mark_completed(cycle, now)
    assert session_client.post(url, dates, format="json").data["status"] is True


@pytest.mark.parametrize("project_search", [False, True])
def test_search_reports_completed_status(completion_context, session_client, project_search):
    workspace, project, cycle, _, now = completion_context
    mark_completed(cycle, now)
    params = {"query_type": "cycle", "query": "Finished early"}
    if project_search:
        params["project_id"] = str(project.pk)
    response = session_client.get(f"/api/workspaces/{workspace.slug}/entity-search/", params)
    assert response.status_code == 200
    assert response.data["cycle"][0]["status"] == "COMPLETED"


@pytest.mark.parametrize("api", [False, True])
def test_old_write_routes_cannot_set_or_clear_completed_at(completion_context, session_client, api_key_client, api):
    _, _, cycle, _, now = completion_context
    client = api_key_client if api else session_client
    url = cycle_url(completion_context, api)
    response = client.patch(url, {"completed_at": now.isoformat(), "name": "Still active"}, format="json")
    assert response.status_code == 200, response.data
    cycle.refresh_from_db()
    assert cycle.completed_at is None
    mark_completed(cycle, now)
    response = client.patch(url, {"completed_at": None, "name": "Reopened"}, format="json")
    assert response.status_code == 400, response.data
    cycle.refresh_from_db()
    assert cycle.completed_at == now
    assert cycle.name == "Still active"


@pytest.mark.parametrize("api", [False, True])
def test_guest_cannot_mutate_completed_cycle(completion_context, session_client, api_key_client, create_user, api):
    workspace, project, cycle, issue, now = completion_context
    mark_completed(cycle, now)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
    ProjectMember.objects.filter(project=project, member=create_user).update(role=5)
    client = api_key_client if api else session_client
    url = cycle_url(completion_context, api)
    assert client.patch(url, {"sort_order": 1}, format="json").status_code == 403
    assert client.post(url + "cycle-issues/", {"issues": [str(issue.pk)]}, format="json").status_code == 403
    assert client.post(url + "archive/", {}, format="json").status_code == 403
    cycle.refresh_from_db()
    assert cycle.archived_at is None
    assert not CycleIssue.objects.filter(cycle=cycle).exists()


@pytest.mark.parametrize(
    "enabled,idle_days,explicit,closed",
    [(0, 8, True, False), (7, 1, True, False), (7, 8, False, False), (7, 8, True, True)],
)
def test_automation_retains_project_setting_and_idle_age_requirements(
    completion_context, monkeypatch, enabled, idle_days, explicit, closed
):
    from plane.bgtasks import issue_automation_task as tasks

    workspace, project, cycle, issue, now = completion_context
    cancelled = State.objects.create(name="Cancelled", group="cancelled", project=project, workspace=workspace)
    Project.objects.filter(pk=project.pk).update(close_in=enabled, default_state=cancelled)
    CycleIssue.objects.create(cycle=cycle, issue=issue, project=project, workspace=workspace)
    Issue.objects.filter(pk=issue.pk).update(updated_at=now - timedelta(days=idle_days))
    if explicit:
        mark_completed(cycle, now)
    monkeypatch.setattr(tasks.issue_activity, "delay", lambda **kwargs: None)
    tasks.close_project_issues(project.pk)
    issue.refresh_from_db()
    assert (issue.state_id == cancelled.pk) is closed
