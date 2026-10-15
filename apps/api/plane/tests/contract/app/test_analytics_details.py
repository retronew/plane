from datetime import timedelta

import pytest
from django.utils import timezone

from plane.db.models import (
    Cycle,
    CycleIssue,
    Intake,
    IntakeIssue,
    Issue,
    IssueAssignee,
    Module,
    ModuleIssue,
    Project,
    ProjectMember,
    State,
    WorkspaceMember,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def analytics_records(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Visible", identifier="ANL")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    private = Project.objects.create(workspace=workspace, name="Private", identifier="PRV")
    pending = State.objects.create(project=project, name="Ready", group="unstarted")
    done = State.objects.create(project=project, name="Done", group="completed")
    first = Issue.objects.create(project=project, name="Pending", state=pending)
    second = Issue.objects.create(project=project, name="Done", state=done)
    IssueAssignee.objects.create(project=project, issue=first, assignee=create_user)
    IssueAssignee.objects.create(project=project, issue=second, assignee=create_user)
    Issue.objects.create(project=private, name="Hidden", state=None)
    Issue.objects.create(project=project, name="Draft", state=done, is_draft=True)
    Issue.objects.create(project=project, name="Archived", state=done, archived_at=timezone.now())
    now = timezone.now()
    cycle = Cycle.objects.create(
        project=project,
        name="Current",
        owned_by=create_user,
        start_date=now - timedelta(days=1),
        end_date=now + timedelta(days=2),
    )
    for issue in [first, second]:
        CycleIssue.objects.create(project=project, cycle=cycle, issue=issue)
    module = Module.objects.create(project=project, name="Delivery", status="in-progress", lead=create_user)
    for issue in [first, second]:
        ModuleIssue.objects.create(project=project, module=module, issue=issue)
    intake = Intake.objects.create(project=project, name="Intake")
    for n, code in enumerate([-2, -1, 0, 1, 2]):
        item = Issue.objects.create(project=project, name=f"Intake {n}", state=pending)
        IntakeIssue.objects.create(project=project, issue=item, intake=intake, status=code)
    return project, private, first, second, cycle, module


@pytest.mark.parametrize("tab", ["projects", "users", "cycles", "modules", "intake"])
def test_detail_pages_are_backed_by_data_and_respect_project_membership(
    session_client, workspace, analytics_records, tab
):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": tab})
    assert response.status_code == 200, response.data
    assert set(response.data) == {"summary", "rows", "chart"}
    assert response.data["rows"]
    assert "Private" not in str(response.data)
    assert "Hidden" not in str(response.data)


@pytest.mark.parametrize("tab", ["projects", "users", "cycles", "modules", "intake"])
def test_private_project_filters_do_not_expand_scope(session_client, workspace, analytics_records, tab):
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-details/",
        {"type": tab, "project_ids": str(analytics_records[1].id)},
    )
    assert response.status_code == 200
    assert response.data["rows"] == []
    assert all(value == 0 for value in response.data["summary"].values())


@pytest.mark.parametrize("tab", ["cycles", "modules"])
def test_progress_uses_actual_associations_and_completed_states(session_client, workspace, analytics_records, tab):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": tab})
    row = response.data["rows"][0]
    assert row["work_items"] == 2
    assert row["completed"] == 1
    assert row["completion"] == 50
    assert response.data["summary"]["current" if tab == "cycles" else "in-progress"] == 1


def test_intake_uses_all_five_actual_statuses(session_client, workspace, analytics_records):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": "intake"})
    assert response.data["summary"] == {"total_intake": 5, "accepted": 1, "rejected": 1, "duplicate": 1}
    assert response.data["rows"][0]["pending"] == 1
    assert response.data["rows"][0]["total"] == 5
    assert response.data["chart"][0]["count"] == 5


def test_user_workloads_are_not_inflated_and_unassigned_is_separate(session_client, workspace, analytics_records):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": "users"})
    assert response.data["summary"]["total_users"] == 1
    member = next(row for row in response.data["rows"] if row["id"] != "unassigned")
    assert member["unstarted"] == 1
    assert member["completed"] == 1
    unassigned = next(row for row in response.data["rows"] if row["id"] == "unassigned")
    assert unassigned["unstarted"] == 5


@pytest.mark.parametrize("params", [{"type": "nope"}, {"type": "projects", "project_ids": "invalid"}])
def test_invalid_requests_are_rejected(session_client, workspace, params):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", params)
    assert response.status_code == 400


def test_project_stats_existing_endpoint_cannot_expose_private_counts(session_client, workspace, analytics_records):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/project-stats/")
    assert [str(row["id"]) for row in response.data] == [str(analytics_records[0].id)]


@pytest.mark.parametrize("role", [5, 0])
def test_guests_and_removed_members_cannot_read_details(session_client, workspace, create_user, role):
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role, is_active=role != 0)
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": "projects"})
    assert response.status_code in [401, 403, 404]


def test_anonymous_cannot_read_details(api_client, workspace):
    response = api_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": "projects"})
    assert response.status_code in [401, 403]


@pytest.mark.parametrize(
    "metric,expected", [("WORK_ITEM_COUNT", 7), ("ESTIMATE_POINT_COUNT", 7), ("EPIC_WORK_ITEM_COUNT", 1)]
)
def test_custom_insight_uses_selected_metric(session_client, workspace, analytics_records, metric, expected):
    from plane.db.models import IssueType

    first, second = analytics_records[2:4]
    Issue.objects.filter(id=first.id).update(point=2)
    Issue.objects.filter(id=second.id).update(point=5)
    epic_type = IssueType.objects.create(workspace=workspace, name="Epic", is_epic=True)
    Issue.objects.filter(id=first.id).update(type=epic_type)
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-charts/",
        {"type": "custom-work-items", "x_axis": "PRIORITY", "y_axis": metric},
    )
    assert response.status_code == 200, response.data
    assert sum(row["count"] for row in response.data["data"]) == expected


def test_custom_insight_rejects_unknown_metrics(session_client, workspace, analytics_records):
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-charts/",
        {"type": "custom-work-items", "x_axis": "PRIORITY", "y_axis": "NOT_REAL"},
    )
    assert response.status_code == 400


@pytest.mark.parametrize("value,expected", [("3.5", 3.5), ("M", 0), ("0", 0)])
def test_estimates_sum_numeric_values_and_ignore_category_labels(
    session_client, workspace, analytics_records, value, expected
):
    from plane.db.models import Estimate, EstimatePoint

    project, _, first = analytics_records[:3]
    estimate = Estimate.objects.create(project=project, name="Points", type="points")
    estimate_point = EstimatePoint.objects.create(project=project, estimate=estimate, key=1, value=value)
    Issue.objects.filter(id=first.id).update(point=9, estimate_point=estimate_point)
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-charts/",
        {"type": "custom-work-items", "x_axis": "PRIORITY", "y_axis": "ESTIMATE_POINT_COUNT"},
    )
    assert response.status_code == 200, response.data
    assert sum(row["count"] for row in response.data["data"]) == expected


def test_trend_counts_completion_by_completion_date(session_client, workspace, analytics_records):
    project, private, first, second, *_ = analytics_records
    now = timezone.now()
    current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    previous_month = (current_month - timedelta(days=1)).replace(day=1)
    # Move the workspace start back so both monthly buckets are expected.
    type(workspace).objects.filter(pk=workspace.pk).update(created_at=previous_month)
    Issue.objects.filter(pk=first.pk).update(created_at=previous_month + timedelta(days=1))
    Issue.objects.filter(pk=second.pk).update(created_at=previous_month + timedelta(days=2), completed_at=now)
    hidden = Issue.objects.filter(project=private).first()
    Issue.objects.filter(pk=hidden.pk).update(state=second.state, completed_at=now)
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-charts/",
        {"type": "work-items", "project_ids": str(project.id)},
    )
    assert response.status_code == 200
    data = {row["key"]: row for row in response.data["data"]}
    assert data[previous_month.strftime("%Y-%m-%d")]["created_issues"] == 2
    assert data[previous_month.strftime("%Y-%m-%d")]["completed_issues"] == 0
    assert data[current_month.strftime("%Y-%m-%d")]["created_issues"] == 5
    assert data[current_month.strftime("%Y-%m-%d")]["completed_issues"] == 1


def test_project_progress_does_not_count_cancelled_as_completed(session_client, workspace, analytics_records):
    project, _, _, completed, *_ = analytics_records
    cancelled = State.objects.create(project=project, name="Cancelled", group="cancelled")
    Issue.objects.create(project=project, name="Cancelled", state=cancelled)
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/project-stats/",
        {"fields": "total_issues,completed_issues", "project_ids": str(project.id)},
    )
    assert response.status_code == 200
    assert response.data[0]["total_issues"] == 8
    assert response.data[0]["completed_issues"] == 1


@pytest.mark.parametrize("tab", ["projects", "users", "cycles", "modules", "intake"])
def test_detail_period_filters_real_workload_without_removing_current_structure(
    session_client, workspace, analytics_records, tab
):
    project, _, first, completed, *_ = analytics_records
    old = timezone.now() - timedelta(days=40)
    Issue.objects.filter(project=project).update(created_at=old)
    Issue.objects.filter(id=first.id).update(created_at=timezone.now())
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-details/",
        {"type": tab, "project_ids": str(project.id), "date_filter": "last_7_days"},
    )
    assert response.status_code == 200
    if tab == "projects":
        assert response.data["summary"]["work_items"] == 1
        assert response.data["summary"]["completed"] == 0
    elif tab == "users":
        assert response.data["summary"]["total_users"] == 1
        assert response.data["rows"][0]["unstarted"] == 1
        assert response.data["rows"][0]["completed"] == 0
    elif tab in {"cycles", "modules"}:
        assert response.data["rows"][0]["work_items"] == 1
        assert response.data["rows"][0]["completion"] == 0
    else:
        assert response.data["summary"]["total_intake"] == 0


def test_overview_period_keeps_current_members_and_projects_but_filters_created_work(
    session_client, workspace, analytics_records, create_user
):
    project, _, first, completed, *_ = analytics_records
    old = timezone.now() - timedelta(days=40)
    Issue.objects.filter(project=project).update(created_at=old)
    Issue.objects.filter(id=first.id).update(created_at=timezone.now())
    Project.objects.filter(id=project.id).update(created_at=old)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(created_at=old)
    params = {"date_filter": "last_7_days", "project_ids": str(project.id)}
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics/", {**params, "tab": "overview"})
    assert response.status_code == 200
    assert response.data["total_projects"]["count"] == 1
    assert response.data["total_users"]["count"] == 1
    assert response.data["total_work_items"]["count"] == 1
    stats = session_client.get(
        f"/api/workspaces/{workspace.slug}/project-stats/", {**params, "fields": "total_issues,completed_issues"}
    )
    assert stats.data[0]["total_issues"] == 1
    assert stats.data[0]["completed_issues"] == 0
