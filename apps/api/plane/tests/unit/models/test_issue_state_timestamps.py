# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue, Project, State, Workspace


@pytest.fixture
def project(create_user):
    workspace = Workspace.objects.create(name="Timestamps", slug="timestamps", owner=create_user)
    return Project.objects.create(name="Timestamps", identifier="TS", workspace=workspace, created_by=create_user)


@pytest.fixture
def states(project):
    groups = ["backlog", "unstarted", "started", "completed", "cancelled"]
    return {
        group: State.objects.create(name=group.title(), project=project, group=group, default=group == "backlog")
        for group in groups
    }


@pytest.fixture
def issue(project, states, create_user):
    return Issue.objects.create(
        name="Issue", workspace=project.workspace, project=project, state=states["backlog"], created_by=create_user
    )


def move(issue, state):
    issue = Issue.objects.get(pk=issue.pk)
    issue.state = state
    issue.save()
    issue.refresh_from_db()
    return issue


@pytest.mark.unit
@pytest.mark.django_db
class TestIssueStateTimestamps:
    def test_creation_records_state_entry_but_not_start(self, issue):
        assert issue.state_changed_at is not None
        assert issue.started_at is None

    def test_first_start_is_kept_across_started_and_done(self, issue, states):
        started = move(issue, states["started"])
        assert started.started_at == started.state_changed_at

        done = move(started, states["completed"])
        assert done.started_at == started.started_at
        assert done.completed_at == done.state_changed_at
        assert done.state_changed_at > started.state_changed_at

    def test_moving_back_to_the_queue_resets_start(self, issue, states):
        started = move(issue, states["started"])
        assert started.started_at is not None
        assert move(started, states["unstarted"]).started_at is None

    def test_unrelated_save_keeps_state_entry_time(self, issue):
        entered = issue.state_changed_at
        issue = Issue.objects.get(pk=issue.pk)
        issue.name = "Renamed"
        issue.save()
        issue.refresh_from_db()
        assert issue.state_changed_at == entered

    def test_update_fields_save_persists_timestamps(self, issue, states):
        issue = Issue.objects.get(pk=issue.pk)
        issue.state = states["started"]
        issue.save(update_fields=["state"])
        issue.refresh_from_db()
        assert issue.started_at is not None
        assert issue.state_changed_at == issue.started_at
