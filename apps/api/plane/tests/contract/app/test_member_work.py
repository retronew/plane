from datetime import date, datetime, timezone as dt_timezone
from unittest.mock import patch

import pytest

from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueComment,
    IssueCommentReview,
    Project,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def records(workspace, create_user):
    project = Project.objects.create(
        workspace=workspace, name="Visible", identifier="MW", timezone="America/Los_Angeles"
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    author = User.objects.create(email="author@example.com", username="author", first_name="Author")
    WorkspaceMember.objects.create(workspace=workspace, member=author, role=15)
    ProjectMember.objects.create(project=project, member=author, role=15)
    states = {
        g: State.objects.create(project=project, name=g, group=g)
        for g in ["unstarted", "started", "completed", "cancelled"]
    }
    issues = []
    for group, target in [
        ("unstarted", date(2026, 1, 1)),
        ("started", date(2026, 1, 2)),
        ("completed", date(2026, 1, 1)),
        ("cancelled", date(2026, 1, 1)),
        ("started", None),
    ]:
        issue = Issue.objects.create(
            project=project, name=f"Task {len(issues)}", state=states[group], target_date=target
        )
        IssueAssignee.objects.create(project=project, issue=issue, assignee=create_user)
        issues.append(issue)
    Issue.objects.filter(pk=issues[2].pk).update(completed_at=datetime(2026, 1, 2, 7, tzinfo=dt_timezone.utc))
    comment = IssueComment.objects.create(project=project, issue=issues[0], actor=author, comment_html="<p>Reason</p>")
    return project, author, issues, comment


@pytest.mark.parametrize(
    "excluded", ["draft", "archived", "deleted", "removed_assignment", "inactive_workspace", "bot", "inactive_project"]
)
def test_excluded_records(session_client, workspace, create_user, records, excluded):
    project, author, issues, _ = records
    issue = issues[0]
    if excluded in {"draft", "archived", "deleted"}:
        changes = {
            "draft": {"is_draft": True},
            "archived": {"archived_at": datetime.now(dt_timezone.utc)},
            "deleted": {"deleted_at": datetime.now(dt_timezone.utc)},
        }
        Issue.objects.filter(pk=issue.pk).update(**changes[excluded])
        assert row(session_client.get(root(workspace)), create_user)["assigned"] == 4
    elif excluded == "removed_assignment":
        IssueAssignee.objects.get(issue=issue, assignee=create_user).delete()
        assert row(session_client.get(root(workspace)), create_user)["assigned"] == 4
    else:
        IssueAssignee.objects.create(project=project, issue=issue, assignee=author)
        if excluded == "inactive_workspace":
            WorkspaceMember.objects.filter(workspace=workspace, member=author).update(is_active=False)
        elif excluded == "bot":
            User.objects.filter(pk=author.pk).update(is_bot=True)
        else:
            ProjectMember.objects.filter(project=project, member=author).update(is_active=False)
        assert all(r["id"] != str(author.id) for r in session_client.get(root(workspace)).data["rows"])
        assert session_client.get(root(workspace) + f"{author.id}/").data["count"] == 0


def test_original_creator_cannot_bypass_self_review_by_changing_actor(session_client, workspace, create_user, records):
    comment = records[3]
    IssueComment.objects.filter(pk=comment.pk).update(created_by=create_user)
    # actor is writable on the existing serializer; immutable created_by must also guard self-review.
    response = session_client.post(
        reviews_url(workspace, records) + f"{comment.id}/", {"status": "justified"}, format="json"
    )
    assert response.status_code == 403
    assert IssueCommentReview.objects.count() == 0


def test_summary_detail_consistency_and_bounded_queries(session_client, workspace, create_user, records):
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    url = reviews_url(workspace, records)
    assert session_client.post(url + f"{records[3].id}/", {"status": "justified"}, format="json").status_code == 200
    with CaptureQueriesContext(connection) as initial:
        summary = session_client.get(root(workspace))
    counts = row(summary, create_user)
    for status in ["all", "overdue", "late_completed", "justified", "unjustified", "unreviewed"]:
        detail = session_client.get(root(workspace) + f"{create_user.id}/", {"status": status})
        assert detail.status_code == 200, detail.data
        assert detail.data["count"] == counts["assigned" if status == "all" else status]
    for n in range(5):
        user = User.objects.create(email=f"member{n}@example.com", username=f"member{n}")
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
        ProjectMember.objects.create(project=records[0], member=user, role=15)
        IssueAssignee.objects.create(project=records[0], issue=records[2][0], assignee=user)
    with CaptureQueriesContext(connection) as expanded:
        response = session_client.get(root(workspace))
    assert response.status_code == 200
    assert len(expanded) == len(initial)


@pytest.mark.parametrize("payload", [{"status": []}, [], {}, {"status": None}])
def test_malformed_review_body(session_client, workspace, records, payload):
    assert (
        session_client.post(reviews_url(workspace, records) + f"{records[3].id}/", payload, format="json").status_code
        == 400
    )


@pytest.mark.parametrize("project_timezone", ["", "Invalid/Legacy"])
def test_legacy_project_timezone_uses_default_utc(session_client, workspace, create_user, records, project_timezone):
    Project.objects.filter(pk=records[0].pk).update(timezone=project_timezone)
    # UTC completion date is Jan 2; America/Los_Angeles would still be Jan 1.
    assert row(session_client.get(root(workspace)), create_user)["late_completed"] == 1


def test_guest_internal_comment_visibility_matches_existing_app_endpoint(
    session_client, workspace, create_user, records
):
    project, _, issues, comment = records
    url = reviews_url(workspace, records)
    assert comment.access == "INTERNAL"
    assert session_client.post(url + f"{comment.id}/", {"status": "justified"}, format="json").status_code == 200
    Issue.objects.filter(pk=issues[0].pk).update(created_by=create_user)
    ProjectMember.objects.filter(project=project, member=create_user).update(role=5)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
    Project.objects.filter(pk=project.pk).update(guest_view_all_features=False)
    existing = session_client.get(url.replace("comment-reviews/", "comments/"))
    assert existing.status_code == 200, existing.data
    assert str(comment.id) in str(existing.data)
    current = session_client.get(url)
    assert current.status_code == 200, current.data
    assert current.data["reviews"][0]["status"] == "justified"
    assert current.data["can_review"] is False
    assert row(session_client.get(root(workspace)), create_user)["justified"] == 1
    Issue.objects.filter(pk=issues[0].pk).update(created_by=None)
    assert session_client.get(url).status_code == 404
    assert row(session_client.get(root(workspace)), create_user)["assigned"] == 0


def root(workspace):
    return f"/api/workspaces/{workspace.slug}/member-work/"


def reviews_url(workspace, records):
    p, _, issues, _ = records
    return f"/api/workspaces/{workspace.slug}/projects/{p.id}/issues/{issues[0].id}/comment-reviews/"


def row(response, user):
    assert response.status_code == 200, response.data
    return next(r for r in response.data["rows"] if r["id"] == str(user.id))


def test_counts_dates_timezone_and_detail_paging(session_client, workspace, create_user, records):
    with patch(
        "plane.app.views.analytic.member_work.timezone.now",
        return_value=datetime(2026, 1, 2, 7, tzinfo=dt_timezone.utc),
    ):
        data = row(session_client.get(root(workspace)), create_user)
        assert {
            k: data[k]
            for k in [
                "assigned",
                "unstarted",
                "started",
                "completed",
                "cancelled",
                "overdue",
                "late_completed",
                "unreviewed",
            ]
        } == {
            "assigned": 5,
            "unstarted": 1,
            "started": 2,
            "completed": 1,
            "cancelled": 1,
            "overdue": 0,
            "late_completed": 0,
            "unreviewed": 5,
        }
    with patch(
        "plane.app.views.analytic.member_work.timezone.now",
        return_value=datetime(2026, 1, 3, 8, tzinfo=dt_timezone.utc),
    ):
        data = row(
            session_client.get(root(workspace), {"start_date": "2026-01-01", "end_date": "2026-01-02"}), create_user
        )
        assert data["assigned"] == 4
        assert data["overdue"] == 2
        response = session_client.get(root(workspace) + f"{create_user.id}/", {"status": "overdue", "page_size": 1})
        assert response.data["count"] == data["overdue"]
        assert len(response.data["results"]) == 1 and response.data["next_page"] == 2
        second = session_client.get(
            root(workspace) + f"{create_user.id}/", {"status": "overdue", "page_size": 1, "page": 2}
        )
        assert second.data["next_page"] is None
        assert second.data["results"][0]["id"] != response.data["results"][0]["id"]
    Issue.objects.filter(pk=records[2][2].pk).update(completed_at=datetime(2026, 1, 2, 8, tzinfo=dt_timezone.utc))
    assert row(session_client.get(root(workspace)), create_user)["late_completed"] == 1


@pytest.mark.parametrize(
    "params",
    [
        {"start_date": "2026-01-01"},
        {"end_date": "2026-01-01"},
        {"start_date": "2026-1-1", "end_date": "2026-01-02"},
        {"start_date": "2026-02-30", "end_date": "2026-03-01"},
        {"start_date": "2026-01-02", "end_date": "2026-01-01"},
        {"start_date": "", "end_date": ""},
        {"project_ids": "invalid"},
    ],
)
def test_invalid_scope(session_client, workspace, params):
    assert session_client.get(root(workspace), params).status_code == 400


@pytest.mark.parametrize(
    "suffix,params",
    [
        ("bad/", {}),
        (None, {"page": 0}),
        (None, {"page_size": 101}),
        (None, {"page_size": "x"}),
        (None, {"status": "bad"}),
    ],
)
def test_invalid_details(session_client, workspace, create_user, suffix, params):
    assert session_client.get(root(workspace) + (suffix or f"{create_user.id}/"), params).status_code == 400


def test_multi_assignee_effective_memberships_and_private_scope(session_client, workspace, create_user, records):
    project, author, issues, _ = records
    IssueAssignee.objects.create(project=project, issue=issues[0], assignee=author)
    private = Project.objects.create(workspace=workspace, name="Private", identifier="PRI", network=0)
    hidden = Issue.objects.create(project=private, name="Hidden")
    IssueAssignee.objects.create(project=private, issue=hidden, assignee=create_user)
    ProjectMember.objects.create(project=private, member=author, role=15)
    data = session_client.get(root(workspace))
    assert row(data, create_user)["assigned"] == 5
    assert row(data, author)["assigned"] == 1
    assert row(data, author)["project_count"] == 1
    assert row(data, author)["projects"] == [{"id": str(project.id), "name": project.name}]
    assert session_client.get(root(workspace), {"project_ids": str(private.id)}).data["rows"] == []
    ProjectMember.objects.filter(project=project, member=author).update(is_active=False)
    assert all(r["id"] != str(author.id) for r in session_client.get(root(workspace)).data["rows"])
    assert session_client.get(root(workspace) + f"{author.id}/").data["count"] == 0


def test_review_history_edit_delete_and_latest_event_no_fallback(session_client, workspace, create_user, records):
    project, author, issues, comment = records
    url = reviews_url(workspace, records)
    assert session_client.get(url).data["can_review"] is True
    assert session_client.post(url + f"{comment.id}/", {"status": "justified"}, format="json").status_code == 200
    assert row(session_client.get(root(workspace)), create_user)["justified"] == 1
    assert (
        session_client.post(url + f"{comment.id}/", {"status": "unjustified"}, format="json").data["history"][0][
            "status"
        ]
        == "unjustified"
    )
    assert IssueCommentReview.objects.count() == 2
    comment.comment_json = {"text": "changed"}
    comment.save()
    current = session_client.get(url).data["reviews"][0]
    assert current["is_stale"] and current["status"] == "unreviewed" and len(current["history"]) == 2
    assert row(session_client.get(root(workspace)), create_user)["unreviewed"] == 5
    session_client.post(url + f"{comment.id}/", {"status": "justified"}, format="json")
    newer = IssueComment.objects.create(project=project, issue=issues[0], actor=author, comment_html="Second")
    session_client.post(url + f"{newer.id}/", {"status": "unjustified"}, format="json")
    newer.delete()
    assert row(session_client.get(root(workspace)), create_user)["justified"] == 0
    assert row(session_client.get(root(workspace)), create_user)["unreviewed"] == 5
    assert len(session_client.get(url).data["reviews"]) == 1
    cleared = session_client.post(url + f"{comment.id}/", {"status": "unreviewed"}, format="json")
    assert cleared.data["status"] == "unreviewed" and len(cleared.data["history"]) == 4


def test_restoring_reviewed_content_still_requires_a_new_review(session_client, workspace, create_user, records):
    comment = records[3]
    review_url = reviews_url(workspace, records)
    comment_url = review_url.replace("comment-reviews/", "comments/") + f"{comment.id}/"
    for field, changed in [("comment_html", "<p>Changed reason</p>"), ("comment_json", {"text": "changed"})]:
        original = getattr(comment, field)
        assert (
            session_client.post(review_url + f"{comment.id}/", {"status": "justified"}, format="json").status_code
            == 200
        )
        with (
            patch("plane.app.views.issue.comment.issue_activity.delay"),
            patch("plane.app.views.issue.comment.model_activity.delay"),
        ):
            assert session_client.patch(comment_url, {field: changed}, format="json").status_code == 200
            assert session_client.patch(comment_url, {field: original}, format="json").status_code == 200
        current = session_client.get(review_url).data["reviews"][0]
        assert current["is_stale"] and current["status"] == "unreviewed"
        assert row(session_client.get(root(workspace)), create_user)["justified"] == 0


@pytest.mark.parametrize(
    "project_role,workspace_role,active,expected",
    [(15, 15, True, 403), (20, 15, True, 200), (15, 20, True, 200), (20, 20, False, 403)],
)
def test_review_roles(session_client, workspace, create_user, records, project_role, workspace_role, active, expected):
    ProjectMember.objects.filter(project=records[0], member=create_user).update(role=project_role, is_active=active)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=workspace_role)
    assert (
        session_client.post(
            reviews_url(workspace, records) + f"{records[3].id}/", {"status": "justified"}, format="json"
        ).status_code
        == expected
    )


def test_self_review_cross_scope_and_removed_workspace(session_client, workspace, create_user, records):
    p, author, issues, comment = records
    url = reviews_url(workspace, records)
    own = IssueComment.objects.create(project=p, issue=issues[0], actor=create_user, comment_html="Own")
    assert session_client.post(url + f"{own.id}/", {"status": "justified"}, format="json").status_code == 403
    other = IssueComment.objects.create(project=p, issue=issues[1], actor=author, comment_html="Other issue")
    assert session_client.post(url + f"{other.id}/", {"status": "justified"}, format="json").status_code == 404
    foreign_workspace = Workspace.objects.create(name="Other", slug="other", owner=create_user)
    foreign_project = Project.objects.create(workspace=foreign_workspace, name="Foreign", identifier="FR")
    foreign_issue = Issue.objects.create(project=foreign_project, name="Foreign")
    foreign_comment = IssueComment.objects.create(project=foreign_project, issue=foreign_issue, actor=author)
    assert (
        session_client.post(url + f"{foreign_comment.id}/", {"status": "justified"}, format="json").status_code == 404
    )
    assert session_client.get(url.replace(workspace.slug, foreign_workspace.slug)).status_code == 403
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(is_active=False)
    assert session_client.get(url).status_code == 403
    assert session_client.post(url + f"{comment.id}/", {"status": "justified"}, format="json").status_code == 403
    assert IssueCommentReview.objects.count() == 0


def test_guest_visibility_and_normal_comment_serializer_has_no_review_fields(
    session_client, workspace, create_user, records
):
    from plane.app.serializers import IssueCommentSerializer

    assert "reason_status" not in IssueCommentSerializer().fields
    ProjectMember.objects.filter(project=records[0], member=create_user).update(role=5)
    Project.objects.filter(pk=records[0].id).update(guest_view_all_features=False)
    assert session_client.get(reviews_url(workspace, records)).status_code == 404
    assert row(session_client.get(root(workspace)), create_user)["assigned"] == 0


def test_review_status_validation_and_deleted_comment(session_client, workspace, records):
    url = reviews_url(workspace, records)
    assert session_client.post(url + f"{records[3].id}/", {"status": "unknown"}, format="json").status_code == 400
    records[3].delete()
    assert session_client.get(url).data["reviews"] == []
    assert session_client.post(url + f"{records[3].id}/", {"status": "justified"}, format="json").status_code == 404
