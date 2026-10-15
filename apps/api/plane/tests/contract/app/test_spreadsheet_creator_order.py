from datetime import timedelta

import pytest
from django.utils import timezone

from plane.db.models import Issue, Project, ProjectMember, State, User


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("direction", ["", "-"])
@pytest.mark.parametrize("role", [5, 15])
def test_creator_sort_preserves_rows_tiebreaks_and_guest_scope(
    session_client, workspace, create_user, mocker, direction, role
):
    mocker.patch("plane.app.views.issue.base.recent_visited_task.delay")
    User.objects.filter(pk=create_user.pk).update(display_name="Alpha")
    other = User.objects.create(email="alpha@example.com", username="other-creator", display_name="Zulu")
    project = Project.objects.create(
        name="Creator sorting", identifier="SORT", workspace=workspace, guest_view_all_features=False
    )
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=role)
    state = State.objects.create(project=project, workspace=workspace, name="Todo", group="unstarted")
    now = timezone.now()
    issues = {}
    for index, (key, creator) in enumerate(
        [("a_old", create_user), ("z", other), ("a_new", create_user), ("missing", None)]
    ):
        issue = Issue.objects.create(
            name=key, project=project, workspace=workspace, state=state, created_by=creator
        )
        # Model saves normally derive the author from the active request.
        Issue.objects.filter(pk=issue.pk).update(created_by=creator, created_at=now + timedelta(seconds=index))
        issues[key] = str(issue.pk)

    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/projects/{project.pk}/issues/",
        {"order_by": f"{direction}created_by__display_name"},
    )
    assert response.status_code == 200, response.data
    expected = ["a_new", "a_old"]
    if role != 5:
        # The shared paginator keeps missing values last in either direction.
        expected = ["z", *expected, "missing"] if direction else [*expected, "z", "missing"]
    assert [str(row["id"]) for row in response.data["results"]] == [issues[key] for key in expected]
