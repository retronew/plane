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
    entity = analytics_records[4 if tab == "cycles" else 5]
    assert row["lead_id"] == str(entity.owned_by_id if tab == "cycles" else entity.lead_id)
    assert "lead_avatar_url" in row
    assert response.data["summary"]["current" if tab == "cycles" else "in-progress"] == 1


def test_intake_uses_all_five_actual_statuses(session_client, workspace, analytics_records):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": "intake"})
    assert response.data["summary"] == {
        "total_intake": 5,
        "accepted": 1,
        "rejected": 1,
        "duplicate": 1,
        "pending": 1,
        "snoozed": 1,
    }
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
    IntakeIssue.objects.filter(project=project).update(created_at=old)
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
    IntakeIssue.objects.filter(project=project).update(created_at=old)
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


def test_custom_interval_is_inclusive_and_shared_by_all_overview_regions(session_client, workspace, analytics_records):
    project, _, first, second, *_ = analytics_records
    today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=3)
    end = today - timedelta(days=2)
    Issue.objects.filter(project=project).update(created_at=today - timedelta(days=10))
    Issue.objects.filter(pk=first.pk).update(created_at=start)
    Issue.objects.filter(pk=second.pk).update(created_at=end + timedelta(hours=23, minutes=59), completed_at=end)
    params = {"project_ids": str(project.id), "date_filter": f"custom:{start.date()}:{end.date()}"}
    overview = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics/", {**params, "tab": "overview"})
    assert overview.status_code == 200
    assert overview.data["total_work_items"]["count"] == 2
    assert overview.data["total_projects"]["count"] == 1
    details = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {**params, "type": "projects"}
    )
    assert details.status_code == 200
    assert details.data["rows"][0]["work_items"] == 2
    assert details.data["rows"][0]["completion"] == 50
    stats = session_client.get(
        f"/api/workspaces/{workspace.slug}/project-stats/", {**params, "fields": "total_issues,completed_issues"}
    )
    assert stats.data[0]["total_issues"] == 2
    assert stats.data[0]["completed_issues"] == 1
    chart = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-charts/", {**params, "type": "work-items"}
    )
    assert chart.status_code == 200
    assert sum(row["created_issues"] for row in chart.data["data"]) == 2
    assert sum(row["completed_issues"] for row in chart.data["data"]) == 1


@pytest.mark.parametrize(
    "interval", ["custom:2026-10-20:2026-10-01", "custom:2026-02-30:2026-03-01", "custom:2026-10-01", "custom:x:y"]
)
@pytest.mark.parametrize(
    "endpoint,extra",
    [
        ("advance-analytics", {"tab": "overview"}),
        ("advance-analytics-details", {"type": "projects"}),
        ("advance-analytics-charts", {"type": "work-items"}),
        ("project-stats", {}),
    ],
)
def test_invalid_custom_interval_is_rejected_instead_of_exporting_all_time(
    session_client, workspace, analytics_records, interval, endpoint, extra
):
    response = session_client.get(f"/api/workspaces/{workspace.slug}/{endpoint}/", {**extra, "date_filter": interval})
    assert response.status_code == 400


@pytest.mark.parametrize("tab", ["cycles", "modules", "projects"])
def test_cancelled_is_separate_and_excluded_from_completion_denominator(
    session_client, workspace, analytics_records, tab
):
    project, _, first, second, cycle, module = analytics_records
    cancelled = State.objects.create(project=project, name="Cancelled", group="cancelled")
    Issue.objects.filter(pk=first.pk).update(state=cancelled)
    if tab == "projects":
        IntakeIssue.objects.filter(project=project).delete()
        Issue.objects.filter(project=project, name__startswith="Intake").delete()
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": tab})
    row = response.data["rows"][0]
    assert row["work_items"] == 2
    assert row["cancelled"] == 1
    assert row["completion"] == 100
    if tab != "projects":
        assert response.data["chart"][0]["pending"] == 0
        assert response.data["chart"][0]["cancelled"] == 1
    Issue.objects.filter(pk=second.pk).update(state=cancelled)
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": tab})
    assert response.data["rows"][0]["completion"] == 0


def test_intake_chart_partitions_all_statuses_and_uses_receipt_date(session_client, workspace, analytics_records):
    project = analytics_records[0]
    old = timezone.now() - timedelta(days=60)
    Issue.objects.filter(project=project).update(created_at=old)
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": "intake", "date_filter": "last_7_days"}
    )
    assert response.status_code == 200
    assert response.data["summary"]["total_intake"] == 5
    chart = response.data["chart"][0]
    assert chart["name"] == timezone.localdate().strftime("%Y-%m")
    assert [chart[k] for k in ["pending", "snoozed", "accepted", "rejected", "duplicate"]] == [1] * 5
    assert sum(chart[k] for k in ["pending", "snoozed", "accepted", "rejected", "duplicate"]) == chart["count"]


def test_reopened_items_are_not_reported_as_currently_completed(session_client, workspace, analytics_records):
    project, _, first, second, *_ = analytics_records
    now = timezone.now()
    Issue.objects.filter(pk=second.pk).update(completed_at=now, state=first.state)
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-charts/", {"type": "work-items"})
    assert sum(row["completed_issues"] for row in response.data["data"]) == 0
    assert response.data["period"]["end"] == timezone.localdate().isoformat()


def test_shared_work_does_not_inflate_distinct_total(session_client, workspace, analytics_records, create_user):
    from plane.db.models import User

    project, _, first, *_ = analytics_records
    other = User.objects.create(email="other-analytics@example.com", username="other-analytics")
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
    ProjectMember.objects.create(project=project, member=other, role=15)
    IssueAssignee.objects.create(project=project, issue=first, assignee=other)
    response = session_client.get(f"/api/workspaces/{workspace.slug}/advance-analytics-details/", {"type": "users"})
    assert response.data["summary"]["unique_work_items"] == 7
    assert sum(row["count"] for row in response.data["chart"]) == 8


@pytest.mark.parametrize("kind", ["cycles", "modules"])
def test_sidebar_burndown_excludes_cancelled_reopened_and_future_values(analytics_records, workspace, kind):
    from plane.utils.analytics_plot import burndown_plot

    project, _, first, second, cycle, module = analytics_records
    today = timezone.localdate()
    if kind == "modules":
        module.start_date, module.target_date = today - timedelta(days=1), today + timedelta(days=1)
        entity, ids = module, {"module_id": module.id}
    else:
        entity, ids = cycle, {"cycle_id": cycle.id}
    cancelled = State.objects.create(project=project, name="Cancelled", group="cancelled")
    Issue.objects.filter(pk=first.pk).update(state=cancelled, completed_at=timezone.now() - timedelta(days=3))
    Issue.objects.filter(pk=second.pk).update(completed_at=timezone.now())
    chart = burndown_plot(entity, workspace.slug, project.id, "issues", **ids)
    assert chart[today.isoformat()] == 0
    assert chart[(today - timedelta(days=1)).isoformat()] == 1
    assert chart[(today + timedelta(days=1)).isoformat()] is None
    Issue.objects.filter(pk=second.pk).update(completed_at=None)
    chart = burndown_plot(entity, workspace.slug, project.id, "issues", **ids)
    assert chart[(today - timedelta(days=1)).isoformat()] is None
    assert chart[today.isoformat()] == 0
    Issue.objects.filter(pk=second.pk).update(
        state=State.objects.get(project=project, group="unstarted"), completed_at=timezone.now() - timedelta(days=3)
    )
    chart = burndown_plot(entity, workspace.slug, project.id, "issues", **ids)
    assert chart[today.isoformat()] == 1


def test_project_stats_returns_cancelled_with_the_same_period_scope(session_client, workspace, analytics_records):
    project, _, first, *_ = analytics_records
    cancelled = State.objects.create(project=project, name="Cancelled", group="cancelled")
    Issue.objects.filter(pk=first.pk).update(state=cancelled)
    params = {"fields": "total_issues,completed_issues,cancelled_issues", "date_filter": "last_7_days"}
    response = session_client.get(f"/api/workspaces/{workspace.slug}/project-stats/", params)
    assert response.data[0]["cancelled_issues"] == 1
    Issue.objects.filter(pk=first.pk).update(created_at=timezone.now() - timedelta(days=20))
    response = session_client.get(f"/api/workspaces/{workspace.slug}/project-stats/", params)
    assert response.data[0]["cancelled_issues"] == 0


@pytest.mark.parametrize("value,expected", [("3.5", 3.5), ("M", 0)])
def test_burndown_estimates_preserve_numeric_points_and_ignore_categorical_values(
    workspace, analytics_records, value, expected
):
    from plane.db.models import Estimate, EstimatePoint
    from plane.utils.analytics_plot import burndown_plot

    project, _, first, second, cycle, _ = analytics_records
    estimate = Estimate.objects.create(project=project, name="Points", type="points")
    point = EstimatePoint.objects.create(project=project, estimate=estimate, key=1, value=value)
    Issue.objects.filter(pk=first.pk).update(estimate_point=point)
    chart = burndown_plot(cycle, workspace.slug, project.id, "points", cycle_id=cycle.id)
    assert chart[timezone.localdate().isoformat()] == expected


@pytest.mark.parametrize("kind", ["project", "cycle", "module"])
def test_peek_trend_uses_completion_date_and_correct_granularity(session_client, workspace, analytics_records, kind):
    project, _, first, second, cycle, module = analytics_records
    today = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0)
    old = today - timedelta(days=2)
    Project.objects.filter(pk=project.pk).update(created_at=old - timedelta(days=1))
    Issue.objects.filter(pk=first.pk).update(created_at=old)
    Issue.objects.filter(pk=second.pk).update(created_at=old, completed_at=today)
    params = {"type": "work-items"}
    if kind == "cycle":
        Cycle.objects.filter(pk=cycle.pk).update(start_date=old, end_date=today + timedelta(days=1))
        params["cycle_id"] = str(cycle.pk)
    if kind == "module":
        Module.objects.filter(pk=module.pk).update(start_date=old.date(), target_date=today.date() + timedelta(days=1))
        params["module_id"] = str(module.pk)
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/projects/{project.id}/advance-analytics-charts/", params
    )
    assert response.status_code == 200, response.data
    assert response.data["granularity"] == ("month" if kind == "project" else "day")
    assert sum(row["completed_issues"] for row in response.data["data"]) == 1
    if kind != "project":
        data = {row["key"]: row for row in response.data["data"]}
        assert data[old.date().isoformat()]["created_issues"] == 2
        assert data[old.date().isoformat()]["completed_issues"] == 0
        assert data[today.date().isoformat()]["completed_issues"] == 1
        assert sum(row["created_issues"] for row in data.values()) == 2


def test_trend_applies_cycle_and_epic_scope(session_client, workspace, analytics_records):
    from plane.db.models import IssueType

    project, _, first, second, cycle, _ = analytics_records
    epic = IssueType.objects.create(workspace=workspace, name="Epic", is_epic=True)
    Issue.objects.filter(pk=first.pk).update(type=epic)
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-charts/",
        {"type": "work-items", "cycle_id": str(cycle.pk), "epic": "true"},
    )
    assert response.status_code == 200
    assert sum(row["created_issues"] for row in response.data["data"]) == 1


@pytest.mark.parametrize("axis,index", [("PROJECTS", 0), ("CYCLES", 4), ("MODULES", 5)])
def test_insight_entity_ids_and_parent_projects_are_permission_scoped(
    session_client, workspace, analytics_records, axis, index
):
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/advance-analytics-charts/",
        {"type": "custom-work-items", "x_axis": axis},
    )
    assert response.status_code == 200, response.data
    entity = analytics_records[index]
    row = next(row for row in response.data["data"] if str(row["key"]) == str(entity.id))
    assert row["count"] == (7 if axis == "PROJECTS" else 2)
    assert "Private" not in str(response.data)
    if axis != "PROJECTS":
        assert row["project_id"] == str(analytics_records[0].id)
