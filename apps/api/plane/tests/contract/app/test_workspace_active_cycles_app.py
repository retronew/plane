from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from plane.db.models import Cycle, CycleIssue, Issue, Project, ProjectMember, State, Workspace, WorkspaceMember

NOW = datetime(2026, 10, 16, 1, tzinfo=timezone.utc)


@pytest.fixture
def context(db, workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.app.views.workspace.cycle.timezone.now", lambda: NOW)
    project = Project.objects.create(
        name="A project", identifier="AC", workspace=workspace, timezone="Asia/Shanghai", cycle_view=True
    )
    membership = ProjectMember.objects.create(project=project, member=create_user, role=15)
    cycle = Cycle.objects.create(
        name="Current",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=NOW - timedelta(days=3),
        end_date=NOW + timedelta(days=4),
    )
    states = {
        group: State.objects.create(name=group, group=group, project=project, workspace=workspace)
        for group in ["backlog", "unstarted", "started", "completed", "cancelled", "triage"]
    }
    return workspace, project, cycle, states, membership


def get_cycles(client, workspace, **params):
    return client.get(f"/api/workspaces/{workspace.slug}/active-cycles/", params)


def add_issue(context, group="unstarted", **fields):
    workspace, project, cycle, states, _ = context
    issue = Issue.objects.create(name="Task", project=project, workspace=workspace, state=states[group], **fields)
    bridge = CycleIssue.objects.create(issue=issue, cycle=cycle, project=project, workspace=workspace)
    return issue, bridge


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceActiveCycles:
    @pytest.mark.parametrize("role", [15, 20])
    def test_member_can_read_live_counts_without_counting_cancelled_as_done(
        self, context, session_client, create_user, role
    ):
        workspace, _, cycle, _, _ = context
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role)
        for group in ["backlog", "unstarted", "started", "completed", "cancelled"]:
            add_issue(context, group)
        # Old snapshots must not override a running cycle's live scope.
        Cycle.objects.filter(pk=cycle.id).update(progress_snapshot={"total_issues": 999})
        response = get_cycles(session_client, workspace)
        assert response.status_code == 200, response.data
        row = response.data["results"][0]
        assert row["total_issues"] == 5
        assert all(
            row[f"{group}_issues"] == 1 for group in ["backlog", "unstarted", "started", "completed", "cancelled"]
        )
        assert row["completion_chart"]["2026-10-16"] == 3
        assert row["completion_chart"]["2026-10-17"] is None
        assert row["project_detail"]["name"] == "A project"
        assert row["status"] == "current"

    def test_excludes_drafts_archives_deleted_removed_and_triage(self, context, session_client):
        workspace, _, _, _, _ = context
        add_issue(context)
        add_issue(context, is_draft=True)
        add_issue(context, archived_at=NOW)
        issue, _ = add_issue(context)
        Issue.objects.filter(pk=issue.id).update(deleted_at=NOW)
        _, bridge = add_issue(context)
        CycleIssue.objects.filter(pk=bridge.id).update(deleted_at=NOW)
        add_issue(context, "triage")
        row = get_cycles(session_client, workspace).data["results"][0]
        assert row["total_issues"] == row["unstarted_issues"] == 1

    @pytest.mark.parametrize("role,active", [(5, True), (15, False)])
    def test_workspace_guest_or_inactive_membership_forbidden(self, context, session_client, create_user, role, active):
        workspace, *_ = context
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role, is_active=active)
        assert get_cycles(session_client, workspace).status_code == 403

    @pytest.mark.parametrize("change", ["guest", "inactive", "removed"])
    def test_no_project_membership_no_metadata_even_for_workspace_admin(self, context, session_client, change):
        workspace, _, _, _, membership = context
        if change == "removed":
            membership.delete()
        else:
            ProjectMember.objects.filter(pk=membership.id).update(
                **({"role": 5} if change == "guest" else {"is_active": False})
            )
        response = get_cycles(session_client, workspace)
        assert response.status_code == 200
        assert response.data["results"] == []
        assert response.data["total_results"] == 0

    def test_unjoined_private_and_public_projects_never_leak(self, context, session_client, create_user):
        workspace, *_ = context
        for network in [0, 2]:
            project = Project.objects.create(
                name=f"Hidden {network}",
                identifier=f"H{network}",
                workspace=workspace,
                network=network,
                cycle_view=True,
            )
            Cycle.objects.create(
                name="Secret",
                project=project,
                workspace=workspace,
                owned_by=create_user,
                start_date=NOW - timedelta(days=1),
                end_date=NOW + timedelta(days=1),
            )
        response = get_cycles(session_client, workspace)
        assert [r["name"] for r in response.data["results"]] == ["Current"]

    def test_foreign_workspace_and_cross_project_links_not_counted(self, context, session_client, create_user):
        workspace, project, cycle, states, _ = context
        foreign = Workspace.objects.create(name="Foreign", slug=uuid4().hex, owner=create_user)
        assert get_cycles(session_client, foreign).status_code == 403
        other = Project.objects.create(name="Other", identifier="OTHER", workspace=workspace)
        item = Issue.objects.create(name="Foreign issue", workspace=workspace, project=other, state=states["started"])
        CycleIssue.objects.create(issue=item, cycle=cycle, workspace=workspace, project=project)
        assert get_cycles(session_client, workspace).data["results"][0]["total_issues"] == 0

    @pytest.mark.parametrize("field,value", [("cycle_view", False), ("archived_at", NOW), ("deleted_at", NOW)])
    def test_disabled_archived_deleted_projects_excluded(self, context, session_client, field, value):
        workspace, project, *_ = context
        Project.objects.filter(pk=project.id).update(**{field: value})
        assert get_cycles(session_client, workspace).data["results"] == []

    @pytest.mark.parametrize(
        "dates",
        [
            {"start_date": NOW + timedelta(seconds=1)},
            {"end_date": NOW - timedelta(seconds=1)},
            {"start_date": None},
            {"end_date": None},
            {"archived_at": NOW},
            {"deleted_at": NOW},
        ],
    )
    def test_only_current_non_archived_cycles(self, context, session_client, dates):
        workspace, _, cycle, *_ = context
        Cycle.objects.filter(pk=cycle.id).update(**dates)
        assert get_cycles(session_client, workspace).data["results"] == []

    def test_exact_boundaries_and_project_local_today(self, context, session_client):
        workspace, _, cycle, *_ = context
        # 00:30 on Oct 16 in Shanghai, still Oct 15 in UTC.
        instant = datetime(2026, 10, 15, 16, 30, tzinfo=timezone.utc)
        Cycle.objects.filter(pk=cycle.id).update(start_date=instant, end_date=NOW)
        row = get_cycles(session_client, workspace).data["results"][0]
        assert row["today"] == "2026-10-16"
        assert list(row["completion_chart"]) == ["2026-10-16"]
        Cycle.objects.filter(pk=cycle.id).update(start_date=NOW)
        assert len(get_cycles(session_client, workspace).data["results"]) == 1

    def test_stable_pagination(self, context, session_client, create_user):
        workspace, project, *_ = context
        for i in range(4):
            Cycle.objects.create(
                name=f"Current {i}",
                project=project,
                workspace=workspace,
                owned_by=create_user,
                start_date=NOW - timedelta(days=1),
                end_date=NOW + timedelta(days=1),
            )
        ids, cursor = [], "2:0:0"
        for _ in range(3):
            response = get_cycles(session_client, workspace, per_page=2, cursor=cursor)
            assert response.status_code == 200
            ids.extend(row["id"] for row in response.data["results"])
            cursor = response.data["next_cursor"]
        assert len(set(ids)) == len(ids) == 5
        assert response.data["next_page_results"] is False

    @pytest.mark.parametrize(
        "params",
        [
            {"per_page": 0},
            {"per_page": -1},
            {"per_page": 26},
            {"per_page": "bad"},
            {"cursor": "bad"},
            {"cursor": "10:-1:0"},
        ],
    )
    def test_invalid_pagination_is_a_400(self, context, session_client, params):
        assert get_cycles(session_client, context[0], **params).status_code == 400

    def test_unauthenticated_request_rejected(self, context, api_client):
        assert get_cycles(api_client, context[0]).status_code in [401, 403]

    def test_page_does_not_query_each_cycle_separately(self, context, session_client, create_user):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        workspace, project, *_ = context
        for i in range(9):
            Cycle.objects.create(
                name=f"Batch {i}",
                project=project,
                workspace=workspace,
                owned_by=create_user,
                start_date=NOW - timedelta(days=1),
                end_date=NOW + timedelta(days=1),
            )
        with CaptureQueriesContext(connection) as queries:
            response = get_cycles(session_client, workspace)
        assert len(response.data["results"]) == 10
        # Lock, bulk observation upsert and history read are fixed per page.
        assert len(queries) <= 10
